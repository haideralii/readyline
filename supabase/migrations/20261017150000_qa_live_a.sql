-- Live QA pass of b340ee3, the acceptance reads of REQ-024 B and C (PO 18 Oct
-- 2026 08:55; D-2840, D-2847). Hour 15: after every migration on `next` at the
-- push (D-2835); the two statements below each name the migration whose
-- text they replace.
--
-- 1. D-2840: `worker_ensure_items` (20261017060000_worker_steps_b.sql, section
--    5) took any regex-valid item id and any owner role from a worker's
--    direct call. The id must be one of the derivation's closed list
--    (`WORKER_ITEM_IDS` in src/lib/registers/onboarding-items.ts) and the
--    owner role comes from the owner's own setting per item, never from the
--    caller; a bad id is 42501 "not allowed", as every worker refusal is.
-- 2. D-2847: `supervision_entries`' delete policy
--    (20261017140000_worker_supervision_c.sql) let the owner delete any entry;
--    SR-3 forbids deleting a record and the Data section asked for the
--    grant, so the correction window wins: an entry may be deleted for 24
--    hours from its `created_at`, nothing after.

create or replace function public.worker_item_owner_role(p_item_id text)
returns text
language sql
immutable
as $$
  select case p_item_id
    when 'identity-and-agreement' then 'owner'
    when 'w1-clearance' then 'owner'
    when 'w1-application-recorded' then 'owner'
    when 'w2-children-check' then 'owner'
    when 'w3-code-of-conduct' then 'both'
    when 'w4-orientation-module' then 'both'
    when 'w5-induction' then 'both'
    when 'w6-policies' then 'both'
    when 'participant-plans-read' then 'both'
    when 'emergency-plan-shown' then 'owner'
    when 'w7-first-aid' then 'owner'
    when 'w7-cpr' then 'owner'
    when 'w7-medication' then 'owner'
    when 'w7-manual-handling' then 'owner'
    when 'w7-high-intensity' then 'owner'
    when 'w7-pbs' then 'owner'
    when 'w8-supervision' then 'owner'
    when 'w9-restrictive-practice' then 'owner'
    when 'w10-other-checks' then 'owner'
    else null
  end;
$$;
revoke all on function public.worker_item_owner_role(text) from public, anon;
grant execute on function public.worker_item_owner_role(text) to authenticated, service_role;

create or replace function public.worker_ensure_items(p_account uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_list uuid;
  v_item jsonb;
  v_id text;
  v_role text;
begin
  v_ref := public.worker_context(p_account);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 60 then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- Every id is checked before any row is written, so a bad list writes nothing.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_id := v_item->>'id';
    if v_id is null or public.worker_item_owner_role(v_id) is null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end loop;
  select o.id into v_list from public.onboarding_checklists o
   where o.account_id = p_account and o.kind = 'worker' and o.subject_ref = v_ref;
  if v_list is null then
    insert into public.onboarding_checklists (account_id, kind, subject_ref, started_on)
      values (p_account, 'worker', v_ref, public.sydney_today())
      returning id into v_list;
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_id := v_item->>'id';
    v_role := public.worker_item_owner_role(v_id);
    insert into public.onboarding_items (account_id, checklist_id, item_id, owner_role)
      values (p_account, v_list, v_id, v_role)
      on conflict (checklist_id, item_id) do nothing;
  end loop;
  return v_list;
end;
$$;
revoke all on function public.worker_ensure_items(uuid, jsonb) from public, anon;
grant execute on function public.worker_ensure_items(uuid, jsonb) to authenticated;

drop policy supervision_entries_delete_subscribed on public.supervision_entries;
create policy supervision_entries_delete_subscribed on public.supervision_entries
  for delete to authenticated using (
    public.is_member(account_id)
    and public.has_active_subscription(account_id)
    and created_at > now() - interval '24 hours'
  );

notify pgrst, 'reload schema';

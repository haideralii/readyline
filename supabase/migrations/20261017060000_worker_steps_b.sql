-- REQ-024 Session B (FR-7, FR-8, FR-9; SR-2; Data; D-2417 as amended, D-2429,
-- D-2438; Dev D-2282): the worker's own steps through the worker role.
--
-- 1. `policy_acknowledgements`: one row per worker, document and version
--    (W-3 the Code of Conduct acknowledgement, W-6 the mandatory policies),
--    append-only for clients: members read, the worker reads and inserts
--    their own rows (the code the membership carries, no other), the owner
--    inserts for any code of the account, nobody updates or deletes through
--    the API; writes are gated by the subscription as every register write
--    is, reads never (D-2415). The column is `document_type_id`, the name
--    `document_versions` uses, where the Data section wrote `document_slug`.
-- 2. `register_events.register` gains the table.
-- 3. `document_versions_worker`: the worker reads the type id, the version
--    and the adoption day of the account's adopted, ready document versions
--    (no content, no storage path, no model) through a `security_barrier`
--    view with the membership join inside, as the two A1 views do, so the
--    acknowledgement list stays inside RLS (Dev response question 3).
-- Revoke before grant throughout (D-2243, D-2245).

create table public.policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  worker_ref text not null check (worker_ref ~ '^W-?[0-9]{1,6}$'),
  document_type_id text not null check (document_type_id ~ '^[a-z0-9-]{1,80}$'),
  version integer not null check (version >= 1),
  acknowledged_on date not null default public.sydney_today(),
  created_at timestamptz not null default now(),
  unique (account_id, worker_ref, document_type_id, version)
);
create index policy_acknowledgements_worker_idx
  on public.policy_acknowledgements (account_id, worker_ref);

alter table public.policy_acknowledgements enable row level security;

create policy policy_acknowledgements_select_member on public.policy_acknowledgements
  for select to authenticated using (public.is_member(account_id));
create policy policy_acknowledgements_select_worker on public.policy_acknowledgements
  for select to authenticated using (
    public.is_worker(account_id)
    and exists (
      select 1 from public.memberships m
      where m.account_id = policy_acknowledgements.account_id
        and m.user_id = auth.uid() and m.role = 'worker'
        and m.worker_ref = policy_acknowledgements.worker_ref
    )
  );
create policy policy_acknowledgements_insert_owner on public.policy_acknowledgements
  for insert to authenticated with check (
    public.is_owner(account_id) and public.has_active_subscription(account_id)
  );
-- The worker's own code alone (AC-6: another worker's code answers 42501). A policy's subquery runs
-- under the caller's own policies: a worker reads their own membership row (memberships_select_own) and
-- no accounts row (accounts_select_member is is_member, which excludes the worker role), so the deleted-
-- account test is is_worker's, a security definer, and the subquery joins nothing the worker cannot read
-- (#102's run at 08249e0 read 42501 on this insert with the accounts join inside).
create policy policy_acknowledgements_insert_worker on public.policy_acknowledgements
  for insert to authenticated with check (
    public.is_worker(account_id)
    and public.has_active_subscription(account_id)
    and exists (
      select 1 from public.memberships m
      where m.account_id = policy_acknowledgements.account_id
        and m.user_id = auth.uid() and m.role = 'worker'
        and m.worker_ref = policy_acknowledgements.worker_ref
    )
  );
-- No update and no delete policy: an acknowledgement is a record.

revoke all on public.policy_acknowledgements from anon, authenticated;
grant select, insert on public.policy_acknowledgements to authenticated;

-- 2. The trail knows the register.
alter table public.register_events drop constraint register_events_register_check;
alter table public.register_events add constraint register_events_register_check check (register in (
  'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
  'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists',
  'hazards', 'incidents', 'complaints', 'worker_clearances',
  'onboarding_items', 'risk_assessed_roles', 'screening_exceptions',
  'policy_acknowledgements'
));

-- 3. The worker's read of the adopted documents' names and versions.
create view public.document_versions_worker with (security_barrier = true) as
select v.id, v.account_id, v.document_type_id, v.version, v.adopted_on
from public.document_versions v
where v.status = 'ready' and v.adopted_on is not null
  and exists (
    select 1 from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.account_id = v.account_id and m.user_id = auth.uid() and m.role = 'worker'
      and a.deleted_at is null
  );
revoke all on public.document_versions_worker from anon, authenticated;
grant select on public.document_versions_worker to authenticated, service_role;

-- 4. W-1 is the worker's step (D-2834; #102's run at fbd82b6): the worker may
--    type the application number before the owner has made a row, so this
--    function finds the worker's own NDIS Worker Screening row or makes the
--    pending one under their code, then writes the three fields as
--    worker_update_clearance does. Every refusal is 42501 "not allowed"; a new
--    row needs the application number (the pending CHECK), which the action
--    asks for in words first.
create or replace function public.worker_record_clearance(
  p_account uuid,
  p_application_number text,
  p_clearance_number text,
  p_expires_on date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_id uuid;
  v_role text;
begin
  v_ref := public.worker_context(p_account);
  select c.id into v_id
  from public.worker_clearances c
  where c.account_id = p_account and c.worker_ref = v_ref and c.clearance_kind = 'ndis-worker-screening'
  order by c.created_at desc
  limit 1;
  if v_id is not null then
    update public.worker_clearances
       set application_number = coalesce(p_application_number, application_number),
           clearance_number = coalesce(p_clearance_number, clearance_number),
           expires_on = coalesce(p_expires_on, expires_on)
     where id = v_id;
    insert into public.register_events (account_id, register, row_id, actor_user_id, kind, note)
      values (p_account, 'worker_clearances', v_id, auth.uid(), 'updated',
              'numbers and expiry typed by the worker; waiting for the manager to confirm');
    return v_id;
  end if;
  if coalesce(p_application_number, '') = '' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select s.role_label into v_role from public.staff_matrix s
   where s.account_id = p_account and s.worker_ref = v_ref;
  insert into public.worker_clearances (account_id, worker_ref, role_label, clearance_kind, application_number, clearance_number, expires_on)
    values (p_account, v_ref, coalesce(v_role, 'worker'), 'ndis-worker-screening', p_application_number, coalesce(p_clearance_number, ''), p_expires_on)
    returning id into v_id;
  insert into public.register_events (account_id, register, row_id, actor_user_id, kind, note)
    values (p_account, 'worker_clearances', v_id, auth.uid(), 'created',
            'application recorded by the worker; waiting for the manager to confirm');
  return v_id;
end;
$$;
revoke all on function public.worker_record_clearance(uuid, text, text, date) from public, anon;
grant execute on function public.worker_record_clearance(uuid, text, text, date) to authenticated;

notify pgrst, 'reload schema';

-- REQ-029 Session A (D-2854, D-2855; Dev D-2290): the approver is a snapshot
-- taken at adoption, never the live account. The version a provider adopts
-- records who approved it and in what role that day, beside `adopted_on`;
-- adopted documents fill their Approver row, approval date, responsibilities
-- role and change-log author from these columns alone, and a later change of
-- name or role is a re-approval that writes a new version with its own
-- snapshot (FR-5, FR-6). Timestamped after every migration on `next` and on
-- the open branches at the push (D-2835: the latest is 20261017150000).
--
-- 1. The two columns, at most 200 characters each (SR-6), and the rule that
--    a snapshot is never updated in place: once written, the pair is fixed
--    for that version (the D-2440 pattern, a trigger that refuses the move).
-- 2. `adopt_document_version` reads the account's `name` and `role` rows
--    from `account_facts` inside the function (security definer), so the
--    snapshot is never client-supplied; a missing or blank name refuses the
--    adoption with P0004, which the action answers in FR-5's words. For a
--    carried adoption (D-2449: the service role passing an earlier version's
--    day onto the re-rendered version) the snapshot is copied from the newest
--    adopted version of the type, so the words the earlier approver signed
--    stay theirs; the live facts are the fallback.
-- No migration rewrites a stored document's text (FR-9).

alter table public.document_versions
  add column if not exists approver_name text
    check (approver_name is null or char_length(btrim(approver_name)) between 1 and 200),
  add column if not exists approver_role text
    check (approver_role is null or char_length(btrim(approver_role)) between 1 and 200);

comment on column public.document_versions.approver_name is
  'REQ-029 D-2855: the approver''s name as the account held it on the adoption day; written by adopt_document_version alone, never updated.';
comment on column public.document_versions.approver_role is
  'REQ-029 D-2855: the approver''s role on the adoption day; written by adopt_document_version alone, never updated.';

create or replace function public.document_versions_snapshot_guard()
returns trigger
language plpgsql
as $$
begin
  if old.approver_name is not null
     and (new.approver_name is distinct from old.approver_name
          or new.approver_role is distinct from old.approver_role) then
    raise exception 'approver snapshot is fixed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists document_versions_snapshot_guard on public.document_versions;
create trigger document_versions_snapshot_guard
  before update of approver_name, approver_role on public.document_versions
  for each row execute function public.document_versions_snapshot_guard();

create or replace function public.adopt_document_version(
  p_account uuid,
  p_version uuid,
  p_adopted_on date default null
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Australia/Sydney')::date;
  v_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  v_day date;
  v_row record;
  v_newest uuid;
  v_name text;
  v_role text;
  v_carry boolean := false;
begin
  v_day := case when v_service and p_adopted_on is not null then least(p_adopted_on, v_today) else v_today end;
  v_carry := v_service and p_adopted_on is not null;
  if not (public.is_owner(p_account) or v_service) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_service and not exists (
    select 1 from public.accounts a where a.id = p_account and a.deleted_at is null
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select dv.id, dv.account_id, dv.version_set_id, dv.document_type_id, dv.version
    into v_row
  from public.document_versions dv
  where dv.id = p_version;
  if v_row.id is null or v_row.account_id <> p_account then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- The version's set must be the account's newest ready set (finding 206).
  select vs.id into v_newest
  from public.version_sets vs
  where vs.account_id = p_account and vs.status = 'ready'
  order by vs.created_at desc
  limit 1;
  if v_newest is null or v_newest <> v_row.version_set_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- And the latest version of its type in that set.
  if exists (
    select 1 from public.document_versions d
    where d.version_set_id = v_row.version_set_id
      and d.document_type_id = v_row.document_type_id
      and d.version > v_row.version
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- REQ-029 D-2855: the snapshot. A carried adoption copies the newest
  -- adopted version's approver; otherwise the account's facts of today.
  if v_carry then
    select d.approver_name, d.approver_role into v_name, v_role
    from public.document_versions d
    where d.account_id = p_account
      and d.document_type_id = v_row.document_type_id
      and d.adopted_on is not null
      and d.approver_name is not null
      and d.id <> p_version
    order by d.version desc, d.created_at desc
    limit 1;
  end if;
  if v_name is null then
    select btrim(f.value) into v_name from public.account_facts f
    where f.account_id = p_account and f.key = 'name';
    select btrim(f.value) into v_role from public.account_facts f
    where f.account_id = p_account and f.key = 'role';
  end if;
  if v_name is null or v_name = '' then
    raise exception 'approver name missing' using errcode = 'P0004';
  end if;
  if v_role = '' then v_role := null; end if;

  update public.document_versions
  set adopted_on = v_day,
      approver_name = coalesce(approver_name, v_name),
      approver_role = coalesce(approver_role, v_role)
  where id = p_version;

  -- The mirror (D-2443): the seeded row's shape (seed.ts), created when the
  -- checklist tick comes before the register was seeded; `adopted_on` keeps
  -- its first date, `last_reviewed_on` never moves backwards (the carried
  -- day of D-2449 is at or before the first adoption's), so the row's CHECK
  -- holds.
  perform set_config('readyline.adopting', 'on', true);
  insert into public.policy_reviews
    (account_id, document_type_id, title, review_cycle_months, adopted_on, last_reviewed_on)
  values (
    p_account, v_row.document_type_id, '',
    case when v_row.document_type_id ~ 'register' then 3 else 12 end,
    v_day, v_day
  )
  on conflict (account_id, document_type_id, title) do update
    set adopted_on = coalesce(public.policy_reviews.adopted_on, excluded.adopted_on),
        last_reviewed_on = greatest(
          excluded.last_reviewed_on,
          public.policy_reviews.last_reviewed_on,
          public.policy_reviews.adopted_on
        );
  perform set_config('readyline.adopting', '', true);
  return v_day;
end;
$$;

revoke all on function public.adopt_document_version(uuid, uuid, date) from public, anon;
grant execute on function public.adopt_document_version(uuid, uuid, date) to authenticated, service_role;

notify pgrst, 'reload schema';

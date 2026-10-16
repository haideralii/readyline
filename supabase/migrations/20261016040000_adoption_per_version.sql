-- REQ-024 Session A0: adoption per version (D-2427, D-2431, D-2432, D-2435,
-- D-2436, D-2437, D-2440, D-2442, D-2443; findings 143, 145, 146, 172, 173,
-- 175, 177 to 180, 199 to 206, 214, 216, 230, 231, 234, 240). The date a
-- document was adopted moves from the type's policy review row to the
-- version itself, written by one function; the register and the path read
-- the newest ready set's versions; the policy review row stays the mirror for
-- `next_review_on` and is guarded against a client moving a catalogue type's
-- date.

-- ---------------------------------------------------------------------------
-- 1. Grants first (D-2243, D-2245: revoke all, then the verbs). Both tables
--    held a grant and no revoke, so the CLI stack's defaults left every verb.
-- ---------------------------------------------------------------------------
revoke all on public.document_versions from anon, authenticated;
grant select on public.document_versions to authenticated;
revoke all on public.memberships from anon, authenticated;
grant select, delete on public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The column: a date, set in Sydney inside the function (finding 180), and
--    its partial index for the "older adopted version" read (finding 216).
-- ---------------------------------------------------------------------------
alter table public.document_versions add column if not exists adopted_on date;
create index if not exists document_versions_adopted_idx
  on public.document_versions (account_id, document_type_id)
  where adopted_on is not null;

-- ---------------------------------------------------------------------------
-- 3. Backfill (D-2432): the latest version of each type in each account's
--    newest ready set takes the seeded policy review row's date (title = ''),
--    capped at today, only where the column is null; a catalogue type's row
--    dated in the future is capped too, so the mirror never disagrees with
--    the version. Idempotent. The guard trigger below is created after this,
--    and the GUC is set as any later fix must (D-2442).
-- ---------------------------------------------------------------------------
select set_config('readyline.adopting', 'on', true);

with newest as (
  select distinct on (vs.account_id) vs.id as set_id, vs.account_id
  from public.version_sets vs
  where vs.status = 'ready'
  order by vs.account_id, vs.created_at desc
),
latest as (
  select distinct on (dv.version_set_id, dv.document_type_id)
    dv.id, dv.account_id, dv.document_type_id
  from public.document_versions dv
  join newest n on n.set_id = dv.version_set_id
  order by dv.version_set_id, dv.document_type_id, dv.version desc
)
update public.document_versions dv
set adopted_on = least(pr.adopted_on, (now() at time zone 'Australia/Sydney')::date)
from latest l
join public.policy_reviews pr
  on pr.account_id = l.account_id
 and pr.document_type_id = l.document_type_id
 and pr.title = ''
where dv.id = l.id
  and dv.adopted_on is null
  and pr.adopted_on is not null;

update public.policy_reviews
set adopted_on = (now() at time zone 'Australia/Sydney')::date
where document_type_id <> 'other'
  and adopted_on > (now() at time zone 'Australia/Sydney')::date;

select set_config('readyline.adopting', '', true);

-- ---------------------------------------------------------------------------
-- 4. The guard (D-2442): a catalogue type's `adopted_on` on the register is
--    read-only for a client; only the function (through the transaction-local
--    GUC) or the service role may set or move it. `other` rows stay typed.
-- ---------------------------------------------------------------------------
create or replace function public.policy_reviews_adopted_on_guard()
returns trigger
language plpgsql
as $$
begin
  if new.document_type_id <> 'other'
     and (
       (tg_op = 'INSERT' and new.adopted_on is not null)
       or (tg_op = 'UPDATE' and new.adopted_on is distinct from old.adopted_on)
     )
     and coalesce(current_setting('readyline.adopting', true), '') <> 'on'
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
  then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists policy_reviews_adopted_on_guard on public.policy_reviews;
create trigger policy_reviews_adopted_on_guard
  before insert or update on public.policy_reviews
  for each row execute function public.policy_reviews_adopted_on_guard();

-- ---------------------------------------------------------------------------
-- 5. The one writer (D-2437, D-2443): the owner, or the server under the
--    service role (the path and the checklist write with the admin client,
--    D-1706), adopts the latest version of a type in the account's newest
--    ready set; the policy review row is upserted as the mirror. Every
--    refusal is 42501 "not allowed", as `next_register_reference` does.
--    D-2449: `p_adopted_on` carries an earlier version's day onto the
--    version the adopt step's own re-render wrote (the same words with the
--    dates filled in); null means Sydney today, and a date is honoured for
--    the service role alone, so every owner's call is dated today.
-- ---------------------------------------------------------------------------
drop function if exists public.adopt_document_version(uuid, uuid);
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
begin
  v_day := case when v_service and p_adopted_on is not null then least(p_adopted_on, v_today) else v_today end;
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

  update public.document_versions set adopted_on = v_day where id = p_version;

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

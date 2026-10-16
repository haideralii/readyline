-- REQ-024 Session A1: worker onboarding, the data and the lists (FR-1, FR-2,
-- FR-5, SR-2, Data; D-2416, D-2417, D-2419, D-2423, D-2429, D-2430, D-2431,
-- D-2438, D-2444, D-2445; findings 44, 58, 65, 103, 127, 128, 141, 142, 143,
-- 151, 152, 153, 157, 175, 176, 182, 183, 184, 189, 211, 212, 215 and 241).
-- Workers stay codes: no name, no date of birth, no address anywhere here.
--
-- 1. `risk_assessed_roles`: the s 17 list's data, owner-only.
-- 2. `staff_matrix`: the FR-1 columns.
-- 3. `onboarding_items`: the mutable state per (checklist, item); the ticks
--    stay append-only and lose their unique key (one actor may change an item
--    twice on a day); the items statement writes one row per existing worker
--    checklist item under the W id, reading the latest tick under the old id.
-- 4. `worker_clearances`: two kinds, the application number, the database
--    verification date, a pending row (no `issued_on`) with its CHECK.
-- 5. The two status views re-created on the Sydney day (`pending` first for
--    the clearances), the two worker views without `note`, the worker's
--    `is_worker` select policies, the owner's tick `with check`.
-- 6. The three worker functions and `set_owner_worker_ref`, every refusal
--    42501 "not allowed".
-- 7. The trail's registers and kinds, the reminders' kind and subject table.

-- ---------------------------------------------------------------------------
-- 1. risk_assessed_roles (D-2416; finding 44)
-- ---------------------------------------------------------------------------
create table public.risk_assessed_roles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80 and not public.looks_like_ndis_number(title)),
  -- s 5's paragraphs (a), (b), (c) that apply.
  paragraphs text[] not null default '{}' check (paragraphs <@ array['a', 'b', 'c']::text[]),
  description text not null default '' check (char_length(description) <= 500 and not public.looks_like_ndis_number(description)),
  assessed_on date,
  -- The owner's KP- code or a worker's W- code; the assessor's name is a fill field (D-2408), never stored.
  assessor_ref text check (assessor_ref is null or assessor_ref ~ '^(W|KP)-?[0-9]{1,6}$'),
  -- The reminder clock: the day the first current matrix row referenced the role (D-2416).
  first_held_on date,
  -- The six closed roles are seeded per account; a seeded row carries its role code so the seed is idempotent.
  seed_code text check (seed_code is null or seed_code in ('support-worker', 'team-leader', 'key-personnel', 'admin', 'contractor', 'volunteer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, seed_code)
);
create index risk_assessed_roles_account_idx on public.risk_assessed_roles (account_id);
create trigger risk_assessed_roles_set_updated_at
  before update on public.risk_assessed_roles
  for each row execute function public.set_updated_at();
alter table public.risk_assessed_roles enable row level security;
create policy risk_assessed_roles_select_owner on public.risk_assessed_roles
  for select to authenticated using (public.is_owner(account_id));
create policy risk_assessed_roles_insert_owner on public.risk_assessed_roles
  for insert to authenticated with check (public.is_owner(account_id) and public.has_active_subscription(account_id));
create policy risk_assessed_roles_update_owner on public.risk_assessed_roles
  for update to authenticated
  using (public.is_owner(account_id) and public.has_active_subscription(account_id))
  with check (public.is_owner(account_id) and public.has_active_subscription(account_id));
create policy risk_assessed_roles_delete_owner on public.risk_assessed_roles
  for delete to authenticated using (public.is_owner(account_id));
revoke all on public.risk_assessed_roles from anon, authenticated;
grant select, insert, update, delete on public.risk_assessed_roles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. staff_matrix: the FR-1 columns (findings 58 and 81)
-- ---------------------------------------------------------------------------
alter table public.staff_matrix
  add column role text check (role is null or role in ('support-worker', 'team-leader', 'key-personnel', 'admin', 'contractor', 'volunteer')),
  add column states text[] not null default '{}' check (states <@ array['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']::text[]),
  add column works_with_children boolean not null default false,
  add column may_use_restrictive_practice boolean not null default false,
  add column ended_on date,
  add column role_ref uuid references public.risk_assessed_roles (id) on delete set null,
  add column risk_assessed_from date,
  -- s 5's paragraph the owner chose, asked for every row (findings 43 and 75); null for a row that is not risk assessed.
  add column risk_paragraph text check (risk_paragraph is null or risk_paragraph in ('a', 'b', 'c'));

-- ---------------------------------------------------------------------------
-- 3. onboarding_items (D-2419, D-2423, D-2430; findings 65, 103, 127, 141, 189)
-- ---------------------------------------------------------------------------
create table public.onboarding_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  checklist_id uuid not null references public.onboarding_checklists (id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{1,60}$'),
  owner_role text not null check (owner_role in ('owner', 'worker', 'both')),
  done_on date,
  confirmed_on date,
  -- D-2438: the owner recorded the worker's own date for a worker who never signs in.
  recorded_by_owner boolean not null default false,
  note text not null default '' check (char_length(note) <= 500 and not public.looks_like_ndis_number(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checklist_id, item_id)
);
create index onboarding_items_checklist_idx on public.onboarding_items (checklist_id);
create trigger onboarding_items_set_updated_at
  before update on public.onboarding_items
  for each row execute function public.set_updated_at();
alter table public.onboarding_items enable row level security;
create policy onboarding_items_select_member on public.onboarding_items
  for select to authenticated using (public.is_member(account_id));
create policy onboarding_items_insert_subscribed on public.onboarding_items
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy onboarding_items_update_subscribed on public.onboarding_items
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
-- SR-2: the worker reads their own items through the checklist's code; no worker write policy anywhere.
create policy onboarding_items_select_worker on public.onboarding_items
  for select to authenticated using (
    public.is_worker(account_id)
    and exists (
      select 1 from public.onboarding_checklists o
      join public.memberships m on m.account_id = o.account_id and m.user_id = auth.uid() and m.role = 'worker'
      where o.id = onboarding_items.checklist_id and o.kind = 'worker' and o.subject_ref = m.worker_ref
    )
  );
revoke all on public.onboarding_items from anon, authenticated;
grant select, insert, update on public.onboarding_items to authenticated;

create policy onboarding_checklists_select_worker on public.onboarding_checklists
  for select to authenticated using (
    public.is_worker(account_id)
    and kind = 'worker'
    and exists (
      select 1 from public.memberships m
      where m.account_id = onboarding_checklists.account_id and m.user_id = auth.uid() and m.role = 'worker'
        and m.worker_ref = onboarding_checklists.subject_ref
    )
  );

-- The ticks lose their unique key (D-2430): `ticked_on` is a date, and one actor's two changes on a day are two rows.
do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'public.onboarding_ticks'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) = 'UNIQUE (checklist_id, item_id)';
  if v_name is not null then
    execute format('alter table public.onboarding_ticks drop constraint %I', v_name);
  end if;
end
$$;
create index if not exists onboarding_ticks_item_idx on public.onboarding_ticks (checklist_id, item_id, ticked_on);

-- The owner's tick (D-2438 as amended, D-2444): the actor is the caller (a null actor is refused too, since
-- `null = auth.uid()` is null), and on a worker checklist `ticked_by_ref` is a KP- code or the owner's own code.
drop policy onboarding_ticks_insert_subscribed on public.onboarding_ticks;
create policy onboarding_ticks_insert_subscribed on public.onboarding_ticks
  for insert to authenticated with check (
    public.is_member(account_id)
    and public.has_active_subscription(account_id)
    and actor_user_id = auth.uid()
    and exists (
      select 1 from public.onboarding_checklists o
      where o.id = onboarding_ticks.checklist_id and o.account_id = onboarding_ticks.account_id
        and (
          o.kind <> 'worker'
          or onboarding_ticks.ticked_by_ref ~ '^KP-?[0-9]{1,6}$'
          or onboarding_ticks.ticked_by_ref = (
            select m.worker_ref from public.memberships m
            where m.account_id = onboarding_ticks.account_id and m.user_id = auth.uid() and m.role = 'owner'
          )
        )
    )
  );
-- The worker reads the ticks on their own checklist (their own and the owner's confirmation) and inserts none directly.
create policy onboarding_ticks_select_worker on public.onboarding_ticks
  for select to authenticated using (
    public.is_worker(account_id)
    and exists (
      select 1 from public.onboarding_checklists o
      join public.memberships m on m.account_id = o.account_id and m.user_id = auth.uid() and m.role = 'worker'
      where o.id = onboarding_ticks.checklist_id and o.kind = 'worker' and o.subject_ref = m.worker_ref
    )
  );

-- The items statement (Dev answer 1; finding 68): one row per existing worker checklist item under the W id,
-- `done_on` and `confirmed_on` both the latest tick's day where a tick exists (every tick so far is the owner's),
-- `owner_role` from the derived list. Ticks keep their old ids as dated evidence.
insert into public.onboarding_items (account_id, checklist_id, item_id, owner_role, done_on, confirmed_on)
select o.account_id, o.id, m.new_id, m.owner_role, t.ticked_on, t.ticked_on
from public.onboarding_checklists o
cross join (
  values
    ('identity-and-agreement', 'identity-and-agreement', 'owner'),
    ('screening-clearance-seen', 'w1-clearance', 'owner'),
    ('other-checks-recorded', 'w10-other-checks', 'owner'),
    ('orientation-module', 'w4-orientation-module', 'both'),
    ('policies-walked-through', 'w6-policies', 'both'),
    ('participant-plans-read', 'participant-plans-read', 'both'),
    ('emergency-plan-shown', 'emergency-plan-shown', 'owner'),
    ('supervision-booked', 'w8-supervision', 'owner')
) as m (old_id, new_id, owner_role)
left join lateral (
  select t.ticked_on from public.onboarding_ticks t
  where t.checklist_id = o.id and t.item_id = m.old_id
  order by t.ticked_on desc limit 1
) t on true
where o.kind = 'worker'
on conflict (checklist_id, item_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. worker_clearances (FR-5; D-2419; findings 65, 109, 128, 142, 157)
-- ---------------------------------------------------------------------------
alter table public.worker_clearances drop constraint if exists worker_clearances_clearance_kind_check;
alter table public.worker_clearances add constraint worker_clearances_clearance_kind_check check (clearance_kind in (
  'ndis-worker-screening', 'wwcc', 'police-check', 'first-aid', 'ndis-worker-orientation-module',
  'manual-handling', 'medication', 'cpr', 'driver-licence', 'other'
));
alter table public.worker_clearances
  add column application_number text not null default ''
    check (
      char_length(application_number) <= 40
      and application_number ~ '^[A-Za-z0-9 /-]*$'
      and not public.looks_like_ndis_number(application_number)
    ),
  -- The day the owner checked the application or clearance in the NDIS Worker Screening Database (s 15(4)); the owner's alone.
  add column verified_in_database_on date;
alter table public.worker_clearances alter column issued_on drop not null;
do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'public.worker_clearances'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%expires_on >= issued_on%';
  if v_name is not null then
    execute format('alter table public.worker_clearances drop constraint %I', v_name);
  end if;
end
$$;
alter table public.worker_clearances
  add constraint worker_clearances_expires_on_check check (expires_on is null or issued_on is null or expires_on >= issued_on),
  -- A pending application is a row with the number and no issued date (finding 157).
  add constraint worker_clearances_pending_check check (issued_on is not null or application_number <> '');

-- ---------------------------------------------------------------------------
-- 5. The views (findings 142, 176, 182, 215; D-2429, D-2445). A `select *`
--    view freezes its columns, so both status views are re-created with the
--    new columns and their grants restored (the batch 45 lesson), their day
--    the Sydney day in place of `current_date` (D-2242 applies to the views).
-- ---------------------------------------------------------------------------
drop view public.worker_clearances_status;
create view public.worker_clearances_status
with (security_invoker = true) as
select
  c.*,
  case
    when c.issued_on is null then 'pending'
    when c.expires_on is null then 'valid'
    when c.expires_on < (now() at time zone 'Australia/Sydney')::date then 'expired'
    when c.expires_on <= (now() at time zone 'Australia/Sydney')::date + 90 then 'expiring'
    else 'valid'
  end as status
from public.worker_clearances c;

drop view public.staff_matrix_status;
create view public.staff_matrix_status with (security_invoker = true) as
select
  s.*,
  case
    when s.last_supervision_on is null or s.last_supervision_on < (now() at time zone 'Australia/Sydney')::date - 31 then 'supervision-overdue'
    when s.last_appraisal_on is null or s.last_appraisal_on < (now() at time zone 'Australia/Sydney')::date - 365 then 'appraisal-overdue'
    else 'current'
  end as status,
  (
    select count(*) from public.worker_clearances c
    where c.account_id = s.account_id and c.worker_ref = s.worker_ref
      and c.issued_on is not null
      and c.expires_on is not null and c.expires_on < (now() at time zone 'Australia/Sydney')::date
  ) as expired_checks,
  (
    select count(*) from public.worker_clearances c
    where c.account_id = s.account_id and c.worker_ref = s.worker_ref
      and c.issued_on is not null
      and c.expires_on is not null
      and c.expires_on >= (now() at time zone 'Australia/Sydney')::date
      and c.expires_on <= (now() at time zone 'Australia/Sydney')::date + 90
  ) as expiring_checks
from public.staff_matrix s;

-- D-2245 (#82's run 38911618628): a re-created view takes the CLI stack's default privileges, every verb for
-- `authenticated`, so the revoke comes first and `select` alone is re-stated.
revoke all on public.worker_clearances_status, public.staff_matrix_status from anon, authenticated;
grant select on public.worker_clearances_status, public.staff_matrix_status to authenticated, service_role;

-- The worker's two views (D-2429; findings 153 and 182): every column but `note`, listed by name, the
-- membership filter inside, run as the view's owner (the worker holds no select policy on either base table),
-- `security_barrier` so a caller's predicate is never planned below the filter. Any later column on either
-- table re-creates these two as well.
create view public.staff_matrix_worker with (security_barrier = true) as
select
  s.id, s.account_id, s.worker_ref, s.role_label, s.qualifications, s.risk_assessed,
  s.started_on, s.last_supervision_on, s.last_appraisal_on, s.onboarding_signed_on,
  s.role, s.states, s.works_with_children, s.may_use_restrictive_practice, s.ended_on,
  s.role_ref, s.risk_assessed_from, s.risk_paragraph, s.created_at, s.updated_at
from public.staff_matrix s
where exists (
  select 1 from public.memberships m
  join public.accounts a on a.id = m.account_id
  where m.account_id = s.account_id and m.user_id = auth.uid() and m.role = 'worker'
    and m.worker_ref = s.worker_ref and a.deleted_at is null
);
create view public.worker_clearances_worker with (security_barrier = true) as
select
  c.id, c.account_id, c.worker_ref, c.role_label, c.clearance_kind, c.issued_on, c.expires_on,
  c.state, c.clearance_number, c.application_number, c.verified_in_database_on, c.created_at, c.updated_at
from public.worker_clearances c
where exists (
  select 1 from public.memberships m
  join public.accounts a on a.id = m.account_id
  where m.account_id = c.account_id and m.user_id = auth.uid() and m.role = 'worker'
    and m.worker_ref = c.worker_ref and a.deleted_at is null
);
revoke all on public.staff_matrix_worker, public.worker_clearances_worker from anon, authenticated;
grant select on public.staff_matrix_worker, public.worker_clearances_worker to authenticated, service_role;

-- The worker's own notice (AC-11, finding 106): an instant, so `timestamptz`.
alter table public.memberships add column notice_seen_at timestamptz;

-- ---------------------------------------------------------------------------
-- 6. The functions (D-2417, D-2431, D-2444; findings 143, 144, 151, 152, 184,
--    241): the worker's only write path and the owner's write on a table
--    where `authenticated` holds no `update`. Every refusal is 42501 "not
--    allowed" with no reason beyond it (the `next_register_reference` pattern).
-- ---------------------------------------------------------------------------
create or replace function public.worker_context(p_account uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ref text;
begin
  select m.worker_ref into v_ref
  from public.memberships m
  join public.accounts a on a.id = m.account_id
  where m.account_id = p_account and m.user_id = auth.uid() and m.role = 'worker' and a.deleted_at is null;
  if v_ref is null or not public.has_active_subscription(p_account) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return v_ref;
end;
$$;
revoke all on function public.worker_context(uuid) from public, anon;
grant execute on function public.worker_context(uuid) to authenticated, service_role;

create or replace function public.worker_update_item(p_item uuid, p_done_on date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_ref text;
  v_today date := (now() at time zone 'Australia/Sydney')::date;
begin
  select i.id, i.account_id, i.checklist_id, o.subject_ref, o.kind
    into v_item
  from public.onboarding_items i
  join public.onboarding_checklists o on o.id = i.checklist_id
  where i.id = p_item;
  if v_item.id is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_ref := public.worker_context(v_item.account_id);
  if v_item.kind <> 'worker' or v_item.subject_ref <> v_ref then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.onboarding_items set done_on = p_done_on, recorded_by_owner = false where id = p_item;
  insert into public.onboarding_ticks (checklist_id, account_id, item_id, ticked_on, ticked_by_ref, actor_user_id)
    select i.checklist_id, i.account_id, i.item_id, v_today, v_ref, auth.uid()
    from public.onboarding_items i where i.id = p_item;
  insert into public.register_events (account_id, register, row_id, actor_user_id, kind, note)
    values (v_item.account_id, 'onboarding_items', p_item, auth.uid(), 'updated',
            'done on ' || coalesce(p_done_on::text, 'no date') || ', recorded by the worker');
end;
$$;
revoke all on function public.worker_update_item(uuid, date) from public, anon;
grant execute on function public.worker_update_item(uuid, date) to authenticated;

create or replace function public.worker_update_clearance(
  p_clearance uuid,
  p_application_number text,
  p_clearance_number text,
  p_expires_on date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_ref text;
begin
  select c.id, c.account_id, c.worker_ref, c.clearance_kind into v_row
  from public.worker_clearances c where c.id = p_clearance;
  if v_row.id is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_ref := public.worker_context(v_row.account_id);
  -- Finding 151: the worker writes the NDIS worker screening row alone; every other kind is the owner's, typed from the certificate.
  if v_row.worker_ref <> v_ref or v_row.clearance_kind <> 'ndis-worker-screening' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.worker_clearances
     set application_number = coalesce(p_application_number, application_number),
         clearance_number = coalesce(p_clearance_number, clearance_number),
         expires_on = coalesce(p_expires_on, expires_on)
   where id = p_clearance;
  insert into public.register_events (account_id, register, row_id, actor_user_id, kind, note)
    values (v_row.account_id, 'worker_clearances', p_clearance, auth.uid(), 'updated',
            'numbers and expiry typed by the worker; waiting for the manager to confirm');
end;
$$;
revoke all on function public.worker_update_clearance(uuid, text, text, date) from public, anon;
grant execute on function public.worker_update_clearance(uuid, text, text, date) to authenticated;

create or replace function public.worker_notice_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.memberships m
     set notice_seen_at = coalesce(m.notice_seen_at, now())
    from public.accounts a
   where a.id = m.account_id and m.user_id = auth.uid() and m.role = 'worker' and a.deleted_at is null;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.worker_notice_seen() from public, anon;
grant execute on function public.worker_notice_seen() to authenticated;

-- The owner's own row (D-2431 as amended; findings 64, 143 and 184): the membership takes the row's code once;
-- a code another membership of the account holds, a code no matrix row carries, or a membership already pointed
-- are each refused, so the owner never reads a worker's rows through the worker views by sharing a code.
create or replace function public.set_owner_worker_ref(p_membership uuid, p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m record;
begin
  select m.id, m.account_id, m.user_id, m.role, m.worker_ref into v_m
  from public.memberships m where m.id = p_membership;
  if v_m.id is null or v_m.user_id <> auth.uid() or v_m.role <> 'owner' or not public.is_owner(v_m.account_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_m.worker_ref is not null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_ref is null or p_ref !~ '^W-?[0-9]{1,6}$' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.memberships m where m.account_id = v_m.account_id and m.worker_ref = p_ref) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.staff_matrix s where s.account_id = v_m.account_id and s.worker_ref = p_ref) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.memberships set worker_ref = p_ref where id = p_membership;
end;
$$;
revoke all on function public.set_owner_worker_ref(uuid, text) from public, anon;
grant execute on function public.set_owner_worker_ref(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. The trail and the reminders (finding 66; D-2416)
-- ---------------------------------------------------------------------------
alter table public.register_events drop constraint register_events_register_check;
alter table public.register_events add constraint register_events_register_check check (register in (
  'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
  'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists',
  'hazards', 'incidents', 'complaints', 'worker_clearances',
  'onboarding_items', 'risk_assessed_roles'
));
alter table public.register_events drop constraint register_events_kind_check;
alter table public.register_events add constraint register_events_kind_check check (kind in (
  'created', 'note', 'reviewed', 'updated', 'closed', 'imported',
  'confirmed', 'role-changed', 'ended'
));

alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders
  add constraint reminders_kind_check check (kind in (
    'clearance-expiry', 'policy-review', 'mid-term-audit', 'renewal',
    'incident-open', 'complaint-unacknowledged', 'reportable-not-notified',
    'insurance-expiry', 'supervision-due', 'appraisal-due',
    'support-plan-review', 'emergency-drill', 'register-review',
    'report-to-confirm',
    'midterm-prepare', 'midterm-start-by', 'renewal-window', 'renewal-apply-by', 'renewal-last-call',
    'role-assessment-due'
  ));
alter table public.reminders drop constraint if exists reminders_subject_table_check;
alter table public.reminders add constraint reminders_subject_table_check check (subject_table in (
  'incidents', 'complaints', 'worker_clearances', 'policy_reviews', 'accounts',
  'insurance_items', 'staff_matrix', 'participant_risks', 'corporate_risks', 'conflicts_of_interest',
  'hazards', 'registration_periods', 'risk_assessed_roles'
));

notify pgrst, 'reload schema';

-- REQ-024 Session A2: the s 14 exception and the unit's decision (FR-4, FR-5,
-- Data; D-2413, D-2434 as amended, D-2439 as amended; findings 168, 174,
-- 208, 213, 219, 227 and 246).
--
-- 1. `worker_clearances.decision_code` and `decision_on`: the unit's decision
--    as a closed code with a date, never free text (D-2413).
-- 2. The two views over `worker_clearances` re-created so the two columns
--    read back through both (a `select *` view freezes its columns; the
--    worker's view lists columns by name), revoke before grant (D-2245).
-- 3. `screening_exceptions`: one row per exception with its dated lines, the
--    supervisor, the pinned procedure version, the register's date, the end
--    code and date, and the CHECKs Data spells; one open row per worker;
--    owner-only RLS; grants per verb with the revoke first and no delete.
-- 4. The trail's register and kinds.

-- ---------------------------------------------------------------------------
-- 1. The unit's decision (D-2413, D-2434)
-- ---------------------------------------------------------------------------
alter table public.worker_clearances
  add column decision_code text check (decision_code is null or decision_code in ('interim-bar', 'suspended', 'revoked', 'excluded', 'other')),
  add column decision_on date,
  add constraint worker_clearances_decision_check check ((decision_code is null) = (decision_on is null));
comment on column public.worker_clearances.decision_code is 'The screening unit''s decision as a closed code (D-2413); the unit''s letter is the provider''s s 18(4) copy. Read as not cleared by the derived state.';

-- ---------------------------------------------------------------------------
-- 2. The two views over worker_clearances (findings 142, 176, 182, 215)
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
revoke all on public.worker_clearances_status from anon, authenticated;
grant select on public.worker_clearances_status to authenticated, service_role;

drop view public.worker_clearances_worker;
create view public.worker_clearances_worker with (security_barrier = true) as
select
  c.id, c.account_id, c.worker_ref, c.role_label, c.clearance_kind, c.issued_on, c.expires_on,
  c.state, c.clearance_number, c.application_number, c.verified_in_database_on,
  c.decision_code, c.decision_on, c.created_at, c.updated_at
from public.worker_clearances c
where exists (
  select 1 from public.memberships m
  join public.accounts a on a.id = m.account_id
  where m.account_id = c.account_id and m.user_id = auth.uid() and m.role = 'worker'
    and m.worker_ref = c.worker_ref and a.deleted_at is null
);
revoke all on public.worker_clearances_worker from anon, authenticated;
grant select on public.worker_clearances_worker to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. screening_exceptions (D-2434 as amended, D-2439 as amended)
-- ---------------------------------------------------------------------------
create table public.screening_exceptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  worker_ref text not null check (worker_ref ~ '^W-?[0-9]{1,6}$'),
  -- The pending `ndis-worker-screening` row; null for a student (s14-1c) or a past Part 4 row (finding 213).
  clearance_id uuid references public.worker_clearances (id),
  -- The five exceptions of s 14 (W-1a): (1)(a) pending with supervision and the plan, (1)(b) Part 4, (1)(c) the
  -- supervised student, (2)(a) and (2)(b) the same two for the individual provider. The product gates (1)(a)
  -- and (2)(a); the other three are the owner's own call, a code and dates.
  code text not null check (code in ('s14-1a', 's14-1b', 's14-1c', 's14-2a', 's14-2b')),
  -- The state whose Part 4 section a (1)(b) or (2)(b) row relied on (s 14(1)(b)(i)); the export prints it.
  part4_state text check (part4_state is null or part4_state in ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT')),
  started_on date not null,
  -- s 15(3)(aa) and (4): confirmed to the unit in the NDIS Worker Screening Database.
  verified_on date,
  -- s 15(3): the unit's written notice seen.
  notice_seen_on date,
  -- s 14(1)(a)(ii): the cleared worker in the account who supervises.
  supervisor_ref text check (supervisor_ref is null or supervisor_ref ~ '^W-?[0-9]{1,6}$'),
  -- s 15(2)(a) and (b): the worker's written declaration, kept in the HR file; the tick's date alone.
  declaration_on date,
  -- D-2428: the procedure version the exception started under; the newer versions leave it as it is.
  plan_version_id uuid references public.document_versions (id),
  -- The participant risk register's last-reviewed date on the day the exception started.
  plan_register_date date,
  ended_on date,
  end_code text check (end_code is null or end_code in (
    'clearance-issued', 'excluded', 'interim-bar', 'supervision-stopped', 'plan-stopped',
    'withdrawn', 'closed', 'supervisor-clearance-expired'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The Part 4 codes carry their state and nothing else does (finding 227). Named for what it checks: the
  -- column's own inline CHECK above takes the generated name `screening_exceptions_part4_state_check`
  -- (#85's run 38945982046, 42710).
  constraint screening_exceptions_part4_state_for_own_call_check check ((code in ('s14-1b', 's14-2b')) = (part4_state is not null)),
  -- No Part 4 arrangement started after 31 January 2026, for every state (D-2439 as amended; findings 208, 246).
  constraint screening_exceptions_part4_start_check check (code not in ('s14-1b', 's14-2b') or started_on <= date '2026-01-31'),
  constraint screening_exceptions_end_check check ((ended_on is null) = (end_code is null)),
  constraint screening_exceptions_end_after_start_check check (ended_on is null or ended_on >= started_on),
  -- The gated codes carry the s 15 fields, the supervisor and the plan (finding 219); the own-call codes carry none (finding 213).
  constraint screening_exceptions_gated_check check (
    code not in ('s14-1a', 's14-2a')
    or (clearance_id is not null and verified_on is not null and notice_seen_on is not null and declaration_on is not null
        and supervisor_ref is not null and plan_version_id is not null and plan_register_date is not null)
  ),
  constraint screening_exceptions_own_call_check check (
    code in ('s14-1a', 's14-2a')
    or (verified_on is null and notice_seen_on is null and declaration_on is null
        and supervisor_ref is null and plan_version_id is null and plan_register_date is null)
  )
);
create index screening_exceptions_account_idx on public.screening_exceptions (account_id, worker_ref);
-- One open exception per worker at a time.
create unique index screening_exceptions_open_idx on public.screening_exceptions (account_id, worker_ref) where ended_on is null;
create trigger screening_exceptions_set_updated_at
  before update on public.screening_exceptions
  for each row execute function public.set_updated_at();
alter table public.screening_exceptions enable row level security;
create policy screening_exceptions_select_owner on public.screening_exceptions
  for select to authenticated using (public.is_owner(account_id));
create policy screening_exceptions_insert_owner on public.screening_exceptions
  for insert to authenticated with check (public.is_owner(account_id) and public.has_active_subscription(account_id));
create policy screening_exceptions_update_owner on public.screening_exceptions
  for update to authenticated
  using (public.is_owner(account_id) and public.has_active_subscription(account_id))
  with check (public.is_owner(account_id) and public.has_active_subscription(account_id));
-- No delete: an exception is ended, never removed (the service role keeps all).
revoke all on public.screening_exceptions from anon, authenticated;
grant select, insert, update on public.screening_exceptions to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The trail (finding 66; D-2434): the register and the two kinds, whose
--    notes carry the version number and the dates in words, never a uuid.
-- ---------------------------------------------------------------------------
alter table public.register_events drop constraint register_events_register_check;
alter table public.register_events add constraint register_events_register_check check (register in (
  'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
  'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists',
  'hazards', 'incidents', 'complaints', 'worker_clearances',
  'onboarding_items', 'risk_assessed_roles', 'screening_exceptions'
));
alter table public.register_events drop constraint register_events_kind_check;
alter table public.register_events add constraint register_events_kind_check check (kind in (
  'created', 'note', 'reviewed', 'updated', 'closed', 'imported',
  'confirmed', 'role-changed', 'ended', 'exception-started', 'exception-ended'
));

notify pgrst, 'reload schema';

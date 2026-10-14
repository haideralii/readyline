-- REQ-018 Session A: the registers an auditor asks for on the day (FR-1 to
-- FR-9, SR-1 to SR-3; D-1901 to D-1903), on the REQ-009 pattern: tenant
-- row-level security, writes gated on an unrevoked subscription entitlement,
-- reads at any time, owners delete, no participant personal data by schema
-- (people are reference codes with CHECKed patterns; every free-text column
-- is capped and rejects an NDIS-number shape), explicit grants (D-052), and
-- one shared append-only event table for every register here (D-1902) with
-- update revoked so a client edit fails loudly with 42501 (D-906).
--
-- Tables: corporate_risks (FR-1), participant_risks (FR-2),
-- conflicts_of_interest (FR-3), delegations (FR-4), insurance_items (FR-5,
-- insurances and vehicles), improvements (FR-6), decisions (FR-7, append
-- only), staff_matrix (FR-8), onboarding_checklists and onboarding_ticks
-- (FR-9, ticks append only), register_events (the trail). Status views
-- compute review and expiry states at read time. The worker_clearances kinds
-- gain manual handling and medication so mandatory training lives in the
-- one table the staff matrix reads (FR-8).

-- ---------------------------------------------------------------------------
-- Worker checks: two more mandatory-training kinds (FR-8)
-- ---------------------------------------------------------------------------

alter table public.worker_clearances drop constraint if exists worker_clearances_clearance_kind_check;
alter table public.worker_clearances add constraint worker_clearances_clearance_kind_check check (clearance_kind in (
  'ndis-worker-screening', 'wwcc', 'police-check', 'first-aid', 'ndis-worker-orientation-module',
  'manual-handling', 'medication', 'other'
));

-- ---------------------------------------------------------------------------
-- FR-1 Corporate risk register: one row per risk, nine fixed areas
-- ---------------------------------------------------------------------------

create table public.corporate_risks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  area text not null check (area in (
    'emergency-and-disaster', 'participant-related', 'compliance', 'people-and-staffing',
    'organisational-sustainability', 'governance', 'finance', 'legislation-change', 'data-and-privacy'
  )),
  what_could_happen text not null check (char_length(what_could_happen) between 1 and 500 and not public.looks_like_ndis_number(what_could_happen)),
  likelihood text not null check (likelihood in ('low', 'medium', 'high')),
  controls text not null check (char_length(controls) between 1 and 2000 and not public.looks_like_ndis_number(controls)),
  -- The role, never the person.
  owner_role text not null check (char_length(owner_role) between 1 and 80 and not public.looks_like_ndis_number(owner_role)),
  review_on date not null,
  -- A starter row drawn from the questionnaire (FR-1): shown as "check this and change it" until edited.
  starter boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index corporate_risks_account_review_idx on public.corporate_risks (account_id, review_on);
create trigger corporate_risks_set_updated_at
  before update on public.corporate_risks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FR-2 Participant risk register: one row per participant, by code (SR-2)
-- ---------------------------------------------------------------------------

create table public.participant_risks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  participant_ref text not null check (participant_ref ~ '^[A-Z]{1,3}-?[0-9]{1,6}$'),
  risk text not null check (char_length(risk) between 1 and 500 and not public.looks_like_ndis_number(risk)),
  controls text not null check (char_length(controls) between 1 and 2000 and not public.looks_like_ndis_number(controls)),
  review_on date not null,
  -- FR-10: the support plan review date the provider sets for this participant.
  support_plan_review_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index participant_risks_account_review_idx on public.participant_risks (account_id, review_on);
create trigger participant_risks_set_updated_at
  before update on public.participant_risks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FR-3 Conflict of interest register: staff and participants, by code
-- ---------------------------------------------------------------------------

create table public.conflicts_of_interest (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- W- worker, KP- key person, P- participant, FAM- family, OTH- other.
  who_ref text not null check (who_ref ~ '^(W|KP|P|FAM|OTH)-?[0-9]{1,6}$'),
  conflict text not null check (char_length(conflict) between 1 and 500 and not public.looks_like_ndis_number(conflict)),
  managed_by text not null check (char_length(managed_by) between 1 and 2000 and not public.looks_like_ndis_number(managed_by)),
  declared_on date not null,
  review_on date not null check (review_on >= declared_on),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conflicts_of_interest_account_review_idx on public.conflicts_of_interest (account_id, review_on);
create trigger conflicts_of_interest_set_updated_at
  before update on public.conflicts_of_interest
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FR-4 Delegations register: each key role, the person, the backup
-- ---------------------------------------------------------------------------

create table public.delegations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  role text not null check (role in (
    'owner-or-director', 'key-management-personnel', 'incident-reporter', 'complaints-contact',
    'finance-approver', 'worker-screening-checker', 'other'
  )),
  role_label text not null default '' check (char_length(role_label) <= 80 and not public.looks_like_ndis_number(role_label)),
  holder_ref text not null check (holder_ref ~ '^(W|KP)-?[0-9]{1,6}$'),
  backup_ref text check (backup_ref is null or backup_ref ~ '^(W|KP)-?[0-9]{1,6}$'),
  backup_may text not null default '' check (char_length(backup_may) <= 500 and not public.looks_like_ndis_number(backup_may)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'other' or char_length(role_label) > 0),
  unique (account_id, role, role_label)
);
create trigger delegations_set_updated_at
  before update on public.delegations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FR-5 Insurances and vehicles: dates only, never a certificate (SR-3)
-- ---------------------------------------------------------------------------

create table public.insurance_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in (
    'public-liability', 'professional-indemnity', 'workers-compensation', 'personal-accident', 'other-insurance',
    'vehicle-registration', 'vehicle-insurance', 'driver-licence'
  )),
  -- The insurer, the vehicle code (V-01) or the driver's worker code (W-003); never a name or a plate.
  label text not null check (char_length(label) between 1 and 120 and not public.looks_like_ndis_number(label)),
  policy_number text not null default '' check (char_length(policy_number) <= 80 and not public.looks_like_ndis_number(policy_number)),
  expires_on date not null,
  note text not null default '' check (char_length(note) <= 500 and not public.looks_like_ndis_number(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index insurance_items_account_expires_idx on public.insurance_items (account_id, expires_on);
create trigger insurance_items_set_updated_at
  before update on public.insurance_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FR-6 Continuous improvement register: fed by incidents and complaints
-- ---------------------------------------------------------------------------

create table public.improvements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  source_kind text not null check (source_kind in (
    'incident', 'complaint', 'feedback', 'survey', 'internal-audit', 'external-audit', 'other'
  )),
  -- INC-0003 or CMP-0002 when the row came from a register; free otherwise.
  source_ref text not null default '' check (char_length(source_ref) <= 40 and not public.looks_like_ndis_number(source_ref)),
  learned text not null check (char_length(learned) between 1 and 500 and not public.looks_like_ndis_number(learned)),
  changed text not null check (char_length(changed) between 1 and 2000 and not public.looks_like_ndis_number(changed)),
  owner_role text not null check (char_length(owner_role) between 1 and 80 and not public.looks_like_ndis_number(owner_role)),
  due_on date not null,
  done_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index improvements_account_due_idx on public.improvements (account_id, due_on);
create trigger improvements_set_updated_at
  before update on public.improvements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FR-7 Record of decisions: dated, append only (a decision is not re-written)
-- ---------------------------------------------------------------------------

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  decided_on date not null,
  decision text not null check (char_length(decision) between 1 and 300 and not public.looks_like_ndis_number(decision)),
  -- Who decided: a worker or key-person code, or a body such as "board".
  decided_by text not null check (char_length(decided_by) between 1 and 80 and not public.looks_like_ndis_number(decided_by)),
  note text not null default '' check (char_length(note) <= 1000 and not public.looks_like_ndis_number(note)),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index decisions_account_decided_idx on public.decisions (account_id, decided_on desc);

-- ---------------------------------------------------------------------------
-- FR-8 Staff matrix: one row per worker; training and clearance expiries come
-- from worker_clearances by worker code (the status view joins them)
-- ---------------------------------------------------------------------------

create table public.staff_matrix (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  worker_ref text not null check (worker_ref ~ '^W-?[0-9]{1,6}$'),
  role_label text not null check (char_length(role_label) between 1 and 80 and not public.looks_like_ndis_number(role_label)),
  qualifications text not null default '' check (char_length(qualifications) <= 500 and not public.looks_like_ndis_number(qualifications)),
  risk_assessed boolean not null default false,
  started_on date,
  last_supervision_on date,
  last_appraisal_on date,
  onboarding_signed_on date,
  note text not null default '' check (char_length(note) <= 500 and not public.looks_like_ndis_number(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, worker_ref)
);
create trigger staff_matrix_set_updated_at
  before update on public.staff_matrix
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FR-9 Onboarding checklists: a checklist per new worker or participant, the
-- ticks append only (a tick with the date and who ticked it is the evidence)
-- ---------------------------------------------------------------------------

create table public.onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in ('worker', 'participant')),
  subject_ref text not null check (subject_ref ~ '^[A-Z]{1,3}-?[0-9]{1,6}$'),
  started_on date not null default current_date,
  completed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, kind, subject_ref)
);
create trigger onboarding_checklists_set_updated_at
  before update on public.onboarding_checklists
  for each row execute function public.set_updated_at();

create table public.onboarding_ticks (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.onboarding_checklists (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9-]{1,60}$'),
  ticked_on date not null default current_date,
  ticked_by_ref text not null check (ticked_by_ref ~ '^(W|KP)-?[0-9]{1,6}$'),
  actor_user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (checklist_id, item_id)
);
create index onboarding_ticks_checklist_idx on public.onboarding_ticks (checklist_id);

-- ---------------------------------------------------------------------------
-- The shared event trail for the registers above (D-1902): append only
-- ---------------------------------------------------------------------------

create table public.register_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  register text not null check (register in (
    'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
    'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists'
  )),
  row_id uuid not null,
  at timestamptz not null default now(),
  actor_user_id uuid default auth.uid(),
  kind text not null check (kind in ('created', 'note', 'reviewed', 'updated', 'closed')),
  note text not null default '' check (char_length(note) <= 1000 and not public.looks_like_ndis_number(note))
);
create index register_events_row_at_idx on public.register_events (register, row_id, at);
create index register_events_account_idx on public.register_events (account_id, at desc);

-- ---------------------------------------------------------------------------
-- Status views: computed at read time, security_invoker so RLS applies
-- ---------------------------------------------------------------------------

create or replace function public.review_status(p_review_on date)
returns text
language sql
stable
as $$
  select case
    when p_review_on is null then 'no-date'
    when p_review_on < current_date then 'overdue'
    when p_review_on <= current_date + 30 then 'due-soon'
    else 'current'
  end;
$$;
revoke all on function public.review_status(date) from public;
grant execute on function public.review_status(date) to authenticated, service_role;

create view public.corporate_risks_status with (security_invoker = true) as
select r.*, public.review_status(r.review_on) as status from public.corporate_risks r;

create view public.participant_risks_status with (security_invoker = true) as
select r.*, public.review_status(r.review_on) as status from public.participant_risks r;

create view public.conflicts_of_interest_status with (security_invoker = true) as
select c.*, public.review_status(c.review_on) as status from public.conflicts_of_interest c;

create view public.insurance_items_status with (security_invoker = true) as
select
  i.*,
  case
    when i.expires_on < current_date then 'expired'
    when i.expires_on <= current_date + 30 then 'expiring'
    else 'current'
  end as status
from public.insurance_items i;

create view public.improvements_status with (security_invoker = true) as
select
  m.*,
  case
    when m.done_on is not null then 'done'
    when m.due_on < current_date then 'overdue'
    else 'open'
  end as status
from public.improvements m;

-- Supervision at least monthly, appraisal at least yearly (REQ-018 FR-8).
create view public.staff_matrix_status with (security_invoker = true) as
select
  s.*,
  case
    when s.last_supervision_on is null or s.last_supervision_on < current_date - 31 then 'supervision-overdue'
    when s.last_appraisal_on is null or s.last_appraisal_on < current_date - 365 then 'appraisal-overdue'
    else 'current'
  end as status,
  (
    select count(*) from public.worker_clearances c
    where c.account_id = s.account_id and c.worker_ref = s.worker_ref
      and c.expires_on is not null and c.expires_on < current_date
  ) as expired_checks,
  (
    select count(*) from public.worker_clearances c
    where c.account_id = s.account_id and c.worker_ref = s.worker_ref
      and c.expires_on is not null and c.expires_on >= current_date and c.expires_on <= current_date + 90
  ) as expiring_checks
from public.staff_matrix s;

create view public.onboarding_checklists_status with (security_invoker = true) as
select
  o.*,
  (select count(*) from public.onboarding_ticks t where t.checklist_id = o.id) as ticked,
  case when o.completed_on is not null then 'complete' else 'in-progress' end as status
from public.onboarding_checklists o;

-- ---------------------------------------------------------------------------
-- Row-level security: members read; subscribed members insert and update
-- (not the append-only tables); owners delete
-- ---------------------------------------------------------------------------

alter table public.corporate_risks enable row level security;
alter table public.participant_risks enable row level security;
alter table public.conflicts_of_interest enable row level security;
alter table public.delegations enable row level security;
alter table public.insurance_items enable row level security;
alter table public.improvements enable row level security;
alter table public.decisions enable row level security;
alter table public.staff_matrix enable row level security;
alter table public.onboarding_checklists enable row level security;
alter table public.onboarding_ticks enable row level security;
alter table public.register_events enable row level security;

-- The editable registers share one policy shape.
do $$
declare
  t text;
begin
  foreach t in array array[
    'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
    'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists'
  ] loop
    execute format('create policy %I_select_member on public.%I for select to authenticated using (public.is_member(account_id))', t, t);
    execute format('create policy %I_insert_subscribed on public.%I for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id))', t, t);
    execute format('create policy %I_update_subscribed on public.%I for update to authenticated using (public.is_member(account_id) and public.has_active_subscription(account_id)) with check (public.is_member(account_id) and public.has_active_subscription(account_id))', t, t);
    execute format('create policy %I_delete_owner on public.%I for delete to authenticated using (public.is_owner(account_id))', t, t);
  end loop;
end $$;

-- Append-only tables: insert (subscribed) and read; owners delete; no update policy and no update privilege.
create policy decisions_select_member on public.decisions
  for select to authenticated using (public.is_member(account_id));
create policy decisions_insert_subscribed on public.decisions
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy decisions_delete_owner on public.decisions
  for delete to authenticated using (public.is_owner(account_id));

create policy onboarding_ticks_select_member on public.onboarding_ticks
  for select to authenticated using (public.is_member(account_id));
create policy onboarding_ticks_insert_subscribed on public.onboarding_ticks
  for insert to authenticated with check (
    public.is_member(account_id)
    and public.has_active_subscription(account_id)
    and exists (
      select 1 from public.onboarding_checklists o
      where o.id = onboarding_ticks.checklist_id and o.account_id = onboarding_ticks.account_id
    )
  );
create policy onboarding_ticks_delete_owner on public.onboarding_ticks
  for delete to authenticated using (public.is_owner(account_id));

create policy register_events_select_member on public.register_events
  for select to authenticated using (public.is_member(account_id));
create policy register_events_insert_subscribed on public.register_events
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy register_events_delete_owner on public.register_events
  for delete to authenticated using (public.is_owner(account_id));

-- ---------------------------------------------------------------------------
-- Explicit privileges (D-052)
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  public.corporate_risks, public.participant_risks, public.conflicts_of_interest, public.delegations,
  public.insurance_items, public.improvements, public.staff_matrix, public.onboarding_checklists
  to authenticated;
-- Append-only for clients (D-906, D-1902): no update privilege, so an edit is a 42501 refusal, never a silent no-op.
grant select, insert, delete on public.decisions, public.onboarding_ticks, public.register_events to authenticated;
revoke update on public.decisions, public.onboarding_ticks, public.register_events from anon, authenticated;
grant select on
  public.corporate_risks_status, public.participant_risks_status, public.conflicts_of_interest_status,
  public.insurance_items_status, public.improvements_status, public.staff_matrix_status,
  public.onboarding_checklists_status
  to authenticated, service_role;
grant all privileges on
  public.corporate_risks, public.participant_risks, public.conflicts_of_interest, public.delegations,
  public.insurance_items, public.improvements, public.decisions, public.staff_matrix,
  public.onboarding_checklists, public.onboarding_ticks, public.register_events
  to service_role;
revoke all on
  public.corporate_risks, public.participant_risks, public.conflicts_of_interest, public.delegations,
  public.insurance_items, public.improvements, public.decisions, public.staff_matrix,
  public.onboarding_checklists, public.onboarding_ticks, public.register_events,
  public.corporate_risks_status, public.participant_risks_status, public.conflicts_of_interest_status,
  public.insurance_items_status, public.improvements_status, public.staff_matrix_status,
  public.onboarding_checklists_status
  from anon;

notify pgrst, 'reload schema';

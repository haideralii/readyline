-- REQ-020 Session C (FR-7, FR-8, FR-9, FR-12, SR-3, SR-4; D-2236): the
-- hazard register, spreadsheet imports and the quarterly self-check, on the
-- REQ-018 pattern (tenant RLS, writes gated on a subscription, owners
-- delete, codes never names, explicit grants, D-052).
--
-- 1. hazards (FR-7): one row per hazard, by site or vehicle code, with the
--    corporate risk register's two scales, what was done, by when, done on,
--    and a review date the register-review reminder reads.
-- 2. register_events: the hazard register joins the shared trail; the four
--    importable registers join it too so an import leaves one 'imported'
--    line per row (FR-8) without touching the incident and complaint event
--    tables' own kind lists (another branch changes those).
-- 3. imports (FR-8, FR-12): one row per import with the counts and the ids
--    of the rows it wrote, so the owner can undo it within an hour.
-- 4. self_checks (FR-9): one row per walk with the answers; a "no" writes an
--    improvement row whose source is 'self-check'.
-- 5. reminders may point at a hazard.

-- ---------------------------------------------------------------------------
-- 1. Hazard and WHS register (FR-7)
-- ---------------------------------------------------------------------------

create table public.hazards (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- A code for the site or vehicle (S-01, V-02), never an address.
  site_ref text not null check (site_ref ~ '^[A-Z]{1,3}-?[0-9]{1,6}$'),
  hazard text not null check (char_length(hazard) between 1 and 500 and not public.looks_like_ndis_number(hazard)),
  harm_to text not null check (harm_to in ('participant', 'worker', 'visitor')),
  likelihood text not null check (likelihood in ('low', 'medium', 'high')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  controls text not null check (char_length(controls) between 1 and 2000 and not public.looks_like_ndis_number(controls)),
  due_on date not null,
  done_on date,
  review_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hazards_account_review_idx on public.hazards (account_id, review_on);
create trigger hazards_set_updated_at
  before update on public.hazards
  for each row execute function public.set_updated_at();

alter table public.hazards enable row level security;
create policy hazards_select_member on public.hazards
  for select to authenticated using (public.is_member(account_id));
create policy hazards_insert_subscribed on public.hazards
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy hazards_update_subscribed on public.hazards
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy hazards_delete_owner on public.hazards
  for delete to authenticated using (public.is_owner(account_id));

create view public.hazards_status with (security_invoker = true) as
select h.*, public.review_status(h.review_on) as status from public.hazards h;

grant select, insert, update, delete on public.hazards to authenticated;
grant select on public.hazards_status to authenticated, service_role;
grant all privileges on public.hazards to service_role;
revoke all on public.hazards, public.hazards_status from anon;

-- ---------------------------------------------------------------------------
-- 2. The shared trail: the hazard register and the four importable registers; 'imported'
-- ---------------------------------------------------------------------------

alter table public.register_events drop constraint register_events_register_check;
alter table public.register_events add constraint register_events_register_check check (register in (
  'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
  'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists',
  'hazards', 'incidents', 'complaints', 'worker_clearances'
));
alter table public.register_events drop constraint register_events_kind_check;
alter table public.register_events add constraint register_events_kind_check check (kind in (
  'created', 'note', 'reviewed', 'updated', 'closed', 'imported'
));

-- ---------------------------------------------------------------------------
-- 3. Imports (FR-8, FR-12): the counts and the rows written, undoable for an hour
-- ---------------------------------------------------------------------------

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  register text not null check (register in ('incidents', 'complaints', 'worker_clearances', 'corporate_risks')),
  rows_total integer not null check (rows_total between 0 and 500),
  rows_imported integer not null check (rows_imported between 0 and 500),
  row_ids uuid[] not null default '{}',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index imports_account_idx on public.imports (account_id, created_at desc);
alter table public.imports enable row level security;
create policy imports_select_member on public.imports
  for select to authenticated using (public.is_member(account_id));
create policy imports_insert_subscribed on public.imports
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
-- Undo is the owner's and is only ever the undone_at mark; nothing else on the row changes.
create policy imports_update_owner on public.imports
  for update to authenticated using (public.is_owner(account_id)) with check (public.is_owner(account_id));
-- Retro review of REQ-020 (15 Oct 2026, finding 33): the update grant covers the one column the undo sets.
grant select, insert on public.imports to authenticated;
grant update (undone_at) on public.imports to authenticated;
revoke delete on public.imports from anon, authenticated;
grant all privileges on public.imports to service_role;
revoke all on public.imports from anon;

-- ---------------------------------------------------------------------------
-- 4. Quarterly self-check (FR-9)
-- ---------------------------------------------------------------------------

create table public.self_checks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  walked_on date not null,
  -- The role or code of who walked it, never a name.
  walked_by_ref text not null check (walked_by_ref ~ '^(owner|(W|KP)-?[0-9]{1,6})$'),
  findings integer not null check (findings between 0 and 50),
  -- Record id -> { answer: 'yes' | 'no', note }; notes are capped by the action, and the
  -- NDIS-number rule holds at the table too (retro review of REQ-020, 15 Oct 2026, finding 32).
  answers jsonb not null default '{}'::jsonb check (not public.looks_like_ndis_number(answers::text)),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index self_checks_account_idx on public.self_checks (account_id, walked_on desc);
alter table public.self_checks enable row level security;
create policy self_checks_select_member on public.self_checks
  for select to authenticated using (public.is_member(account_id));
create policy self_checks_insert_subscribed on public.self_checks
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy self_checks_delete_owner on public.self_checks
  for delete to authenticated using (public.is_owner(account_id));
grant select, insert, delete on public.self_checks to authenticated;
revoke update on public.self_checks from anon, authenticated;
grant all privileges on public.self_checks to service_role;
revoke all on public.self_checks from anon;

alter table public.improvements drop constraint improvements_source_kind_check;
alter table public.improvements add constraint improvements_source_kind_check check (source_kind in (
  'incident', 'complaint', 'feedback', 'survey', 'internal-audit', 'external-audit', 'other', 'self-check'
));

-- ---------------------------------------------------------------------------
-- 5. Reminders may point at a hazard (register-review, FR-7)
-- ---------------------------------------------------------------------------

alter table public.reminders drop constraint if exists reminders_subject_table_check;
alter table public.reminders add constraint reminders_subject_table_check check (subject_table in (
  'incidents', 'complaints', 'worker_clearances', 'policy_reviews', 'accounts',
  'insurance_items', 'staff_matrix', 'participant_risks', 'corporate_risks', 'conflicts_of_interest',
  'hazards'
));

notify pgrst, 'reload schema';

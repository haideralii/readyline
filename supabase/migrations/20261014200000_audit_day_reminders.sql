-- REQ-018 Session C: the reminders the new registers send (FR-5, FR-8,
-- FR-10), the account's last emergency drill date (FR-10), and the policy
-- circulation record (FR-14; D-1905, D-1906).
--
-- (1) `reminders.kind` and `subject_table` take the new values: insurance
--     and vehicle expiries, supervision and appraisal due, the support plan
--     review per participant, the emergency drill every six months, and a
--     register row's review date. The nightly job computes them (pure rules
--     in src/lib/registers/reminders.ts); the key stays
--     (account, kind, subject, send date).
-- (2) `accounts.last_emergency_drill_on`: the provider records the drill
--     on the audit-day page; the reminder fires six months after.
-- (3) `policy_circulations`: when a group is adopted the provider ticks
--     which workers were walked through the documents and when; one row
--     per document, append only (a circulation happened or it did not).
--     Worker codes only, never names (SR-2). The document control register
--     (FR-13) is derived at read time from the pack, the policy reviews and
--     these rows; it has no table of its own.

alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check check (kind in (
  'clearance-expiry', 'policy-review', 'mid-term-audit', 'renewal',
  'incident-open', 'complaint-unacknowledged', 'reportable-not-notified',
  'insurance-expiry', 'supervision-due', 'appraisal-due',
  'support-plan-review', 'emergency-drill', 'register-review'
));
alter table public.reminders drop constraint if exists reminders_subject_table_check;
alter table public.reminders add constraint reminders_subject_table_check check (subject_table in (
  'incidents', 'complaints', 'worker_clearances', 'policy_reviews', 'accounts',
  'insurance_items', 'staff_matrix', 'participant_risks', 'corporate_risks', 'conflicts_of_interest'
));

alter table public.accounts add column last_emergency_drill_on date;

create table public.policy_circulations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  document_type_id text not null check (document_type_id ~ '^[a-z0-9-]{1,80}$'),
  circulated_on date not null,
  -- Worker or key-person codes, space separated: "W-1 W-2 KP-1".
  worker_refs text not null check (worker_refs ~ '^((W|KP)-?[0-9]{1,6})( (W|KP)-?[0-9]{1,6})*$'),
  how text not null default '' check (char_length(how) <= 200 and not public.looks_like_ndis_number(how)),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index policy_circulations_account_doc_idx on public.policy_circulations (account_id, document_type_id, circulated_on desc);

alter table public.policy_circulations enable row level security;
create policy policy_circulations_select_member on public.policy_circulations
  for select to authenticated using (public.is_member(account_id));
-- Written from the Adopt step, which every pack buyer walks (REQ-017), so a member may insert without the subscription gate.
create policy policy_circulations_insert_member on public.policy_circulations
  for insert to authenticated with check (public.is_member(account_id));
create policy policy_circulations_delete_owner on public.policy_circulations
  for delete to authenticated using (public.is_owner(account_id));

grant usage on schema public to authenticated, service_role;
grant select, insert, delete on public.policy_circulations to authenticated;
revoke update on public.policy_circulations from anon, authenticated;
grant all privileges on public.policy_circulations to service_role;
revoke all on public.policy_circulations from anon;

notify pgrst, 'reload schema';

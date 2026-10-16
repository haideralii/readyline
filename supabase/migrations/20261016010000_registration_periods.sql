-- REQ-023 Session A (FR-1 to FR-4; D-2312, D-2313; findings 58, 59, 61, 63,
-- 75, 79): the registration period the owner types from the certificate,
-- the function that clears unsent timeline reminders when the dates change,
-- the checklist's done date, and the reminders table's new kinds and
-- subject. The migration inserts no period: the first row is written by
-- the owner's save (D-2312). Grants are explicit and the table-level
-- privileges are revoked before the column grants (D-2241).

-- ---------------------------------------------------------------------------
-- 1. registration_periods: one row per period, the dates as typed
-- ---------------------------------------------------------------------------

create table public.registration_periods (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  period_starts_on date not null,
  period_ends_on date not null check (period_ends_on > period_starts_on),
  audit_type text not null check (audit_type in ('certification', 'verification')),
  -- Written by the server from the audit type and derive.ts's midTermAudit (findings 45 and 78), never typed.
  midterm_applies boolean not null default false,
  midterm_exempt_reason text check (midterm_exempt_reason is null or char_length(midterm_exempt_reason) <= 300),
  -- A date the Commissioner allowed or set (Rules s 13B(4)(b), or a certificate condition), inside the period (finding 75).
  midterm_start_by_override date check (
    midterm_start_by_override is null
    or (midterm_start_by_override > period_starts_on and midterm_start_by_override <= period_ends_on)
  ),
  midterm_override_source text check (midterm_override_source is null or midterm_override_source in ('condition', 'letter')),
  last_audit_on date,
  midterm_audit_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, period_starts_on)
);
create index registration_periods_account_idx on public.registration_periods (account_id, period_starts_on desc);
create trigger registration_periods_set_updated_at
  before update on public.registration_periods
  for each row execute function public.set_updated_at();

alter table public.registration_periods enable row level security;
-- Account facts, not register rows: members read, the owner writes, no
-- subscription test, so a paused account keeps its dates and reminders
-- (D-2308, D-2312; finding 63). No delete policy: the period history is the
-- audit trail; the account's deletion cascades.
create policy registration_periods_select_member on public.registration_periods
  for select to authenticated using (public.is_member(account_id));
create policy registration_periods_insert_owner on public.registration_periods
  for insert to authenticated with check (public.is_owner(account_id));
create policy registration_periods_update_owner on public.registration_periods
  for update to authenticated using (public.is_owner(account_id)) with check (public.is_owner(account_id));

revoke all on public.registration_periods from anon, authenticated;
grant select, insert, update on public.registration_periods to authenticated;
grant all privileges on public.registration_periods to service_role;

-- ---------------------------------------------------------------------------
-- 2. Reminders: the five timeline kinds, the period as a subject, the two old
--    kinds kept in the CHECK for sent rows and their unsent rows deleted
-- ---------------------------------------------------------------------------

alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders
  add constraint reminders_kind_check check (kind in (
    'clearance-expiry', 'policy-review', 'mid-term-audit', 'renewal',
    'incident-open', 'complaint-unacknowledged', 'reportable-not-notified',
    'insurance-expiry', 'supervision-due', 'appraisal-due',
    'support-plan-review', 'emergency-drill', 'register-review',
    'report-to-confirm',
    'midterm-prepare', 'midterm-start-by', 'renewal-window', 'renewal-apply-by', 'renewal-last-call'
  ));

alter table public.reminders drop constraint if exists reminders_subject_table_check;
alter table public.reminders add constraint reminders_subject_table_check check (subject_table in (
  'incidents', 'complaints', 'worker_clearances', 'policy_reviews', 'accounts',
  'insurance_items', 'staff_matrix', 'participant_risks', 'corporate_risks', 'conflicts_of_interest',
  'hazards', 'registration_periods'
));

-- Finding 59: nothing of the two old kinds may reach an email as an unknown line.
delete from public.reminders where kind in ('mid-term-audit', 'renewal') and sent_at is null;

-- Finding 61: the owner's session holds no delete on reminders, so the save
-- clears its unsent timeline rows through this function, owner-only.
create or replace function public.clear_registration_reminders(p_account uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_owner(p_account) then
    raise exception 'not the owner' using errcode = '42501';
  end if;
  delete from public.reminders
   where account_id = p_account
     and sent_at is null
     and kind in ('midterm-prepare', 'midterm-start-by', 'renewal-window', 'renewal-apply-by', 'renewal-last-call');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.clear_registration_reminders(uuid) from public;
grant execute on function public.clear_registration_reminders(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Checklist: the date a dated audit item was done (FR-4, finding 80)
-- ---------------------------------------------------------------------------

alter table public.checklist_items add column done_on date;

notify pgrst, 'reload schema';

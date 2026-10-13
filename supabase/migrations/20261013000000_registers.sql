-- REQ-009 Session A: the four registers a provider keeps after registration
-- (incidents, complaints, worker clearances, policy reviews), their event
-- trails, reminders, per-account references, and the account's registration
-- date and kind (FR-1, FR-2, FR-4, SR-1, SR-2; D-901 to D-905).
--
-- No participant personal data by schema (CLAUDE.md 4.5, SR-1): people are
-- referred to by short reference codes with a CHECKed pattern, every free-text
-- column is capped and rejects anything shaped like an NDIS number, and
-- nothing in these tables is ever sent to the model.
--
-- Entitlement gate in the policies (SR-2, PO answer 4): a member can read a
-- register at any time; inserting or updating needs an unrevoked
-- `entitlements` row of kind `subscription`. A lapsed subscription freezes
-- writes and never hides or deletes anything.
--
-- Reportable-incident timeframes (`notify_by`, PO answer 1):
--   The NDIS (Incident Management and Reportable Incidents) Rules 2018
--   (F2018L00633, legislation.gov.au, in force) set the two windows:
--   section 20 "Certain reportable incidents must be notified to the
--   Commissioner within 24 hours" and section 21 "Other reportable incidents
--   must be notified to the Commissioner within 5 business days". The
--   Commission's "Reportable incidents" page
--   (https://www.ndiscommission.gov.au/rules-and-standards/reportable-incidents-and-incident-management/reportable-incidents)
--   puts death, serious injury, abuse or neglect, unlawful sexual or physical
--   contact or assault, and sexual misconduct in the 24-hour window, and the
--   use of a restrictive practice without authorisation or outside a
--   behaviour support plan in the 5-business-day window unless it caused
--   harm, in which case 24 hours. Both windows run from when the provider
--   (its key personnel) became aware of the incident.
--   UNVERIFIED in part (2026-10-13): the Rules' section headings were read
--   from legislation.gov.au this session; the Commission's page would not
--   load from the build machine (timeouts), so the category split above is
--   taken from its indexed text and the June 2019 detailed guidance, and
--   needs one look at the live page by the PO. Two deliberate
--   simplifications, both recorded in REQ-009's Dev response: the column
--   counts from `occurred_on` as the REQ says (the Rules count from
--   awareness; `reported_on` is the nearest thing we hold), and a
--   restrictive practice that caused harm is entered under the harm's own
--   category (serious injury, abuse or neglect) so it gets the 24-hour date.
--   Business days skip Saturday and Sunday only; public holidays differ by
--   state and are not modelled (a reminder one day early is the safe side).

-- ---------------------------------------------------------------------------
-- Helpers (immutable, so generated columns can use them)
-- ---------------------------------------------------------------------------

-- Nine digits starting with 43, with no digit either side: the shape of an
-- NDIS participant number. Used as a CHECK on every free-text column.
create or replace function public.looks_like_ndis_number(p_text text)
returns boolean
language sql
immutable
strict
as $$
  select p_text ~ '(^|[^0-9])43[0-9]{7}([^0-9]|$)';
$$;

-- p_date plus p_days business days (Monday to Friday). Weekend-day inputs
-- start counting from the next Monday. Public holidays are not modelled.
create or replace function public.add_business_days(p_date date, p_days integer)
returns date
language plpgsql
immutable
strict
as $$
declare
  v_date date := p_date;
  v_left integer := p_days;
begin
  if v_left < 0 then
    raise exception 'add_business_days: negative days';
  end if;
  while v_left > 0 loop
    v_date := v_date + 1;
    if extract(isodow from v_date) < 6 then
      v_left := v_left - 1;
    end if;
  end loop;
  return v_date;
end;
$$;

-- The date by which the Commission must be told, or null when the incident is
-- not flagged reportable or its category has no reportable window.
create or replace function public.incident_notify_by(p_occurred_on date, p_category text, p_reportable boolean)
returns date
language sql
immutable
as $$
  select case
    when p_occurred_on is null or not coalesce(p_reportable, false) then null
    when p_category in (
      'death', 'serious-injury', 'abuse-or-neglect',
      'unlawful-sexual-or-physical-contact', 'sexual-misconduct'
    ) then p_occurred_on + 1
    when p_category = 'restrictive-practice-unauthorised' then public.add_business_days(p_occurred_on, 5)
    else null
  end;
$$;

-- True when the account holds an unrevoked subscription entitlement
-- (REQ-007 `entitlements.kind = 'subscription'`). Security definer so the
-- policies below can ask without the caller needing to read `entitlements`.
create or replace function public.has_active_subscription(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.account_id = p_account
      and e.kind = 'subscription'
      and e.revoked_at is null
  );
$$;

revoke all on function public.looks_like_ndis_number(text) from public;
revoke all on function public.add_business_days(date, integer) from public;
revoke all on function public.incident_notify_by(date, text, boolean) from public;
revoke all on function public.has_active_subscription(uuid) from public;
grant execute on function public.looks_like_ndis_number(text) to authenticated, service_role;
grant execute on function public.add_business_days(date, integer) to authenticated, service_role;
grant execute on function public.incident_notify_by(date, text, boolean) to authenticated, service_role;
grant execute on function public.has_active_subscription(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Accounts: registration date and kind (FR-4), entered on the account page.
-- ---------------------------------------------------------------------------

alter table public.accounts
  add column registration_date date,
  add column registration_kind text check (registration_kind in ('certification', 'verification'));

-- ---------------------------------------------------------------------------
-- Per-account human references: INC-0001, CMP-0001 (D-903)
-- ---------------------------------------------------------------------------

create table public.register_sequences (
  account_id uuid not null references public.accounts (id) on delete cascade,
  register text not null check (register in ('incidents', 'complaints')),
  next integer not null default 1 check (next >= 1),
  primary key (account_id, register)
);
alter table public.register_sequences enable row level security;
-- No client policies: rows change only through next_register_reference().

-- Hands out the next reference for an account's register. The upsert takes
-- the row lock, so two concurrent inserts get consecutive, distinct numbers.
-- Members of the account and the server may call it.
create or replace function public.next_register_reference(p_account uuid, p_register text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  v_prefix text;
begin
  if not (public.is_member(p_account) or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'not a member of this account' using errcode = '42501';
  end if;
  v_prefix := case p_register
    when 'incidents' then 'INC'
    when 'complaints' then 'CMP'
    else null
  end;
  if v_prefix is null then
    raise exception 'unknown register %', p_register;
  end if;
  insert into public.register_sequences (account_id, register, next)
  values (p_account, p_register, 2)
  on conflict (account_id, register)
  do update set next = public.register_sequences.next + 1
  returning public.register_sequences.next - 1 into v_next;
  return v_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;
revoke all on function public.next_register_reference(uuid, text) from public, anon;
grant execute on function public.next_register_reference(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Incidents and their event trail
-- ---------------------------------------------------------------------------

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- Assigned by the trigger below when the client leaves it null.
  reference text not null default '' check (reference = '' or reference ~ '^INC-[0-9]{4,}$'),
  occurred_on date not null,
  reported_on date not null default current_date check (reported_on >= occurred_on),
  category text not null check (category in (
    'death', 'serious-injury', 'abuse-or-neglect', 'unlawful-sexual-or-physical-contact',
    'sexual-misconduct', 'restrictive-practice-unauthorised', 'near-miss', 'medication',
    'property-or-environment', 'other'
  )),
  severity text not null check (severity in ('low', 'medium', 'high')),
  -- Reference codes, never names (SR-1): P-014, W-003.
  participant_ref text check (participant_ref is null or participant_ref ~ '^[A-Z]{1,3}-?[0-9]{1,6}$'),
  worker_ref text check (worker_ref is null or worker_ref ~ '^W-?[0-9]{1,6}$'),
  summary text not null check (char_length(summary) between 1 and 500 and not public.looks_like_ndis_number(summary)),
  actions_taken text not null default '' check (char_length(actions_taken) <= 2000 and not public.looks_like_ndis_number(actions_taken)),
  -- The provider decides (PO answer 1): a serious injury not connected with supports is not reportable.
  reportable boolean not null default false,
  reportable_notified_on date check (reportable_notified_on is null or reportable),
  notify_by date generated always as (public.incident_notify_by(occurred_on, category, reportable)) stored,
  status text not null default 'open' check (status in ('open', 'under-review', 'closed')),
  closed_on date check ((closed_on is null) = (status <> 'closed')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, reference)
);
create index incidents_account_occurred_idx on public.incidents (account_id, occurred_on desc);
create trigger incidents_set_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

create or replace function public.assign_incident_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference = '' then
    new.reference := public.next_register_reference(new.account_id, 'incidents');
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger incidents_assign_reference
  before insert on public.incidents
  for each row execute function public.assign_incident_reference();

create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  at timestamptz not null default now(),
  actor_user_id uuid default auth.uid(),
  kind text not null check (kind in ('created', 'note', 'status-change', 'reportable-flagged', 'notified')),
  note text not null default '' check (char_length(note) <= 1000 and not public.looks_like_ndis_number(note))
);
create index incident_events_incident_at_idx on public.incident_events (incident_id, at);

-- ---------------------------------------------------------------------------
-- Complaints and their event trail
-- ---------------------------------------------------------------------------

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  reference text not null default '' check (reference = '' or reference ~ '^CMP-[0-9]{4,}$'),
  received_on date not null,
  channel text not null check (channel in ('phone', 'email', 'in-person', 'form', 'advocate', 'other')),
  -- Who raised it, as a code (PO answer 1): P- participant, FAM- family, ADV- advocate, W- worker, OTH- other.
  from_ref text check (from_ref is null or from_ref ~ '^(P|FAM|ADV|W|OTH)-?[0-9]{1,6}$'),
  summary text not null check (char_length(summary) between 1 and 500 and not public.looks_like_ndis_number(summary)),
  outcome text not null default '' check (char_length(outcome) <= 2000 and not public.looks_like_ndis_number(outcome)),
  acknowledged_on date check (acknowledged_on is null or acknowledged_on >= received_on),
  resolved_on date check (resolved_on is null or resolved_on >= received_on),
  status text not null default 'received' check (status in (
    'received', 'acknowledged', 'in-progress', 'resolved', 'escalated-to-commission', 'withdrawn'
  )),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, reference),
  check (status <> 'resolved' or resolved_on is not null)
);
create index complaints_account_received_idx on public.complaints (account_id, received_on desc);
create trigger complaints_set_updated_at
  before update on public.complaints
  for each row execute function public.set_updated_at();

create or replace function public.assign_complaint_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference = '' then
    new.reference := public.next_register_reference(new.account_id, 'complaints');
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger complaints_assign_reference
  before insert on public.complaints
  for each row execute function public.assign_complaint_reference();

create table public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  at timestamptz not null default now(),
  actor_user_id uuid default auth.uid(),
  kind text not null check (kind in ('created', 'note', 'status-change', 'acknowledged', 'resolved')),
  note text not null default '' check (char_length(note) <= 1000 and not public.looks_like_ndis_number(note))
);
create index complaint_events_complaint_at_idx on public.complaint_events (complaint_id, at);

-- ---------------------------------------------------------------------------
-- Worker clearances ("Worker checks" in the UI): kind and expiry, never the
-- clearance number (PO answer 3).
-- ---------------------------------------------------------------------------

create table public.worker_clearances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  worker_ref text not null check (worker_ref ~ '^W-?[0-9]{1,6}$'),
  -- The role, never the person: "support worker", "director".
  role_label text not null check (char_length(role_label) between 1 and 80 and not public.looks_like_ndis_number(role_label)),
  clearance_kind text not null check (clearance_kind in (
    'ndis-worker-screening', 'wwcc', 'police-check', 'first-aid', 'ndis-worker-orientation-module', 'other'
  )),
  issued_on date not null,
  -- Null means no expiry (the orientation module).
  expires_on date check (expires_on is null or expires_on >= issued_on),
  state text check (state is null or state in ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT')),
  note text not null default '' check (char_length(note) <= 500 and not public.looks_like_ndis_number(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index worker_clearances_account_expires_idx on public.worker_clearances (account_id, expires_on);
create trigger worker_clearances_set_updated_at
  before update on public.worker_clearances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Policy reviews: one row per adopted document, next review from the cycle.
-- ---------------------------------------------------------------------------

create table public.policy_reviews (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- A catalogue id from the generator, or 'other' with a title.
  document_type_id text not null check (document_type_id ~ '^[a-z0-9-]{1,80}$'),
  title text not null default '' check (char_length(title) <= 120 and not public.looks_like_ndis_number(title)),
  adopted_on date,
  review_cycle_months integer not null default 12 check (review_cycle_months between 1 and 36),
  last_reviewed_on date check (last_reviewed_on is null or adopted_on is null or last_reviewed_on >= adopted_on),
  next_review_on date generated always as (
    case
      when coalesce(last_reviewed_on, adopted_on) is null then null
      else (coalesce(last_reviewed_on, adopted_on) + (review_cycle_months * interval '1 month'))::date
    end
  ) stored,
  reviewer_ref text check (reviewer_ref is null or reviewer_ref ~ '^W-?[0-9]{1,6}$'),
  note text not null default '' check (char_length(note) <= 500 and not public.looks_like_ndis_number(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (document_type_id <> 'other' or char_length(title) > 0),
  unique (account_id, document_type_id, title)
);
create index policy_reviews_account_next_idx on public.policy_reviews (account_id, next_review_on);
create trigger policy_reviews_set_updated_at
  before update on public.policy_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reminders: derived by the nightly job (Session C), read by members.
-- ---------------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in (
    'clearance-expiry', 'policy-review', 'mid-term-audit', 'renewal',
    'incident-open', 'complaint-unacknowledged', 'reportable-not-notified'
  )),
  subject_table text not null check (subject_table in (
    'incidents', 'complaints', 'worker_clearances', 'policy_reviews', 'accounts'
  )),
  subject_id uuid not null,
  due_on date not null,
  send_on date not null,
  sent_at timestamptz,
  channel text not null default 'email' check (channel in ('email')),
  created_at timestamptz not null default now(),
  unique (account_id, kind, subject_id, due_on)
);
create index reminders_send_idx on public.reminders (send_on) where sent_at is null;
create index reminders_account_due_idx on public.reminders (account_id, due_on);

-- ---------------------------------------------------------------------------
-- Status views (FR-2): computed at read time, never stored. security_invoker
-- so the base tables' policies apply to whoever reads the view.
-- ---------------------------------------------------------------------------

create view public.worker_clearances_status
with (security_invoker = true) as
select
  c.*,
  case
    when c.expires_on is null then 'valid'
    when c.expires_on < current_date then 'expired'
    when c.expires_on <= current_date + 90 then 'expiring'
    else 'valid'
  end as status
from public.worker_clearances c;

create view public.policy_reviews_status
with (security_invoker = true) as
select
  r.*,
  case
    when r.next_review_on is null then 'not-adopted'
    when r.next_review_on < current_date then 'overdue'
    when r.next_review_on <= current_date + 60 then 'due-soon'
    else 'current'
  end as status
from public.policy_reviews r;

create view public.incidents_status
with (security_invoker = true) as
select
  i.*,
  case
    when i.reportable and i.reportable_notified_on is null and i.notify_by is not null and i.notify_by < current_date
      then 'overdue-notification'
    when i.reportable and i.reportable_notified_on is null and i.notify_by is not null
      then 'notification-due'
    else i.status
  end as notification_status
from public.incidents i;

-- ---------------------------------------------------------------------------
-- Row-level security (SR-2): members read; members with an active
-- subscription insert and update; owners delete; event tables are append-only.
-- ---------------------------------------------------------------------------

alter table public.incidents enable row level security;
alter table public.incident_events enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_events enable row level security;
alter table public.worker_clearances enable row level security;
alter table public.policy_reviews enable row level security;
alter table public.reminders enable row level security;

create policy incidents_select_member on public.incidents
  for select to authenticated using (public.is_member(account_id));
create policy incidents_insert_subscribed on public.incidents
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy incidents_update_subscribed on public.incidents
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy incidents_delete_owner on public.incidents
  for delete to authenticated using (public.is_owner(account_id));

create policy incident_events_select_member on public.incident_events
  for select to authenticated using (public.is_member(account_id));
create policy incident_events_insert_subscribed on public.incident_events
  for insert to authenticated with check (
    public.is_member(account_id)
    and public.has_active_subscription(account_id)
    and exists (
      select 1 from public.incidents i
      where i.id = incident_events.incident_id and i.account_id = incident_events.account_id
    )
  );
create policy incident_events_delete_owner on public.incident_events
  for delete to authenticated using (public.is_owner(account_id));

create policy complaints_select_member on public.complaints
  for select to authenticated using (public.is_member(account_id));
create policy complaints_insert_subscribed on public.complaints
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy complaints_update_subscribed on public.complaints
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy complaints_delete_owner on public.complaints
  for delete to authenticated using (public.is_owner(account_id));

create policy complaint_events_select_member on public.complaint_events
  for select to authenticated using (public.is_member(account_id));
create policy complaint_events_insert_subscribed on public.complaint_events
  for insert to authenticated with check (
    public.is_member(account_id)
    and public.has_active_subscription(account_id)
    and exists (
      select 1 from public.complaints c
      where c.id = complaint_events.complaint_id and c.account_id = complaint_events.account_id
    )
  );
create policy complaint_events_delete_owner on public.complaint_events
  for delete to authenticated using (public.is_owner(account_id));

create policy worker_clearances_select_member on public.worker_clearances
  for select to authenticated using (public.is_member(account_id));
create policy worker_clearances_insert_subscribed on public.worker_clearances
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy worker_clearances_update_subscribed on public.worker_clearances
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy worker_clearances_delete_owner on public.worker_clearances
  for delete to authenticated using (public.is_owner(account_id));

create policy policy_reviews_select_member on public.policy_reviews
  for select to authenticated using (public.is_member(account_id));
create policy policy_reviews_insert_subscribed on public.policy_reviews
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy policy_reviews_update_subscribed on public.policy_reviews
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy policy_reviews_delete_owner on public.policy_reviews
  for delete to authenticated using (public.is_owner(account_id));

-- Reminders are written by the server only; members read their own.
create policy reminders_select_member on public.reminders
  for select to authenticated using (public.is_member(account_id));

-- ---------------------------------------------------------------------------
-- Explicit privileges (D-052): the hosted project carries no default grants.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  public.incidents, public.complaints, public.worker_clearances, public.policy_reviews
  to authenticated;
-- Append-only for clients: no update privilege on the event tables.
grant select, insert, delete on public.incident_events, public.complaint_events to authenticated;
grant select on public.reminders to authenticated;
grant select on
  public.worker_clearances_status, public.policy_reviews_status, public.incidents_status
  to authenticated, service_role;
grant all privileges on
  public.incidents, public.incident_events, public.complaints, public.complaint_events,
  public.worker_clearances, public.policy_reviews, public.reminders, public.register_sequences
  to service_role;
revoke all on public.register_sequences from anon, authenticated;
revoke all on
  public.incidents, public.incident_events, public.complaints, public.complaint_events,
  public.worker_clearances, public.policy_reviews, public.reminders,
  public.worker_clearances_status, public.policy_reviews_status, public.incidents_status
  from anon;

notify pgrst, 'reload schema';

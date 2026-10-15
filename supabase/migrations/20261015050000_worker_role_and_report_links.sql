-- REQ-020 Session B (FR-4, FR-5, FR-6, FR-11, SR-1, SR-2, SR-3, SR-5; D-2231):
-- the worker role, invitations, the report link and draft incidents.
--
-- 1. The worker role. `memberships.role` gains 'worker' and the worker's
--    code. `is_member` now means owner or member only, so every existing
--    policy keeps its meaning and a worker reads nothing through them;
--    `is_worker` is the narrow gate for the worker's own incident and
--    complaint rows. A worker may read their own membership row (the app
--    resolves who they are with their session) and the owner may remove a
--    worker.
alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check check (role in ('owner', 'member', 'worker'));
alter table public.memberships
  add column worker_ref text check (worker_ref is null or worker_ref ~ '^W-?[0-9]{1,6}$');

create or replace function public.is_member(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.account_id = p_account
      and m.user_id = auth.uid()
      and m.role in ('owner', 'member')
      and a.deleted_at is null
  );
$$;

create or replace function public.is_worker(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.account_id = p_account
      and m.user_id = auth.uid()
      and m.role = 'worker'
      and a.deleted_at is null
  );
$$;
revoke all on function public.is_worker(uuid) from public;
grant execute on function public.is_worker(uuid) to authenticated, service_role;

create policy memberships_select_own on public.memberships
  for select to authenticated using (user_id = auth.uid());
create policy memberships_delete_owner_worker on public.memberships
  for delete to authenticated using (public.is_owner(account_id) and role = 'worker');
grant delete on public.memberships to authenticated;

-- 2. Invitations: the owner invites a worker by email; only the email's hash
--    is stored; the token is stored hashed; seven days; accepted once by a
--    signed-in user whose email hashes the same.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  role text not null default 'worker' check (role = 'worker'),
  worker_ref text not null check (worker_ref ~ '^W-?[0-9]{1,6}$'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index invitations_account_idx on public.invitations (account_id, created_at desc);
alter table public.invitations enable row level security;
create policy invitations_select_member on public.invitations
  for select to authenticated using (public.is_member(account_id));
create policy invitations_insert_owner on public.invitations
  for insert to authenticated with check (public.is_owner(account_id));
create policy invitations_update_owner on public.invitations
  for update to authenticated
  using (public.is_owner(account_id)) with check (public.is_owner(account_id));
grant select, insert, update on public.invitations to authenticated;
revoke delete on public.invitations from anon, authenticated;
grant all privileges on public.invitations to service_role;
revoke all on public.invitations from anon;

-- The signed-out invite page needs the business name only (service key).
create or replace function public.invitation_preview(p_token_hash text)
returns table (trading_name text, worker_ref text)
language sql
security definer
set search_path = public
stable
as $$
  select a.trading_name, i.worker_ref
  from public.invitations i
  join public.accounts a on a.id = i.account_id
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and a.deleted_at is null
$$;
revoke all on function public.invitation_preview(text) from public, anon, authenticated;
grant execute on function public.invitation_preview(text) to service_role;

-- Accepting: the server action passes the signed-in user's id and the
-- peppered hash of their session email (HMAC-SHA-256 under HASH_PEPPER,
-- retro review of REQ-018 to 021, finding 34; the database never holds the
-- pepper, so it cannot compute the hash itself). The invitation's email
-- hash must equal it; the owner of the account cannot demote themselves by
-- accepting their own invitation. The function is the service key's alone,
-- so a signed-in session cannot call it with a hash of its own choosing.
-- Returns the account id, or null when nothing matched (no reason, SR-1).
create or replace function public.accept_invitation(p_token_hash text, p_user_id uuid, p_email_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
begin
  if p_user_id is null or p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into v_inv from public.invitations
    where token_hash = p_token_hash
      and accepted_at is null and revoked_at is null and expires_at > now()
    limit 1;
  if not found then return null; end if;
  if v_inv.email_hash <> p_email_hash then return null; end if;
  if exists (select 1 from public.memberships where user_id = p_user_id and account_id = v_inv.account_id and role <> 'worker') then
    return null;
  end if;
  insert into public.memberships (user_id, account_id, role, worker_ref)
    values (p_user_id, v_inv.account_id, 'worker', v_inv.worker_ref)
    on conflict (user_id, account_id) do update set worker_ref = excluded.worker_ref;
  update public.invitations set accepted_at = now() where id = v_inv.id;
  insert into public.audit_log (account_id, actor_user_id, action, target)
    values (v_inv.account_id, p_user_id, 'invitation.accepted', v_inv.id::text || ' ' || v_inv.worker_ref);
  return v_inv.account_id;
end;
$$;
revoke all on function public.accept_invitation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_invitation(text, uuid, text) to service_role;

-- 3. Incidents: draft reports, who logged them, when the provider became
--    aware (the Rules' clock runs from awareness, and a worker is part of
--    the provider), and the rejected reason.
drop view public.incidents_status;
alter table public.incidents drop constraint incidents_status_check;
alter table public.incidents
  add constraint incidents_status_check check (status in ('draft', 'open', 'under-review', 'closed', 'rejected'));
alter table public.incidents
  add column reported_via text not null default 'owner' check (reported_via in ('owner', 'worker', 'link')),
  -- A worker code or one of the five name-free roles, never free text (retro review of REQ-020, finding 31; REPORTER_ROLES in src/lib/registers/worker.ts).
  add column logged_by_ref text check (logged_by_ref is null or logged_by_ref ~ '^W-?[0-9]{1,6}$' or logged_by_ref in ('support worker', 'casual worker', 'team leader', 'volunteer', 'another person present')),
  add column rejected_reason text not null default '' check (char_length(rejected_reason) <= 500 and not public.looks_like_ndis_number(rejected_reason)),
  add column aware_at timestamptz not null default now(),
  add column aware_on date;
-- Every row that exists was typed by the provider, aware no later than the
-- day it happened (D-902: early, never late; run 38729625480 showed a
-- default of today moving notify_by past the occurred date).
update public.incidents set aware_on = occurred_on where aware_on is null;
alter table public.incidents alter column aware_on set not null;

-- The trigger that assigns the reference also fills aware_on from the
-- occurred date when the row does not say (the owner's form always says;
-- the report link's function sets the submission day). Before-insert
-- triggers run before the NOT NULL check, so the column needs no default.
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
  if new.aware_on is null then
    new.aware_on := new.occurred_on;
  end if;
  return new;
end;
$$;

-- A worker's own row takes a reference too: the counter admits the worker
-- role beside members and the server (run 38729625480: 42501 "not a member
-- of this account" on the worker's insert, because is_member no longer
-- means a worker).
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
  if not (
    public.is_member(p_account)
    or public.is_worker(p_account)
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  ) then
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

-- The notification clock runs from the later of the event and the day the provider became aware.
alter table public.incidents drop column notify_by;
alter table public.incidents
  add column notify_by date generated always as (public.incident_notify_by(greatest(occurred_on, aware_on), category, reportable, severity)) stored;
-- The original rule was written inline on `reported_on` in
-- 20261013000000_registers.sql; because its expression also names
-- occurred_on, Postgres named it incidents_check, not
-- incidents_reported_on_check (run 38721710508, PR #62). Find it by its
-- definition and drop it, whatever its name.
do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'public.incidents'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%reported_on >= occurred_on%';
  if v_name is null then
    raise exception 'incidents: the reported_on >= occurred_on CHECK was not found';
  end if;
  execute format('alter table public.incidents drop constraint %I', v_name);
end
$$;
alter table public.incidents
  add constraint incidents_reported_on_check check (reported_on >= occurred_on or status = 'draft');

alter table public.incident_events drop constraint incident_events_kind_check;
alter table public.incident_events
  add constraint incident_events_kind_check check (kind in ('created', 'note', 'status-change', 'reportable-flagged', 'notified', 'reported', 'confirmed', 'rejected'));

create view public.incidents_status
with (security_invoker = true) as
select
  i.*,
  case
    when i.status = 'draft' then 'draft'
    when i.status = 'rejected' then 'rejected'
    when i.reportable and i.reportable_notified_on is null and i.notify_by is not null and i.notify_by < current_date
      then 'overdue-notification'
    when i.reportable and i.reportable_notified_on is null and i.notify_by is not null
      then 'notification-due'
    else i.status
  end as notification_status
from public.incidents i;
grant select on public.incidents_status to authenticated, service_role;
revoke all on public.incidents_status from anon;

-- The worker's own rows: select and insert on incidents and complaints,
-- their 'created' events, nothing else (SR-2). The subscription gate holds
-- for a worker as for the owner.
create policy incidents_select_worker_own on public.incidents
  for select to authenticated using (public.is_worker(account_id) and created_by = auth.uid());
create policy incidents_insert_worker_own on public.incidents
  for insert to authenticated with check (
    public.is_worker(account_id) and public.has_active_subscription(account_id)
    and created_by = auth.uid() and reported_via = 'worker' and status = 'open'
  );
create policy incident_events_insert_worker_own on public.incident_events
  for insert to authenticated with check (
    public.is_worker(account_id)
    and exists (select 1 from public.incidents i where i.id = incident_id and i.account_id = account_id and i.created_by = auth.uid())
  );
create policy complaints_select_worker_own on public.complaints
  for select to authenticated using (public.is_worker(account_id) and created_by = auth.uid());
create policy complaints_insert_worker_own on public.complaints
  for insert to authenticated with check (
    public.is_worker(account_id) and public.has_active_subscription(account_id) and created_by = auth.uid()
  );
create policy complaint_events_insert_worker_own on public.complaint_events
  for insert to authenticated with check (
    public.is_worker(account_id)
    and exists (select 1 from public.complaints c where c.id = complaint_id and c.account_id = account_id and c.created_by = auth.uid())
  );

-- 4. The report link: one per account, revocable and regenerable, and the
--    one function a signed-out report writes through: it validates the
--    token, refuses an eleventh unconfirmed draft, inserts a draft row with
--    awareness fixed at submission, and its 'reported' event. No read path.
create table public.report_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index report_links_account_idx on public.report_links (account_id, created_at desc);
alter table public.report_links enable row level security;
create policy report_links_select_member on public.report_links
  for select to authenticated using (public.is_member(account_id));
create policy report_links_insert_owner on public.report_links
  for insert to authenticated with check (public.is_owner(account_id));
create policy report_links_update_owner on public.report_links
  for update to authenticated
  using (public.is_owner(account_id)) with check (public.is_owner(account_id));
grant select, insert, update on public.report_links to authenticated;
revoke delete on public.report_links from anon, authenticated;
grant all privileges on public.report_links to service_role;
revoke all on public.report_links from anon;

create or replace function public.report_link_lookup(p_token_hash text)
returns table (link_id uuid, account_id uuid, trading_name text)
language sql
security definer
set search_path = public
stable
as $$
  select l.id, l.account_id, a.trading_name
  from public.report_links l
  join public.accounts a on a.id = l.account_id
  where l.token_hash = p_token_hash and l.revoked_at is null and a.deleted_at is null
$$;
revoke all on function public.report_link_lookup(text) from public, anon, authenticated;
grant execute on function public.report_link_lookup(text) to service_role;

create or replace function public.submit_incident_report(
  p_token_hash text,
  p_occurred_on date,
  p_category text,
  p_severity text,
  p_participant_ref text,
  p_worker_ref text,
  p_summary text,
  p_actions_taken text,
  p_reporter text
)
returns table (incident_id uuid, reference text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_id uuid;
  v_ref text;
begin
  select l.account_id into v_account
    from public.report_links l join public.accounts a on a.id = l.account_id
    where l.token_hash = p_token_hash and l.revoked_at is null and a.deleted_at is null
    limit 1;
  if v_account is null then raise exception 'report link not found' using errcode = 'P0002'; end if;
  if (select count(*) from public.incidents where account_id = v_account and status = 'draft') >= 10 then
    raise exception 'too many unconfirmed reports' using errcode = 'P0003';
  end if;
  insert into public.incidents (
    account_id, occurred_on, reported_on, category, severity, participant_ref, worker_ref,
    summary, actions_taken, status, reported_via, logged_by_ref, aware_at, aware_on, created_by
  ) values (
    v_account, p_occurred_on, current_date, p_category, p_severity,
    nullif(p_participant_ref, ''), nullif(p_worker_ref, ''),
    p_summary, coalesce(p_actions_taken, ''), 'draft', 'link', p_reporter, now(),
    (now() at time zone 'Australia/Sydney')::date, null
  ) returning id, incidents.reference into v_id, v_ref;
  insert into public.incident_events (incident_id, account_id, actor_user_id, kind, note)
    values (v_id, v_account, null, 'reported', 'Reported through the report link by ' || p_reporter);
  return query select v_id, v_ref;
end;
$$;
revoke all on function public.submit_incident_report(text, date, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_incident_report(text, date, text, text, text, text, text, text, text) to service_role;

-- 5. Reminders: the owner is nudged while a report waits.
alter table public.reminders drop constraint reminders_kind_check;
alter table public.reminders
  add constraint reminders_kind_check check (kind in (
    'clearance-expiry', 'policy-review', 'mid-term-audit', 'renewal',
    'incident-open', 'complaint-unacknowledged', 'reportable-not-notified',
    'insurance-expiry', 'supervision-due', 'appraisal-due',
    'support-plan-review', 'emergency-drill', 'register-review',
    'report-to-confirm'
  ));

notify pgrst, 'reload schema';

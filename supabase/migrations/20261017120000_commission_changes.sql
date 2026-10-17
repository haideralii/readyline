-- REQ-023 Session D (Dev-2): the changes register, "Changes we told the Commission" (FR-10; D-2306 as
-- amended, D-2311, D-2316 to D-2319, D-2341). One row per notification (Provider Registration and
-- Practice Standards Rules s 13, s 13A) or variation (NDIS Act s 73M); the later dates are updates,
-- each one line in the shared trail; a status view computes notify_by and state as FR-10 and D-2306
-- define them with the Sydney day (D-2272). Revoke-then-grant per verb (D-2245); the row's code comes
-- from next_register_reference as the incidents' and complaints' do.

create table public.commission_changes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- The row's own code, CHG-0001, set by the trigger below.
  reference text not null default '',
  kind text not null check (kind in ('notification', 'variation')),
  -- The closed list per kind, mirrored by src/lib/registers/commission-changes.ts (a test holds them equal).
  change_type text not null check (change_type in (
    'contact-details', 'area', 'locations', 'participant-numbers', 'worker-numbers',
    'condition-event', 'access-change', 'financial-capacity', 'organisation-governance',
    'key-personnel-change', 'key-personnel-suitability', 'change-of-ownership',
    'supports-registered'
  )),
  -- The day it happened; for a change of ownership the first necessary step (s 13A(3)); for a variation the day the change is wanted from.
  happened_on date not null,
  -- The day the provider knew it would happen (s 13A: the notify-by date when it comes first).
  aware_on date,
  notified_on date,
  channel text check (channel is null or channel in ('portal', 'email', 'other')),
  approved_form text check (approved_form is null or approved_form in ('yes', 'no', 'unsure')),
  applied_on date,
  decided_on date,
  effective_on date,
  -- The Commission's reference, if any: the clearance-number shape (letters, digits, space, / and -), at most 40, never an NDIS number (SR-1).
  commission_reference text not null default '' check (
    commission_reference ~ '^[A-Za-z0-9 /-]*$'
    and char_length(commission_reference) <= 40
    and not public.looks_like_ndis_number(commission_reference)
  ),
  note text not null default '' check (char_length(note) <= 500 and not public.looks_like_ndis_number(note)),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A notification carries no variation dates, a variation no notification fields, and each kind its own types.
  check (kind <> 'notification' or (applied_on is null and decided_on is null and effective_on is null)),
  check (kind <> 'variation' or (notified_on is null and channel is null and approved_form is null)),
  check ((kind = 'variation') = (change_type = 'supports-registered')),
  check (decided_on is null or applied_on is not null),
  check (effective_on is null or decided_on is not null),
  check (notified_on is null or approved_form is not null)
);
create index commission_changes_account_idx on public.commission_changes (account_id, happened_on desc);
create trigger commission_changes_set_updated_at
  before update on public.commission_changes
  for each row execute function public.set_updated_at();

-- The row code: CHG-0001 (the function gains the prefix; the body is 20261015050000's with one line added).
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
    when 'commission_changes' then 'CHG'
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

create or replace function public.commission_changes_set_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := public.next_register_reference(new.account_id, 'commission_changes');
  end if;
  return new;
end;
$$;
create trigger commission_changes_reference
  before insert on public.commission_changes
  for each row execute function public.commission_changes_set_reference();

alter table public.commission_changes enable row level security;
create policy commission_changes_select_member on public.commission_changes
  for select to authenticated using (public.is_member(account_id));
create policy commission_changes_insert_subscribed on public.commission_changes
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy commission_changes_update_subscribed on public.commission_changes
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
-- No delete policy: append-only like the registers; the trail is the history.

-- The state (FR-10; D-2306 as amended; D-2311):
--   a s 13 notification has no notify_by and is 'to notify' until notified, never 'overdue';
--   a s 13A notification's notify_by is the earlier of aware_on and happened_on, 'overdue' when none is recorded and the day has passed;
--   a notified row is 'notified' only when the approved-form answer is yes, else 'told, form not confirmed';
--   a variation is 'to apply', 'applied' or 'decided'.
create view public.commission_changes_status with (security_invoker = true) as
select
  c.*,
  case
    when c.kind = 'variation' then null
    when c.change_type in ('contact-details', 'area', 'locations', 'participant-numbers', 'worker-numbers') then null
    else least(c.aware_on, c.happened_on)
  end as notify_by,
  case
    when c.kind = 'variation' then
      case
        when c.decided_on is not null then 'decided'
        when c.applied_on is not null then 'applied'
        else 'to apply'
      end
    when c.notified_on is not null then
      case when c.approved_form = 'yes' then 'notified' else 'told, form not confirmed' end
    when c.change_type in ('contact-details', 'area', 'locations', 'participant-numbers', 'worker-numbers') then 'to notify'
    when least(c.aware_on, c.happened_on) < public.sydney_today() then 'overdue'
    else 'to notify'
  end as state
from public.commission_changes c;

revoke all on public.commission_changes from anon, authenticated;
grant select, insert, update on public.commission_changes to authenticated;
revoke all on public.commission_changes_status from anon, authenticated;
grant select on public.commission_changes_status to authenticated, service_role;
grant all privileges on public.commission_changes to service_role;

-- The shared trail takes the register (the list 20261017000000 leaves, plus this one).
alter table public.register_events drop constraint register_events_register_check;
alter table public.register_events add constraint register_events_register_check check (register in (
  'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
  'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists',
  'hazards', 'incidents', 'complaints', 'worker_clearances',
  'onboarding_items', 'risk_assessed_roles', 'commission_changes'
));

notify pgrst, 'reload schema';

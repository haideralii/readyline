-- REQ-033 Session A (FR-3, FR-5, SR-2, SR-3; D-2929, D-2932, D-2935): the audit findings register.
-- One row per finding from the provider's last audit, in the provider's words (the gate in the
-- action keeps participant details out, SR-2), with the standard it is against, the auditor's
-- severity and due date, and the provider's record of addressing it and of the auditor's
-- verification; linked to the continuous improvement row that carries the corrective action.

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  reference text not null default '',
  -- A standards.json id ("core.governance.incident-management"), or '' while unmapped (D-2933).
  standard_id text not null default '' check (standard_id ~ '^[a-z0-9.-]{0,120}$'),
  indicator text not null default '' check (char_length(indicator) <= 500 and not public.looks_like_ndis_number(indicator)),
  severity text not null check (severity in ('major', 'minor', 'observation')),
  finding text not null check (char_length(finding) between 1 and 500 and not public.looks_like_ndis_number(finding)),
  due_on date,
  status text not null default 'open' check (status in ('open', 'addressed', 'verified')),
  addressed_on date,
  addressed_by_role text not null default '' check (char_length(addressed_by_role) <= 80 and not public.looks_like_ndis_number(addressed_by_role)),
  verified_on date,
  improvement_id uuid references public.improvements (id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'addressed' or addressed_on is not null),
  check (status <> 'verified' or (addressed_on is not null and verified_on is not null))
);
create index findings_account_idx on public.findings (account_id, created_at desc);
create trigger findings_set_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at();

-- The reference: FND-0001 through the shared sequence, as incidents, complaints and changes get theirs.
alter table public.register_sequences drop constraint register_sequences_register_check;
alter table public.register_sequences add constraint register_sequences_register_check
  check (register in ('incidents', 'complaints', 'commission_changes', 'findings'));

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
    when 'findings' then 'FND'
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

create or replace function public.findings_set_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := public.next_register_reference(new.account_id, 'findings');
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger findings_reference
  before insert on public.findings
  for each row execute function public.findings_set_reference();

-- RLS as the other registers: members read, subscribed members write, the owner deletes.
alter table public.findings enable row level security;
create policy findings_select_member on public.findings
  for select to authenticated using (public.is_member(account_id));
create policy findings_insert_subscribed on public.findings
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy findings_update_subscribed on public.findings
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy findings_delete_owner on public.findings
  for delete to authenticated using (public.is_owner(account_id));

-- The state the list shows: the stored status, or 'overdue' for an open finding past the auditor's date.
create view public.findings_status with (security_invoker = true) as
select
  f.*,
  case
    when f.status = 'open' and f.due_on is not null and f.due_on < public.sydney_today() then 'overdue'
    else f.status
  end as state
from public.findings f;

revoke all on public.findings from anon, authenticated;
grant select, insert, update, delete on public.findings to authenticated;
grant all privileges on public.findings to service_role;
revoke all on public.findings_status from anon, authenticated;
grant select on public.findings_status to authenticated, service_role;

-- The shared trail takes the register's rows (D-1902).
alter table public.register_events drop constraint register_events_register_check;
alter table public.register_events add constraint register_events_register_check check (register in (
  'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
  'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists',
  'hazards', 'incidents', 'complaints', 'worker_clearances',
  'onboarding_items', 'risk_assessed_roles', 'screening_exceptions', 'commission_changes',
  'policy_acknowledgements', 'supervision_entries', 'findings'
));

-- FR-5 (D-2935): the improvement row a finding creates names its source as an audit finding.
alter table public.improvements drop constraint improvements_source_kind_check;
alter table public.improvements add constraint improvements_source_kind_check check (source_kind in (
  'incident', 'complaint', 'feedback', 'survey', 'internal-audit', 'external-audit', 'other', 'self-check',
  'audit-finding'
));

notify pgrst, 'reload schema';

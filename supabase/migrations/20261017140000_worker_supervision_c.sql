-- REQ-024 Session C: supervision rows, the staff-matrix import and the trail
-- (FR-11, FR-12, FR-13; Data; D-2283, D-2287; findings 66, 78, 110 and 175).
-- Hour 14 (D-2835): after every migration on `next` at the push (Dev-2's hour
-- 12 rewrote the trail's CHECK after this file's first hour, 07, and took
-- its entry away in #104's run).
-- Workers and supervisors stay codes: no name, no date of birth, no address.
--
-- 1. `supervision_entries`: the history behind `staff_matrix.last_supervision_on`.
-- 2. The trigger that keeps that one column the latest `held_on` for the
--    code on insert, update and delete, so the form, the import and a
--    correction all leave the `supervision-due` reminder reading one date.
-- 3. The trail knows the register; the imports table takes `staff_matrix`.

-- ---------------------------------------------------------------------------
-- 1. supervision_entries (FR-11; finding 78)
-- ---------------------------------------------------------------------------
create table public.supervision_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  worker_ref text not null check (worker_ref ~ '^W-?[0-9]{1,6}$'),
  kind text not null check (kind in ('supervision', 'probation-review', 'conversation')),
  held_on date not null,
  -- The supervisor's code: the owner's KP- code or a worker's W- code; a name is a fill field, never stored.
  by_ref text not null check (by_ref ~ '^(W|KP)-?[0-9]{1,6}$'),
  -- What was covered, not how the worker performed; empty for a probation review (finding 78).
  note text not null default '' check (char_length(note) <= 500 and not public.looks_like_ndis_number(note)),
  -- A probation review carries an outcome and nothing else does.
  outcome text check (outcome is null or outcome in ('continued', 'extended', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supervision_entries_outcome_kind_check check ((kind = 'probation-review') = (outcome is not null)),
  constraint supervision_entries_review_note_check check (kind <> 'probation-review' or note = '')
);
create index supervision_entries_worker_idx on public.supervision_entries (account_id, worker_ref, held_on);
create trigger supervision_entries_set_updated_at
  before update on public.supervision_entries
  for each row execute function public.set_updated_at();
alter table public.supervision_entries enable row level security;
-- RLS as every register: members read, members write under the subscription gate; the worker has no policy here.
create policy supervision_entries_select_member on public.supervision_entries
  for select to authenticated using (public.is_member(account_id));
create policy supervision_entries_insert_subscribed on public.supervision_entries
  for insert to authenticated with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy supervision_entries_update_subscribed on public.supervision_entries
  for update to authenticated
  using (public.is_member(account_id) and public.has_active_subscription(account_id))
  with check (public.is_member(account_id) and public.has_active_subscription(account_id));
create policy supervision_entries_delete_subscribed on public.supervision_entries
  for delete to authenticated using (public.is_member(account_id) and public.has_active_subscription(account_id));
revoke all on public.supervision_entries from anon, authenticated;
grant select, insert, update, delete on public.supervision_entries to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The one date the reminder reads (FR-5, FR-11): while a worker has
--    entries, the column is the latest `held_on` of any kind, recomputed
--    after every insert, update and delete; with no entry left, the date
--    the owner typed on the row stands as before.
-- ---------------------------------------------------------------------------
create or replace function public.supervision_entries_set_last()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last date;
begin
  select max(e.held_on) into v_last
  from public.supervision_entries e
  where e.account_id = coalesce(new.account_id, old.account_id)
    and e.worker_ref = coalesce(new.worker_ref, old.worker_ref);
  if v_last is not null then
    update public.staff_matrix s set last_supervision_on = v_last
     where s.account_id = coalesce(new.account_id, old.account_id)
       and s.worker_ref = coalesce(new.worker_ref, old.worker_ref);
  end if;
  -- An update that moved the entry to another code recomputes the old code too.
  if tg_op = 'UPDATE' and (old.worker_ref <> new.worker_ref or old.account_id <> new.account_id) then
    select max(e.held_on) into v_last
    from public.supervision_entries e
    where e.account_id = old.account_id and e.worker_ref = old.worker_ref;
    if v_last is not null then
      update public.staff_matrix s set last_supervision_on = v_last
       where s.account_id = old.account_id and s.worker_ref = old.worker_ref;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.supervision_entries_set_last() from public, anon, authenticated;
create trigger supervision_entries_set_last
  after insert or update or delete on public.supervision_entries
  for each row execute function public.supervision_entries_set_last();

-- ---------------------------------------------------------------------------
-- 3. The trail and the imports (FR-12, FR-13; finding 66; D-2835)
-- ---------------------------------------------------------------------------
-- The trail's list starts from 20261017120000_commission_changes.sql's (the
-- last to rewrite it on `next`) and adds B's `policy_acknowledgements`, which
-- hour 12 had not seen, and `supervision_entries`.
alter table public.register_events drop constraint register_events_register_check;
alter table public.register_events add constraint register_events_register_check check (register in (
  'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
  'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists',
  'hazards', 'incidents', 'complaints', 'worker_clearances',
  'onboarding_items', 'risk_assessed_roles', 'screening_exceptions', 'commission_changes',
  'policy_acknowledgements', 'supervision_entries'
));

-- The imports' list starts from 20261015060000_hazards_imports_self_checks.sql's
-- (no migration since has rewritten it) and adds REQ-023 D's `commission_changes`,
-- whose import page is on `next` without it, and `staff_matrix`.
alter table public.imports drop constraint imports_register_check;
alter table public.imports add constraint imports_register_check check (register in (
  'incidents', 'complaints', 'worker_clearances', 'corporate_risks', 'commission_changes', 'staff_matrix'
));

notify pgrst, 'reload schema';

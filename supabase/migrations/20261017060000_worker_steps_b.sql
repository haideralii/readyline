-- REQ-024 Session B (FR-7, FR-8, FR-9; SR-2; Data; D-2417 as amended, D-2429,
-- D-2438; Dev D-2282): the worker's own steps through the worker role.
--
-- 1. `policy_acknowledgements`: one row per worker, document and version
--    (W-3 the Code of Conduct acknowledgement, W-6 the mandatory policies),
--    append-only for clients: members read, the worker reads and inserts
--    their own rows (the code the membership carries, no other), the owner
--    inserts for any code of the account, nobody updates or deletes through
--    the API; writes are gated by the subscription as every register write
--    is, reads never (D-2415). The column is `document_type_id`, the name
--    `document_versions` uses, where the Data section wrote `document_slug`.
-- 2. `register_events.register` gains the table.
-- 3. `document_versions_worker`: the worker reads the type id, the version
--    and the adoption day of the account's adopted, ready document versions
--    (no content, no storage path, no model) through a `security_barrier`
--    view with the membership join inside, as the two A1 views do, so the
--    acknowledgement list stays inside RLS (Dev response question 3).
-- Revoke before grant throughout (D-2243, D-2245).

create table public.policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  worker_ref text not null check (worker_ref ~ '^W-?[0-9]{1,6}$'),
  document_type_id text not null check (document_type_id ~ '^[a-z0-9-]{1,80}$'),
  version integer not null check (version >= 1),
  acknowledged_on date not null default public.sydney_today(),
  created_at timestamptz not null default now(),
  unique (account_id, worker_ref, document_type_id, version)
);
create index policy_acknowledgements_worker_idx
  on public.policy_acknowledgements (account_id, worker_ref);

alter table public.policy_acknowledgements enable row level security;

create policy policy_acknowledgements_select_member on public.policy_acknowledgements
  for select to authenticated using (public.is_member(account_id));
create policy policy_acknowledgements_select_worker on public.policy_acknowledgements
  for select to authenticated using (
    public.is_worker(account_id)
    and exists (
      select 1 from public.memberships m
      where m.account_id = policy_acknowledgements.account_id
        and m.user_id = auth.uid() and m.role = 'worker'
        and m.worker_ref = policy_acknowledgements.worker_ref
    )
  );
create policy policy_acknowledgements_insert_owner on public.policy_acknowledgements
  for insert to authenticated with check (
    public.is_owner(account_id) and public.has_active_subscription(account_id)
  );
-- The worker's own code alone (AC-6: another worker's code answers 42501).
create policy policy_acknowledgements_insert_worker on public.policy_acknowledgements
  for insert to authenticated with check (
    public.is_worker(account_id)
    and public.has_active_subscription(account_id)
    and exists (
      select 1 from public.memberships m
      join public.accounts a on a.id = m.account_id
      where m.account_id = policy_acknowledgements.account_id
        and m.user_id = auth.uid() and m.role = 'worker'
        and m.worker_ref = policy_acknowledgements.worker_ref
        and a.deleted_at is null
    )
  );
-- No update and no delete policy: an acknowledgement is a record.

revoke all on public.policy_acknowledgements from anon, authenticated;
grant select, insert on public.policy_acknowledgements to authenticated;

-- 2. The trail knows the register.
alter table public.register_events drop constraint register_events_register_check;
alter table public.register_events add constraint register_events_register_check check (register in (
  'corporate_risks', 'participant_risks', 'conflicts_of_interest', 'delegations',
  'insurance_items', 'improvements', 'staff_matrix', 'onboarding_checklists',
  'hazards', 'incidents', 'complaints', 'worker_clearances',
  'onboarding_items', 'risk_assessed_roles', 'screening_exceptions',
  'policy_acknowledgements'
));

-- 3. The worker's read of the adopted documents' names and versions.
create view public.document_versions_worker with (security_barrier = true) as
select v.id, v.account_id, v.document_type_id, v.version, v.adopted_on
from public.document_versions v
where v.status = 'ready' and v.adopted_on is not null
  and exists (
    select 1 from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.account_id = v.account_id and m.user_id = auth.uid() and m.role = 'worker'
      and a.deleted_at is null
  );
revoke all on public.document_versions_worker from anon, authenticated;
grant select on public.document_versions_worker to authenticated, service_role;

notify pgrst, 'reload schema';

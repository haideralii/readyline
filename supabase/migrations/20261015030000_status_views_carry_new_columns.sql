-- Batch 45, PR #56 run 38664169702: a view written as `select c.*` freezes
-- its column list when it is created, so `worker_clearances_status` never
-- carried `clearance_number` (item 22, migration 20261015010000) and
-- `incidents_status` never carried `commission_reference` (item 30,
-- migration 20261015020000). The list pages, the detail pages and the CSV
-- exports read the views, so both columns read back empty. Recreate the two
-- views with the same definitions (the `*` now expands to every column) and
-- restore their grants, which `drop view` removes. Any later column on
-- these tables needs the same step; tests/integration/registers-rls.test.ts
-- reads both columns back through the views.

drop view public.worker_clearances_status;
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

drop view public.incidents_status;
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

grant select on public.worker_clearances_status, public.incidents_status
  to authenticated, service_role;
revoke all on public.worker_clearances_status, public.incidents_status from anon;

notify pgrst, 'reload schema';

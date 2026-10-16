-- Retro review of REQ-018 to 021, finding 62 (after-window item 3, 16 Oct
-- 2026): Incident Rules s 17 reads a reference to a reportable incident as
-- including one "alleged to have occurred", so a report in a reportable
-- category that the owner rejects is an alleged reportable incident the
-- provider is aware of. The reject action now marks such a report
-- reportable (so `notify_by` is generated) and the status view lets that
-- notification state through for a rejected row, where it used to answer
-- 'rejected' before looking: the row reads "received, not recorded" with
-- its notify-by date, raises the reportable-not-notified reminder, and
-- counts in the overdue total until a notified date is recorded or the
-- owner records that it is not reportable after all. A draft still answers
-- 'draft' first (REQ-020 FR-5: nothing counts until confirmed).
create or replace view public.incidents_status
with (security_invoker = true) as
select
  i.*,
  case
    when i.status = 'draft' then 'draft'
    when i.reportable and i.reportable_notified_on is null and i.notify_by is not null and i.notify_by < current_date
      then 'overdue-notification'
    when i.reportable and i.reportable_notified_on is null and i.notify_by is not null
      then 'notification-due'
    else i.status
  end as notification_status
from public.incidents i;
grant select on public.incidents_status to authenticated, service_role;
revoke all on public.incidents_status from anon;

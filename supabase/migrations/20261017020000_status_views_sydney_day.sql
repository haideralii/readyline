-- D-2272 (REQ-009 FR-2 as kept; #87 run 38985514628, 17 Oct 2026): the
-- register status views judged "today" with `current_date`, the session's
-- UTC day, while REQ-024's views judge it on the Sydney day (D-2242,
-- `(now() at time zone 'Australia/Sydney')::date`). Between midnight and
-- 10 or 11 am Sydney a notification due yesterday still read "Notify by",
-- a review due yesterday still "due soon". One function names the day and
-- every view that reads it goes through the function, so the rule has one
-- home. The views keep their columns, so `create or replace` carries the
-- grants; they are re-stated anyway (D-2245).

create or replace function public.sydney_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Australia/Sydney')::date;
$$;
revoke all on function public.sydney_today() from public;
grant execute on function public.sydney_today() to authenticated, service_role;

-- The audit-day registers' review rule (20261014100000): corporate_risks_status,
-- participant_risks_status, conflicts_of_interest_status and hazards_status read it.
create or replace function public.review_status(p_review_on date)
returns text
language sql
stable
as $$
  select case
    when p_review_on is null then 'no-date'
    when p_review_on < public.sydney_today() then 'overdue'
    when p_review_on <= public.sydney_today() + 30 then 'due-soon'
    else 'current'
  end;
$$;

-- 20261016020000's body, the day changed.
create or replace view public.incidents_status
with (security_invoker = true) as
select
  i.*,
  case
    when i.status = 'draft' then 'draft'
    when i.reportable and i.reportable_notified_on is null and i.notify_by is not null and i.notify_by < public.sydney_today()
      then 'overdue-notification'
    when i.reportable and i.reportable_notified_on is null and i.notify_by is not null
      then 'notification-due'
    else i.status
  end as notification_status
from public.incidents i;

-- 20261013000000's body, the day changed.
create or replace view public.policy_reviews_status
with (security_invoker = true) as
select
  r.*,
  case
    when r.next_review_on is null then 'not-adopted'
    when r.next_review_on < public.sydney_today() then 'overdue'
    when r.next_review_on <= public.sydney_today() + 60 then 'due-soon'
    else 'current'
  end as status
from public.policy_reviews r;

-- 20261014100000's bodies, the day changed.
create or replace view public.insurance_items_status with (security_invoker = true) as
select
  i.*,
  case
    when i.expires_on < public.sydney_today() then 'expired'
    when i.expires_on <= public.sydney_today() + 30 then 'expiring'
    else 'current'
  end as status
from public.insurance_items i;

create or replace view public.improvements_status with (security_invoker = true) as
select
  m.*,
  case
    when m.done_on is not null then 'done'
    when m.due_on < public.sydney_today() then 'overdue'
    else 'open'
  end as status
from public.improvements m;

revoke all on public.incidents_status, public.policy_reviews_status, public.insurance_items_status, public.improvements_status
  from anon, authenticated;
grant select on public.incidents_status, public.policy_reviews_status, public.insurance_items_status, public.improvements_status
  to authenticated, service_role;

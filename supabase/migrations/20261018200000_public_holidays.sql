-- REQ-032 Session A (FR-1 to FR-4; D-2914 to D-2917, D-2245): public holidays in the business-day count.
-- The Acts Interpretation Act 1901 s 2B reads a business day as a day that is not a Saturday, a Sunday or
-- a public holiday "in the place concerned"; the place is the account's states, and with more than one a
-- day counts as a holiday only when it is one in every state named (D-2916).

-- (1) The table. Its rows are data/public-holidays/<year>.json as scripts/holidays/seed.mjs prints them
--     (scripts/holidays/seed.test.ts holds the two equal). No account data; the client roles read it
--     and nothing else (SR-1): RLS on, one select policy, revoke then grant (D-2245).
create table public.public_holidays (
  holiday_date date not null,
  jurisdiction text not null check (jurisdiction in ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT')),
  name text not null check (char_length(name) between 1 and 80),
  primary key (holiday_date, jurisdiction)
);
alter table public.public_holidays enable row level security;
create policy public_holidays_select_all on public.public_holidays
  for select to authenticated using (true);
revoke all on public.public_holidays from public, anon, authenticated;
grant select on public.public_holidays to authenticated;
grant all privileges on public.public_holidays to service_role;

insert into public.public_holidays (holiday_date, jurisdiction, name) values
  ('2026-01-01', 'NSW', 'New Year''s Day'),
  ('2026-01-01', 'VIC', 'New Year''s Day'),
  ('2026-01-01', 'QLD', 'New Year''s Day'),
  ('2026-01-01', 'SA', 'New Year''s Day'),
  ('2026-01-01', 'WA', 'New Year''s Day'),
  ('2026-01-01', 'TAS', 'New Year''s Day'),
  ('2026-01-01', 'ACT', 'New Year''s Day'),
  ('2026-01-01', 'NT', 'New Year''s Day'),
  ('2026-01-26', 'NSW', 'Australia Day'),
  ('2026-01-26', 'VIC', 'Australia Day'),
  ('2026-01-26', 'QLD', 'Australia Day'),
  ('2026-01-26', 'SA', 'Australia Day'),
  ('2026-01-26', 'WA', 'Australia Day'),
  ('2026-01-26', 'TAS', 'Australia Day'),
  ('2026-01-26', 'ACT', 'Australia Day'),
  ('2026-01-26', 'NT', 'Australia Day'),
  ('2026-03-02', 'WA', 'Labour Day'),
  ('2026-03-09', 'VIC', 'Labour Day'),
  ('2026-03-09', 'SA', 'Adelaide Cup Day'),
  ('2026-03-09', 'TAS', 'Eight Hours Day'),
  ('2026-03-09', 'ACT', 'Canberra Day'),
  ('2026-04-03', 'NSW', 'Good Friday'),
  ('2026-04-03', 'VIC', 'Good Friday'),
  ('2026-04-03', 'QLD', 'Good Friday'),
  ('2026-04-03', 'SA', 'Good Friday'),
  ('2026-04-03', 'WA', 'Good Friday'),
  ('2026-04-03', 'TAS', 'Good Friday'),
  ('2026-04-03', 'ACT', 'Good Friday'),
  ('2026-04-03', 'NT', 'Good Friday'),
  ('2026-04-04', 'NSW', 'Easter Saturday'),
  ('2026-04-04', 'VIC', 'Easter Saturday'),
  ('2026-04-04', 'QLD', 'Easter Saturday'),
  ('2026-04-04', 'SA', 'Easter Saturday'),
  ('2026-04-04', 'ACT', 'Easter Saturday'),
  ('2026-04-04', 'NT', 'Easter Saturday'),
  ('2026-04-05', 'NSW', 'Easter Sunday'),
  ('2026-04-05', 'VIC', 'Easter Sunday'),
  ('2026-04-05', 'QLD', 'Easter Sunday'),
  ('2026-04-05', 'SA', 'Easter Sunday'),
  ('2026-04-05', 'WA', 'Easter Sunday'),
  ('2026-04-05', 'ACT', 'Easter Sunday'),
  ('2026-04-05', 'NT', 'Easter Sunday'),
  ('2026-04-06', 'NSW', 'Easter Monday'),
  ('2026-04-06', 'VIC', 'Easter Monday'),
  ('2026-04-06', 'QLD', 'Easter Monday'),
  ('2026-04-06', 'SA', 'Easter Monday'),
  ('2026-04-06', 'WA', 'Easter Monday'),
  ('2026-04-06', 'TAS', 'Easter Monday'),
  ('2026-04-06', 'ACT', 'Easter Monday'),
  ('2026-04-06', 'NT', 'Easter Monday'),
  ('2026-04-25', 'NSW', 'Anzac Day'),
  ('2026-04-25', 'VIC', 'Anzac Day'),
  ('2026-04-25', 'QLD', 'Anzac Day'),
  ('2026-04-25', 'SA', 'Anzac Day'),
  ('2026-04-25', 'WA', 'Anzac Day'),
  ('2026-04-25', 'TAS', 'Anzac Day'),
  ('2026-04-25', 'ACT', 'Anzac Day'),
  ('2026-04-25', 'NT', 'Anzac Day'),
  ('2026-04-27', 'NSW', 'Anzac Day additional day'),
  ('2026-04-27', 'WA', 'Anzac Day additional day'),
  ('2026-04-27', 'ACT', 'Anzac Day additional day'),
  ('2026-05-04', 'QLD', 'Labour Day'),
  ('2026-05-04', 'NT', 'May Day'),
  ('2026-06-01', 'WA', 'Western Australia Day'),
  ('2026-06-01', 'ACT', 'Reconciliation Day'),
  ('2026-06-08', 'NSW', 'King''s Birthday'),
  ('2026-06-08', 'VIC', 'King''s Birthday'),
  ('2026-06-08', 'SA', 'King''s Birthday'),
  ('2026-06-08', 'TAS', 'King''s Birthday'),
  ('2026-06-08', 'ACT', 'King''s Birthday'),
  ('2026-06-08', 'NT', 'King''s Birthday'),
  ('2026-08-03', 'NT', 'Picnic Day'),
  ('2026-09-25', 'VIC', 'Friday before the AFL Grand Final'),
  ('2026-09-28', 'WA', 'King''s Birthday'),
  ('2026-10-05', 'NSW', 'Labour Day'),
  ('2026-10-05', 'QLD', 'King''s Birthday'),
  ('2026-10-05', 'SA', 'Labour Day'),
  ('2026-10-05', 'ACT', 'Labour Day'),
  ('2026-11-03', 'VIC', 'Melbourne Cup Day'),
  ('2026-12-25', 'NSW', 'Christmas Day'),
  ('2026-12-25', 'VIC', 'Christmas Day'),
  ('2026-12-25', 'QLD', 'Christmas Day'),
  ('2026-12-25', 'SA', 'Christmas Day'),
  ('2026-12-25', 'WA', 'Christmas Day'),
  ('2026-12-25', 'TAS', 'Christmas Day'),
  ('2026-12-25', 'ACT', 'Christmas Day'),
  ('2026-12-25', 'NT', 'Christmas Day'),
  ('2026-12-26', 'NSW', 'Boxing Day'),
  ('2026-12-26', 'VIC', 'Boxing Day'),
  ('2026-12-26', 'QLD', 'Boxing Day'),
  ('2026-12-26', 'SA', 'Proclamation Day'),
  ('2026-12-26', 'WA', 'Boxing Day'),
  ('2026-12-26', 'ACT', 'Boxing Day'),
  ('2026-12-26', 'NT', 'Boxing Day'),
  ('2026-12-28', 'NSW', 'Boxing Day additional day'),
  ('2026-12-28', 'VIC', 'Boxing Day additional day'),
  ('2026-12-28', 'QLD', 'Boxing Day additional day'),
  ('2026-12-28', 'SA', 'Proclamation Day additional day'),
  ('2026-12-28', 'WA', 'Boxing Day additional day'),
  ('2026-12-28', 'TAS', 'Boxing Day additional day'),
  ('2026-12-28', 'ACT', 'Boxing Day additional day'),
  ('2026-12-28', 'NT', 'Boxing Day additional day'),
  ('2027-01-01', 'NSW', 'New Year''s Day'),
  ('2027-01-01', 'VIC', 'New Year''s Day'),
  ('2027-01-01', 'QLD', 'New Year''s Day'),
  ('2027-01-01', 'SA', 'New Year''s Day'),
  ('2027-01-01', 'WA', 'New Year''s Day'),
  ('2027-01-01', 'TAS', 'New Year''s Day'),
  ('2027-01-01', 'ACT', 'New Year''s Day'),
  ('2027-01-01', 'NT', 'New Year''s Day'),
  ('2027-01-26', 'NSW', 'Australia Day'),
  ('2027-01-26', 'VIC', 'Australia Day'),
  ('2027-01-26', 'QLD', 'Australia Day'),
  ('2027-01-26', 'SA', 'Australia Day'),
  ('2027-01-26', 'WA', 'Australia Day'),
  ('2027-01-26', 'TAS', 'Australia Day'),
  ('2027-01-26', 'ACT', 'Australia Day'),
  ('2027-01-26', 'NT', 'Australia Day'),
  ('2027-03-01', 'WA', 'Labour Day'),
  ('2027-03-08', 'VIC', 'Labour Day'),
  ('2027-03-08', 'SA', 'Adelaide Cup Day'),
  ('2027-03-08', 'TAS', 'Eight Hours Day'),
  ('2027-03-08', 'ACT', 'Canberra Day'),
  ('2027-03-26', 'NSW', 'Good Friday'),
  ('2027-03-26', 'VIC', 'Good Friday'),
  ('2027-03-26', 'QLD', 'Good Friday'),
  ('2027-03-26', 'SA', 'Good Friday'),
  ('2027-03-26', 'WA', 'Good Friday'),
  ('2027-03-26', 'TAS', 'Good Friday'),
  ('2027-03-26', 'ACT', 'Good Friday'),
  ('2027-03-26', 'NT', 'Good Friday'),
  ('2027-03-27', 'NSW', 'Easter Saturday'),
  ('2027-03-27', 'VIC', 'Easter Saturday'),
  ('2027-03-27', 'QLD', 'Easter Saturday'),
  ('2027-03-27', 'SA', 'Easter Saturday'),
  ('2027-03-27', 'ACT', 'Easter Saturday'),
  ('2027-03-27', 'NT', 'Easter Saturday'),
  ('2027-03-28', 'NSW', 'Easter Sunday'),
  ('2027-03-28', 'VIC', 'Easter Sunday'),
  ('2027-03-28', 'QLD', 'Easter Sunday'),
  ('2027-03-28', 'SA', 'Easter Sunday'),
  ('2027-03-28', 'WA', 'Easter Sunday'),
  ('2027-03-28', 'ACT', 'Easter Sunday'),
  ('2027-03-28', 'NT', 'Easter Sunday'),
  ('2027-03-29', 'NSW', 'Easter Monday'),
  ('2027-03-29', 'VIC', 'Easter Monday'),
  ('2027-03-29', 'QLD', 'Easter Monday'),
  ('2027-03-29', 'SA', 'Easter Monday'),
  ('2027-03-29', 'WA', 'Easter Monday'),
  ('2027-03-29', 'TAS', 'Easter Monday'),
  ('2027-03-29', 'ACT', 'Easter Monday'),
  ('2027-03-29', 'NT', 'Easter Monday'),
  ('2027-04-25', 'NSW', 'Anzac Day'),
  ('2027-04-25', 'VIC', 'Anzac Day'),
  ('2027-04-25', 'SA', 'Anzac Day'),
  ('2027-04-25', 'WA', 'Anzac Day'),
  ('2027-04-25', 'TAS', 'Anzac Day'),
  ('2027-04-25', 'ACT', 'Anzac Day'),
  ('2027-04-26', 'NSW', 'Anzac Day additional day'),
  ('2027-04-26', 'QLD', 'Anzac Day'),
  ('2027-04-26', 'WA', 'Anzac Day additional day'),
  ('2027-04-26', 'ACT', 'Anzac Day additional day'),
  ('2027-04-26', 'NT', 'Anzac Day'),
  ('2027-05-03', 'QLD', 'Labour Day'),
  ('2027-05-03', 'NT', 'May Day'),
  ('2027-05-31', 'ACT', 'Reconciliation Day'),
  ('2027-06-07', 'WA', 'Western Australia Day'),
  ('2027-06-14', 'NSW', 'King''s Birthday'),
  ('2027-06-14', 'VIC', 'King''s Birthday'),
  ('2027-06-14', 'SA', 'King''s Birthday'),
  ('2027-06-14', 'TAS', 'King''s Birthday'),
  ('2027-06-14', 'ACT', 'King''s Birthday'),
  ('2027-06-14', 'NT', 'King''s Birthday'),
  ('2027-08-02', 'NT', 'Picnic Day'),
  ('2027-09-27', 'WA', 'King''s Birthday'),
  ('2027-10-04', 'NSW', 'Labour Day'),
  ('2027-10-04', 'QLD', 'King''s Birthday'),
  ('2027-10-04', 'SA', 'Labour Day'),
  ('2027-10-04', 'ACT', 'Labour Day'),
  ('2027-11-02', 'VIC', 'Melbourne Cup Day'),
  ('2027-12-25', 'NSW', 'Christmas Day'),
  ('2027-12-25', 'VIC', 'Christmas Day'),
  ('2027-12-25', 'QLD', 'Christmas Day'),
  ('2027-12-25', 'SA', 'Christmas Day'),
  ('2027-12-25', 'WA', 'Christmas Day'),
  ('2027-12-25', 'TAS', 'Christmas Day'),
  ('2027-12-25', 'ACT', 'Christmas Day'),
  ('2027-12-25', 'NT', 'Christmas Day'),
  ('2027-12-26', 'NSW', 'Boxing Day'),
  ('2027-12-26', 'VIC', 'Boxing Day'),
  ('2027-12-26', 'QLD', 'Boxing Day'),
  ('2027-12-26', 'SA', 'Proclamation Day'),
  ('2027-12-26', 'WA', 'Boxing Day'),
  ('2027-12-26', 'ACT', 'Boxing Day'),
  ('2027-12-26', 'NT', 'Boxing Day'),
  ('2027-12-27', 'NSW', 'Christmas Day additional day'),
  ('2027-12-27', 'VIC', 'Christmas Day additional day'),
  ('2027-12-27', 'QLD', 'Christmas Day additional day'),
  ('2027-12-27', 'SA', 'Christmas Day additional day'),
  ('2027-12-27', 'WA', 'Christmas Day additional day'),
  ('2027-12-27', 'TAS', 'Christmas Day additional day'),
  ('2027-12-27', 'ACT', 'Christmas Day additional day'),
  ('2027-12-27', 'NT', 'Christmas Day additional day'),
  ('2027-12-28', 'NSW', 'Boxing Day additional day'),
  ('2027-12-28', 'VIC', 'Boxing Day additional day'),
  ('2027-12-28', 'QLD', 'Boxing Day additional day'),
  ('2027-12-28', 'SA', 'Proclamation Day additional day'),
  ('2027-12-28', 'WA', 'Boxing Day additional day'),
  ('2027-12-28', 'TAS', 'Boxing Day additional day'),
  ('2027-12-28', 'ACT', 'Boxing Day additional day'),
  ('2027-12-28', 'NT', 'Boxing Day additional day')
on conflict (holiday_date, jurisdiction) do update set name = excluded.name;

-- (2) FR-4, D-2917: `notify_by` becomes a plain column. The generated column could read neither the account's
--     states nor the table (a generated expression is immutable over its own row). The status view is the one
--     object on the column; it comes back below with 20261017020000's body.
drop view public.incidents_status;
alter table public.incidents drop column notify_by;
alter table public.incidents add column notify_by date;

-- (3) FR-3: the count with the place concerned. The two-argument form stays as a wrapper that passes no state,
--     weekends only, as every earlier caller relied on. Stable, not immutable: the table is read.
create or replace function public.add_business_days(p_date date, p_days integer, p_states text[])
returns date
language plpgsql
stable
as $$
declare
  v_date date := p_date;
  v_left integer := p_days;
  v_states text[];
  v_n integer;
begin
  if p_date is null or p_days is null then
    return null;
  end if;
  if v_left < 0 then
    raise exception 'add_business_days: negative days';
  end if;
  select coalesce(array_agg(distinct upper(s)), '{}'::text[]) into v_states
  from unnest(coalesce(p_states, '{}'::text[])) as s
  where upper(s) in ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT');
  v_n := coalesce(array_length(v_states, 1), 0);
  while v_left > 0 loop
    v_date := v_date + 1;
    if extract(isodow from v_date) >= 6 then
      continue;
    end if;
    if v_n > 0 and (
      select count(*) from public.public_holidays h
      where h.holiday_date = v_date and h.jurisdiction = any (v_states)
    ) = v_n then
      continue;
    end if;
    v_left := v_left - 1;
  end loop;
  return v_date;
end;
$$;
create or replace function public.add_business_days(p_date date, p_days integer)
returns date
language plpgsql
stable
as $$
begin
  return public.add_business_days(p_date, p_days, '{}'::text[]);
end;
$$;

-- The notify-by rule with the place concerned; the four-argument form stays as a wrapper.
create or replace function public.incident_notify_by(p_occurred_on date, p_category text, p_reportable boolean, p_severity text, p_states text[])
returns date
language sql
stable
as $$
  select case
    when p_occurred_on is null or not coalesce(p_reportable, false) then null
    when p_category in (
      'death', 'serious-injury', 'abuse-or-neglect',
      'unlawful-sexual-or-physical-contact', 'sexual-misconduct'
    ) then p_occurred_on + 1
    when p_category = 'restrictive-practice-unauthorised' and p_severity in ('medium', 'high') then p_occurred_on + 1
    when p_category = 'restrictive-practice-unauthorised' then public.add_business_days(p_occurred_on, 5, p_states)
    else null
  end;
$$;
create or replace function public.incident_notify_by(p_occurred_on date, p_category text, p_reportable boolean, p_severity text)
returns date
language sql
stable
as $$
  select public.incident_notify_by(p_occurred_on, p_category, p_reportable, p_severity, '{}'::text[]);
$$;

-- FR-3's parity check in one call per state set: every day from p_from to p_to with its count.
create or replace function public.add_business_days_range(p_from date, p_to date, p_days integer, p_states text[])
returns table (start_date date, result_date date)
language sql
stable
as $$
  select d::date, public.add_business_days(d::date, p_days, p_states)
  from generate_series(p_from, p_to, interval '1 day') as d;
$$;

revoke all on function public.add_business_days(date, integer, text[]) from public, anon;
grant execute on function public.add_business_days(date, integer, text[]) to authenticated, service_role;
revoke all on function public.add_business_days_range(date, date, integer, text[]) from public, anon;
grant execute on function public.add_business_days_range(date, date, integer, text[]) to authenticated, service_role;
revoke all on function public.incident_notify_by(date, text, boolean, text, text[]) from public, anon;
grant execute on function public.incident_notify_by(date, text, boolean, text, text[]) to authenticated, service_role;

-- (4) The row's save sets the date from the row and the account's states (security definer: a worker's
--     insert through the worker functions reads the account the same way); the recompute re-derives an
--     account's rows and the reminders job calls it each run, so a holiday added to the table moves the date.
--     Only a row whose date moves is written, so `updated_at` (REQ-031's what-changed reading) stays put.
create or replace function public.set_incident_notify_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_states text[];
begin
  select a.states into v_states from public.accounts a where a.id = new.account_id;
  new.notify_by := public.incident_notify_by(
    greatest(new.occurred_on, new.aware_on), new.category, new.reportable, new.severity,
    coalesce(v_states, '{}'::text[])
  );
  return new;
end;
$$;
revoke all on function public.set_incident_notify_by() from public, anon, authenticated;
create trigger incidents_set_notify_by
  before insert or update of occurred_on, aware_on, category, reportable, severity on public.incidents
  for each row execute function public.set_incident_notify_by();

create or replace function public.recompute_incident_notify_by(p_account uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_states text[];
  v_count integer;
begin
  select coalesce(a.states, '{}'::text[]) into v_states from public.accounts a where a.id = p_account;
  update public.incidents i
  set notify_by = public.incident_notify_by(greatest(i.occurred_on, i.aware_on), i.category, i.reportable, i.severity, v_states)
  where i.account_id = p_account
    and i.notify_by is distinct from
      public.incident_notify_by(greatest(i.occurred_on, i.aware_on), i.category, i.reportable, i.severity, v_states);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.recompute_incident_notify_by(uuid) from public, anon, authenticated;
grant execute on function public.recompute_incident_notify_by(uuid) to service_role;

-- The rows as they stand, each with its account's states; `updated_at` is left alone for this one fill,
-- since nothing about the incident changed (REQ-031 D-2298 reads that column as the register's change).
alter table public.incidents disable trigger incidents_set_updated_at;
update public.incidents i
set notify_by = public.incident_notify_by(greatest(i.occurred_on, i.aware_on), i.category, i.reportable, i.severity, coalesce(a.states, '{}'::text[]))
from public.accounts a
where a.id = i.account_id;
alter table public.incidents enable trigger incidents_set_updated_at;

-- (5) The status view, 20261017020000's body.
create view public.incidents_status
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
revoke all on public.incidents_status from anon;
grant select on public.incidents_status to authenticated, service_role;

notify pgrst, 'reload schema';

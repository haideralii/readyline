-- Batch 45 item 12 (D-2002): first-party counters, no cookies, no third
-- party, nothing per user. One row per day and event; the server bumps a
-- count with the service key and /admin reads the last 30 days. No
-- authenticated or anonymous access at all (D-052: every grant explicit).

create table public.daily_counters (
  day date not null,
  event text not null check (event in (
    'start-view',
    'result-shown',
    'buy-click',
    'subscribe-click',
    'finish-completed'
  )),
  count integer not null default 0 check (count >= 0),
  primary key (day, event)
);

alter table public.daily_counters enable row level security;

revoke all on public.daily_counters from anon, authenticated;
grant all privileges on public.daily_counters to service_role;

-- One statement, so two requests on the same day never lose a count.
create or replace function public.bump_counter(p_event text, p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.daily_counters (day, event, count)
  values (p_day, p_event, 1)
  on conflict (day, event) do update
    set count = public.daily_counters.count + 1;
$$;

revoke all on function public.bump_counter(text, date) from public, anon, authenticated;
grant execute on function public.bump_counter(text, date) to service_role;

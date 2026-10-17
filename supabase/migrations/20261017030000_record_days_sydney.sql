-- D-2272 as amended (REQ-024 Session A3, first item; PO 17 Oct 2026 12:25):
-- D-2242 is one rule for the product. 20261017020000 moved the days the
-- status views judge onto the Sydney day; the days a row records took
-- the session's UTC day still, so a row written at 8 am Sydney on the 17th
-- recorded "the 16th", the wrong day on an auditor's page. The three table
-- defaults and the report link's function read `public.sydney_today()`.

alter table public.incidents
  alter column reported_on set default public.sydney_today();
alter table public.onboarding_checklists
  alter column started_on set default public.sydney_today();
alter table public.onboarding_ticks
  alter column ticked_on set default public.sydney_today();

-- 20261015050000's body, the recorded day changed (aware_on already read the Sydney day inline).
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
    v_account, p_occurred_on, public.sydney_today(), p_category, p_severity,
    nullif(p_participant_ref, ''), nullif(p_worker_ref, ''),
    p_summary, coalesce(p_actions_taken, ''), 'draft', 'link', p_reporter, now(),
    public.sydney_today(), null
  ) returning id, incidents.reference into v_id, v_ref;
  insert into public.incident_events (incident_id, account_id, actor_user_id, kind, note)
    values (v_id, v_account, null, 'reported', 'Reported through the report link by ' || p_reporter);
  return query select v_id, v_ref;
end;
$$;
revoke all on function public.submit_incident_report(text, date, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_incident_report(text, date, text, text, text, text, text, text, text) to service_role;

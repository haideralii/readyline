-- REQ-004 Session B: hardening from the PO's Session A review, plus the
-- magic-link limiter used by the sign-in action.

-- (1) The database never trusts the app: constraints mirror the zod schema.
alter table public.accounts
  add constraint accounts_states_valid
  check (states <@ array['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT']::text[]);

-- (2) One owner account per user for now; a second create_account() fails.
create unique index memberships_one_owner_per_user
  on public.memberships (user_id)
  where role = 'owner';

create or replace function public.create_account(
  p_trading_name text,
  p_business_structure text,
  p_states text[],
  p_abn text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_account uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.user_id = v_user and m.role = 'owner' and a.deleted_at is null
  ) then
    raise exception 'this user already owns an account' using errcode = 'P0001';
  end if;
  insert into public.accounts (trading_name, business_structure, states, abn)
  values (p_trading_name, p_business_structure, coalesce(p_states, '{}'), nullif(p_abn, ''))
  returning id into v_account;
  insert into public.memberships (user_id, account_id, role)
  values (v_user, v_account, 'owner');
  insert into public.audit_log (account_id, actor_user_id, action, target)
  values (v_account, v_user, 'account.created', v_account::text);
  return v_account;
end;
$$;

-- Magic-link limiter (FR-1, SR-3): atomic count per key within a rolling window.
-- Returns true when the request is within the limit. Callable only with the
-- secret key; keys are "email:<sha256>" and "ip:<address>", never an email.
create or replace function public.auth_rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.auth_rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case
      when public.auth_rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else public.auth_rate_limits.count + 1
    end,
    window_start = case
      when public.auth_rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else public.auth_rate_limits.window_start
    end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.auth_rate_limit_hit(text, integer, integer) from public;
revoke all on function public.auth_rate_limit_hit(text, integer, integer) from anon, authenticated;

-- Server draft access by the owner's membership is already covered by the
-- questionnaire_drafts policies; audit the migration of a local draft.

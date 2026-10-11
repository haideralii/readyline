-- REQ-004 Session A: identity, accounts, tenancy and audit log.
-- Every account-scoped table carries account_id and is protected by row-level
-- security keyed on an active membership of the signed-in user. Clients never
-- insert memberships or accounts directly; they call create_account(), which
-- creates the account and the owner membership in one transaction.
-- No participant data is stored by this schema (CLAUDE.md 4.5).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  -- SHA-256 of the lower-cased email; the email itself stays in auth.users only.
  email_hash text not null,
  -- Haider only; settable by SQL, never by a client (see trigger below).
  platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  trading_name text not null check (char_length(trading_name) between 1 and 120),
  business_structure text not null check (
    business_structure in ('sole-trader', 'partnership', 'company', 'incorporated-association', 'trust', 'other')
  ),
  states text[] not null default '{}',
  abn text check (abn is null or abn ~ '^[0-9]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete: sign-in blocked and data hidden immediately; purged after 30 days.
  deleted_at timestamptz
);

create table public.memberships (
  user_id uuid not null references public.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, account_id)
);
create index memberships_account_id_idx on public.memberships (account_id);

create table public.questionnaire_drafts (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  answers_version integer not null default 1,
  current_step text,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  account_id uuid references public.accounts (id) on delete set null,
  actor_user_id uuid,
  action text not null,
  target text,
  at timestamptz not null default now()
);
create index audit_log_account_id_at_idx on public.audit_log (account_id, at desc);

-- Magic-link limiter (REQ-004 FR-1): keyed by email hash or IP, rolling window.
-- Only the server (secret key) touches this table; no client policy exists.
create table public.auth_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger questionnaire_drafts_set_updated_at before update on public.questionnaire_drafts
  for each row execute function public.set_updated_at();

-- True when the signed-in user has a membership of a live (not soft-deleted) account.
create or replace function public.is_member(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.account_id = p_account
      and m.user_id = auth.uid()
      and a.deleted_at is null
  );
$$;

create or replace function public.is_owner(p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.accounts a on a.id = m.account_id
    where m.account_id = p_account
      and m.user_id = auth.uid()
      and m.role = 'owner'
      and a.deleted_at is null
  );
$$;

-- Mirror every new auth user into public.users with a hashed email.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email_hash)
  values (new.id, encode(sha256(convert_to(lower(coalesce(new.email, '')), 'UTF8')), 'hex'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- platform_admin can only change through SQL run by an operator, never through
-- the API (anon, authenticated or the secret key all carry a JWT role claim).
create or replace function public.prevent_platform_admin_change()
returns trigger
language plpgsql
as $$
begin
  if new.platform_admin is distinct from old.platform_admin
     and coalesce(current_setting('request.jwt.claims', true), '') <> '' then
    raise exception 'platform_admin can only be changed by an operator in SQL';
  end if;
  return new;
end;
$$;

create trigger users_protect_platform_admin before update on public.users
  for each row execute function public.prevent_platform_admin_change();

-- Creates an account and its owner membership for the signed-in user.
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

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.memberships enable row level security;
alter table public.questionnaire_drafts enable row level security;
alter table public.audit_log enable row level security;
alter table public.auth_rate_limits enable row level security;

-- users: see and edit only yourself; rows are created by the auth trigger.
create policy users_select_self on public.users
  for select to authenticated using (id = auth.uid());
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- accounts: members read; owners update; creation and deletion go through functions.
create policy accounts_select_member on public.accounts
  for select to authenticated using (public.is_member(id));
create policy accounts_update_owner on public.accounts
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

-- memberships: members can see who else is on the account; no client writes.
create policy memberships_select_member on public.memberships
  for select to authenticated using (public.is_member(account_id));

-- questionnaire drafts: members read and write their account's draft.
create policy drafts_select_member on public.questionnaire_drafts
  for select to authenticated using (public.is_member(account_id));
create policy drafts_insert_member on public.questionnaire_drafts
  for insert to authenticated with check (public.is_member(account_id));
create policy drafts_update_member on public.questionnaire_drafts
  for update to authenticated using (public.is_member(account_id)) with check (public.is_member(account_id));
create policy drafts_delete_member on public.questionnaire_drafts
  for delete to authenticated using (public.is_member(account_id));

-- audit log: owners read; written only by server code or definer functions.
create policy audit_log_select_owner on public.audit_log
  for select to authenticated using (public.is_owner(account_id));

-- auth_rate_limits: no policies; only the secret key (bypasses RLS) may touch it.

-- ---------------------------------------------------------------------------
-- Grants: clients may only call create_account; the limiter table is server-only.
-- ---------------------------------------------------------------------------

revoke all on public.auth_rate_limits from anon, authenticated;
revoke all on function public.create_account(text, text, text[], text) from public;
grant execute on function public.create_account(text, text, text[], text) to authenticated;
revoke execute on function public.create_account(text, text, text[], text) from anon;

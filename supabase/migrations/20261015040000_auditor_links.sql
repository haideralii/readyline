-- REQ-020 Session A, FR-2, SR-1, SR-2 (D-2230): one read-only auditor link
-- per account at a time. The token itself is never stored: only its SHA-256
-- hex, compared by the lookup function below. Members read the row (expiry,
-- last opened, count); only the owner creates or revokes; nothing deletes a
-- row but the account's own deletion (cascade) and the purge job 30 days
-- after the link ended (REQ-020 Data: retention).
create table public.auditor_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  last_opened_at timestamptz,
  opened_count integer not null default 0 check (opened_count >= 0)
);
create index auditor_links_account_idx on public.auditor_links (account_id, created_at desc);

alter table public.auditor_links enable row level security;
create policy auditor_links_select_member on public.auditor_links
  for select to authenticated using (public.is_member(account_id));
create policy auditor_links_insert_owner on public.auditor_links
  for insert to authenticated with check (public.is_owner(account_id));
create policy auditor_links_update_owner on public.auditor_links
  for update to authenticated
  using (public.is_owner(account_id))
  with check (public.is_owner(account_id));

grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.auditor_links to authenticated;
revoke delete on public.auditor_links from anon, authenticated;
grant all privileges on public.auditor_links to service_role;
revoke all on public.auditor_links from anon;

-- The signed-out path (REQ-020 Dev response 1, accepted): one security
-- definer function keyed by the token hash answers the live link's account
-- and nothing else; a revoked, expired or unknown hash answers no row, so a
-- caller cannot tell "expired" from "never existed" (SR-1). Only the server
-- (service key) may call it; the register reads it then makes are scoped to
-- the account it returned.
create or replace function public.auditor_link_lookup(p_token_hash text)
returns table (link_id uuid, account_id uuid, trading_name text, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select l.id, l.account_id, a.trading_name, l.expires_at
  from public.auditor_links l
  join public.accounts a on a.id = l.account_id
  where l.token_hash = p_token_hash
    and l.revoked_at is null
    and l.expires_at > now()
    and a.deleted_at is null
$$;
revoke all on function public.auditor_link_lookup(text) from public, anon, authenticated;
grant execute on function public.auditor_link_lookup(text) to service_role;

notify pgrst, 'reload schema';

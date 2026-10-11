-- REQ-004 Session C: self-service deletion, export support and audit writes.
-- Deletion is a soft delete by the owner through delete_account(); the purge
-- job (service key) removes rows after the retention period (FR-6, AC-5).

-- Members may write audit rows for their own account about themselves; this is
-- what the settings, export and deletion paths use. Admin actions are written
-- with the service key (account_id null) and never through this policy.
create policy audit_log_insert_member on public.audit_log
  for insert to authenticated
  with check (public.is_member(account_id) and actor_user_id = auth.uid());

-- Purge scans only soft-deleted accounts.
create index accounts_deleted_at_idx on public.accounts (deleted_at)
  where deleted_at is not null;

-- Soft-deletes the signed-in owner's live account and records it. After this
-- is_member()/is_owner() return false for the account, so every policy hides
-- its rows at once (sign-in blocked, data invisible).
create or replace function public.delete_account()
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
  select a.id into v_account
  from public.memberships m
  join public.accounts a on a.id = m.account_id
  where m.user_id = v_user and m.role = 'owner' and a.deleted_at is null
  limit 1;
  if v_account is null then
    raise exception 'no live account to delete' using errcode = 'P0002';
  end if;
  update public.accounts set deleted_at = now() where id = v_account;
  insert into public.audit_log (account_id, actor_user_id, action, target)
  values (v_account, v_user, 'account.deleted', v_account::text);
  return v_account;
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
revoke execute on function public.delete_account() from anon;

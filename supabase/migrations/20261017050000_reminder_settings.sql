-- REQ-022 Session B (FR-5, FR-7, SR-6; D-2822 the plain-SMTP reading of
-- D-2201; D-2823 both gates): one reminder-settings row per account. The
-- nightly reminders job reads do_not_send before every send and sends that
-- account nothing when it is set; the one-click unsubscribe on a reminder
-- sets it (reason unsubscribed); a bounce or complaint handler, if one is
-- ever configured, would set the other two reasons and nothing else. The
-- unsubscribe token is never stored in clear: the row keeps its SHA-256,
-- and the token itself is derived from HASH_PEPPER and the account id, so
-- every reminder carries the same link. Members read their account's row,
-- the owner updates it, inserts come from the owner or the service role
-- (the job, on first use), nobody deletes through the API: the row goes
-- with the account (D-2245: revoke, then grant what is meant).

create table public.reminder_settings (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  do_not_send boolean not null default false,
  do_not_send_reason text check (
    do_not_send_reason is null
    or do_not_send_reason in ('unsubscribed', 'bounce', 'complaint')
  ),
  do_not_send_at timestamptz,
  unsubscribe_token_hash text unique check (
    unsubscribe_token_hash is null or unsubscribe_token_hash ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_settings_reason_with_flag check (
    (do_not_send and do_not_send_reason is not null and do_not_send_at is not null)
    or (not do_not_send)
  )
);

create trigger reminder_settings_set_updated_at
  before update on public.reminder_settings
  for each row execute function public.set_updated_at();

alter table public.reminder_settings enable row level security;

create policy reminder_settings_select_member on public.reminder_settings
  for select to authenticated using (public.is_member(account_id));
create policy reminder_settings_insert_owner on public.reminder_settings
  for insert to authenticated with check (public.is_owner(account_id));
create policy reminder_settings_update_owner on public.reminder_settings
  for update to authenticated
  using (public.is_owner(account_id))
  with check (public.is_owner(account_id));
-- No delete policy: nothing deletes a row through the API.

revoke all on public.reminder_settings from anon, authenticated;
grant select, insert, update on public.reminder_settings to authenticated;

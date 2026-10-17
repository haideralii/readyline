-- REQ-023 Session C (Dev-2): the renewal path and the rehearsal (FR-7, FR-8; D-2309, D-2316, D-2342).
-- (1) The FR-7 facts live on the period row (D-2316): the renewal's dates and the auditing company's name.
alter table public.registration_periods
  add column application_submitted_on date,
  add column scope_received_on date,
  add column audit_booked_on date,
  -- The auditing company's name, not a person's (FR-7, finding 39): at most 80, letters, digits, spaces and
  -- the marks a business name carries, never an NDIS-number shape (SR-1).
  add column auditor_business_name text not null default '' check (
    char_length(auditor_business_name) <= 80
    and auditor_business_name ~ '^[A-Za-z0-9 &''./()-]*$'
    and not public.looks_like_ndis_number(auditor_business_name)
  ),
  add column decision_received_on date;
alter table public.registration_periods
  add constraint registration_periods_renewal_order check (
    (scope_received_on is null or application_submitted_on is not null)
    and (decision_received_on is null or application_submitted_on is not null)
  );

-- (2) The rehearsal (FR-8): a self-check row carries its mode and, for a rehearsal, the period it read.
alter table public.self_checks
  add column mode text not null default 'walk' check (mode in ('walk', 'rehearsal')),
  add column period_from date,
  add column period_to date;
alter table public.self_checks
  add constraint self_checks_rehearsal_period check (
    (mode = 'walk' and period_from is null and period_to is null)
    or (mode = 'rehearsal' and period_from is not null and period_to is not null and period_from <= period_to)
  );

-- (3) D-2309: the owner's tick that lets the auditor link's pack carry the rehearsal sheet; off by default.
alter table public.auditor_links
  add column include_rehearsal boolean not null default false;

-- The signed-out lookup returns the tick with the link, so the auditor's pack route reads it from the same
-- security definer call and nothing else (REQ-020 SR-1; a function's result columns cannot be replaced, so drop first).
drop function public.auditor_link_lookup(text);
create function public.auditor_link_lookup(p_token_hash text)
returns table (link_id uuid, account_id uuid, trading_name text, expires_at timestamptz, include_rehearsal boolean)
language sql
security definer
set search_path = public
stable
as $$
  select l.id, l.account_id, a.trading_name, l.expires_at, l.include_rehearsal
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

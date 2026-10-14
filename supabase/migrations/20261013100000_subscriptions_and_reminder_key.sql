-- REQ-009 Session C: the subscription ledger behind the registers (PO answer
-- 4, D-056) and the reminders' idempotency key (FR-3, AC-4).
--
-- (1) `subscriptions`: one row per Stripe subscription, written only by the
--     webhook with the secret key; owners read their own. The entitlement
--     of kind `subscription` (REQ-007's table) is what the register policies
--     check; this table says which Stripe subscription granted it and what
--     Stripe last said about it, so the account page can show the state and
--     the billing portal can be opened for the right customer.
-- (2) `apply_stripe_subscription_event`: the subscription half of the event
--     ledger, same shape as `apply_stripe_event`: every event id once, then
--     the rules. Revoke only on `canceled` or `unpaid`; `past_due` keeps the
--     entitlement so Stripe's own retries are the grace period; a return to
--     `active` after a revocation grants a fresh entitlement (renewal restores
--     writes).
-- (3) The reminders key gains `send_on`: FR-3 asks for several reminders per
--     subject (90, 30, 7 days and the day), which one `due_on` per subject
--     could not hold. Idempotency is now per (account, kind, subject, send
--     date), which is what "a second run inserts nothing" needs.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text,
  -- Stripe's own vocabulary; the entitlement is the decision, this is the record.
  status text not null check (status in (
    'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
  )),
  current_period_end timestamptz,
  entitlement_id uuid references public.entitlements (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_account_idx on public.subscriptions (account_id, created_at desc);
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
create policy subscriptions_select_owner on public.subscriptions
  for select to authenticated using (public.is_owner(account_id));

grant usage on schema public to authenticated, service_role;
grant select on public.subscriptions to authenticated;
grant all privileges on public.subscriptions to service_role;
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- The subscription half of the Stripe event ledger. Returns one of:
-- duplicate, invalid, ignored, subscription_granted, subscription_updated,
-- subscription_revoked.
create or replace function public.apply_stripe_subscription_event(
  p_event_id text,
  p_type text,
  p_subscription_id text,
  p_customer_id text,
  p_account_id uuid,
  p_status text,
  p_period_end timestamptz,
  p_occurred_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_sub public.subscriptions%rowtype;
  v_account uuid;
  v_entitlement uuid;
  v_status text;
  v_revoking boolean;
begin
  insert into public.stripe_events (id, type, received_at)
  values (p_event_id, p_type, now())
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;

  if p_subscription_id is null then
    return 'invalid';
  end if;

  select * into v_sub from public.subscriptions where stripe_subscription_id = p_subscription_id;
  v_account := coalesce(p_account_id, v_sub.account_id);
  if v_account is null then
    return 'invalid';
  end if;

  -- What Stripe says now; a checkout completion means active, a deletion means canceled,
  -- a failed invoice means past_due unless the event carried a status.
  v_status := case
    when p_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then coalesce(p_status, 'active')
    when p_type = 'customer.subscription.deleted' then 'canceled'
    when p_type = 'invoice.payment_failed' then coalesce(p_status, 'past_due')
    when p_type in ('customer.subscription.created', 'customer.subscription.updated') then p_status
    else null
  end;
  if v_status is null then
    return 'ignored';
  end if;
  if v_status not in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused') then
    return 'invalid';
  end if;

  if not found then
    insert into public.subscriptions (account_id, stripe_subscription_id, stripe_customer_id, status, current_period_end)
    values (v_account, p_subscription_id, p_customer_id, v_status, p_period_end)
    returning * into v_sub;
  else
    update public.subscriptions
    set status = v_status,
        stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
        current_period_end = coalesce(p_period_end, current_period_end)
    where id = v_sub.id
    returning * into v_sub;
  end if;

  -- D-056: revoke only on canceled or unpaid (and the two incomplete states, which never paid); never on past_due.
  v_revoking := v_status in ('canceled', 'unpaid', 'incomplete_expired');

  if v_revoking then
    if v_sub.entitlement_id is not null then
      update public.entitlements
      set revoked_at = coalesce(revoked_at, p_occurred_at, now())
      where id = v_sub.entitlement_id and revoked_at is null;
      get diagnostics v_inserted = row_count;
      if v_inserted > 0 then
        return 'subscription_revoked';
      end if;
    end if;
    return 'subscription_updated';
  end if;

  -- Active, trialing, past_due or paused: an entitlement must exist and be unrevoked.
  if v_status in ('active', 'trialing', 'past_due') then
    if v_sub.entitlement_id is not null then
      select id into v_entitlement from public.entitlements
      where id = v_sub.entitlement_id and revoked_at is null;
      if found then
        return 'subscription_updated';
      end if;
    end if;
    insert into public.entitlements (account_id, kind, granted_at)
    values (v_account, 'subscription', coalesce(p_occurred_at, now()))
    returning id into v_entitlement;
    update public.subscriptions set entitlement_id = v_entitlement where id = v_sub.id;
    return 'subscription_granted';
  end if;

  return 'subscription_updated';
end;
$$;

revoke all on function public.apply_stripe_subscription_event(text, text, text, text, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(text, text, text, text, uuid, text, timestamptz, timestamptz) to service_role;

-- (3) Reminders: one row per (account, kind, subject, send date).
alter table public.reminders drop constraint if exists reminders_account_id_kind_subject_id_due_on_key;
alter table public.reminders add constraint reminders_send_key unique (account_id, kind, subject_id, send_on);

notify pgrst, 'reload schema';

-- Retro review of REQ-007 (15 Oct 2026, finding 17): Stripe sends
-- `charge.refunded` for a partial refund too, and the function revoked the
-- pack on any amount. The rule is now the reducer's
-- (src/lib/payments/entitlement.ts): a refund whose amount is below the
-- charge is recorded by its event id and changes nothing else
-- ('partial_refund_ignored'); a refund in full revokes as before; an event
-- without the charge amount counts as full. The operator rule stays "no
-- partial refunds for the pack" (supabase/ops/refund.md); this is the ledger
-- holding that line when the operator slips.
--
-- Forward-only: the ten-argument function is dropped and the eleven-argument
-- one created, so PostgREST's named call stays unambiguous (a defaulted
-- parameter would leave two overloads). Only the webhook calls it, with the
-- secret key (D-538: an explicit grant to service_role).

drop function if exists public.apply_stripe_event(text, text, text, text, uuid, text, integer, text, text, timestamptz);

create function public.apply_stripe_event(
  p_event_id text,
  p_type text,
  p_session_id text,
  p_payment_intent_id text,
  p_account_id uuid,
  p_assessment_id text,
  p_amount_cents integer,
  p_currency text,
  p_receipt_url text,
  p_occurred_at timestamptz,
  p_charge_amount_cents integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_purchase public.purchases%rowtype;
  v_purchase_id uuid;
  v_entitlement_id uuid;
begin
  -- Every event id once; a replay stops here.
  insert into public.stripe_events (id, type, received_at)
  values (p_event_id, p_type, now())
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;

  if p_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    if p_session_id is null or p_account_id is null then
      return 'invalid';
    end if;
    if exists (select 1 from public.purchases where stripe_checkout_session_id = p_session_id) then
      return 'already_paid';
    end if;
    if p_payment_intent_id is not null then
      select * into v_purchase from public.purchases
      where stripe_payment_intent_id = p_payment_intent_id and status = 'refunded';
      if found then
        update public.purchases
        set stripe_checkout_session_id = p_session_id,
            amount_cents = coalesce(p_amount_cents, amount_cents),
            receipt_url = coalesce(p_receipt_url, receipt_url)
        where id = v_purchase.id;
        return 'refunded_before_completion';
      end if;
    end if;
    insert into public.purchases (
      account_id, stripe_checkout_session_id, stripe_payment_intent_id,
      amount_cents, currency, status, receipt_url, created_at
    ) values (
      p_account_id, p_session_id, p_payment_intent_id,
      coalesce(p_amount_cents, 0), coalesce(lower(p_currency), 'aud'), 'paid', p_receipt_url,
      coalesce(p_occurred_at, now())
    ) returning id into v_purchase_id;
    insert into public.entitlements (account_id, kind, assessment_id, source_purchase_id, granted_at)
    values (p_account_id, 'pack', p_assessment_id, v_purchase_id, coalesce(p_occurred_at, now()))
    returning id into v_entitlement_id;
    -- FR-5: the set is generated out of band; the webhook's after() hook and the
    -- job route pick this row up (Session C, D-706).
    insert into public.generation_jobs (account_id, purchase_id, entitlement_id, assessment_id)
    values (p_account_id, v_purchase_id, v_entitlement_id, p_assessment_id);
    return 'granted';
  end if;

  if p_type = 'charge.refunded' then
    if p_payment_intent_id is null then
      return 'invalid';
    end if;
    -- A partial refund: the id is recorded above; the purchase and the entitlement stand.
    if p_charge_amount_cents is not null and p_amount_cents is not null
       and p_amount_cents < p_charge_amount_cents then
      return 'partial_refund_ignored';
    end if;
    select * into v_purchase from public.purchases
    where stripe_payment_intent_id = p_payment_intent_id;
    if not found then
      if p_account_id is null then
        return 'invalid';
      end if;
      insert into public.purchases (
        account_id, stripe_checkout_session_id, stripe_payment_intent_id,
        amount_cents, currency, status, created_at, refunded_at
      ) values (
        p_account_id, null, p_payment_intent_id,
        coalesce(p_amount_cents, 0), coalesce(lower(p_currency), 'aud'), 'refunded',
        coalesce(p_occurred_at, now()), coalesce(p_occurred_at, now())
      );
      return 'refund_recorded';
    end if;
    if v_purchase.status = 'refunded' then
      return 'duplicate';
    end if;
    update public.purchases
    set status = 'refunded', refunded_at = coalesce(refunded_at, p_occurred_at, now())
    where id = v_purchase.id;
    update public.entitlements
    set revoked_at = coalesce(p_occurred_at, now())
    where source_purchase_id = v_purchase.id and revoked_at is null;
    return 'revoked';
  end if;

  return 'ignored';
end;
$$;

revoke all on function public.apply_stripe_event(text, text, text, text, uuid, text, integer, text, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.apply_stripe_event(text, text, text, text, uuid, text, integer, text, text, timestamptz, integer) to service_role;

-- PostgREST caches the function list; tell it the signature changed.
notify pgrst, 'reload schema';

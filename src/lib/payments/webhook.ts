/**
 * Stripe webhook handling without the framework (REQ-007 FR-3, SR-1, SR-2,
 * SR-6): verify the signature on the raw body with the SDK, map the event
 * to the small PaymentEvent shape, apply it through the store, and answer.
 * Nothing here logs an email or the session object; the route handler wires
 * the real Stripe client and the Supabase store, tests pass fakes.
 */
import type Stripe from "stripe";
import type { PaymentEvent } from "./entitlement";
import type { PaymentStore } from "./memory-store";

/** The one SDK call the handler needs; a Stripe instance satisfies it. */
export type WebhookVerifier = {
  webhooks: {
    constructEvent(
      payload: string | Buffer,
      header: string,
      secret: string,
    ): Stripe.Event;
  };
};

export type WebhookResult = {
  status: 200 | 400;
  body: { ok: boolean; outcome?: string; error?: string };
  /** For the log line: id and type only (SR-6). */
  event?: { id: string; type: string };
};

function idOf(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** The parts of a Stripe event the ledger needs; everything else is dropped here. */
export function toPaymentEvent(event: Stripe.Event): PaymentEvent {
  const occurredAt = new Date(event.created * 1000).toISOString();
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const s = event.data.object as Stripe.Checkout.Session;
    return {
      id: event.id,
      type: event.type,
      sessionId: s.id,
      paymentIntentId: idOf(s.payment_intent),
      accountId: s.client_reference_id ?? s.metadata?.account_id ?? null,
      assessmentId: s.metadata?.assessment_id ?? null,
      amountCents: s.amount_total ?? null,
      currency: s.currency ?? null,
      occurredAt,
    };
  }
  if (event.type === "charge.refunded") {
    const c = event.data.object as Stripe.Charge;
    return {
      id: event.id,
      type: event.type,
      paymentIntentId: idOf(c.payment_intent),
      accountId: c.metadata?.account_id ?? null,
      amountCents: c.amount_refunded ?? null,
      currency: c.currency ?? null,
      receiptUrl: c.receipt_url ?? null,
      occurredAt,
    };
  }
  return { id: event.id, type: event.type, occurredAt };
}

export async function handleStripeWebhook(input: {
  payload: string;
  signature: string | null;
  secret: string;
  stripe: WebhookVerifier;
  store: PaymentStore;
}): Promise<WebhookResult> {
  if (!input.signature)
    return { status: 400, body: { ok: false, error: "missing signature" } };
  let event: Stripe.Event;
  try {
    event = input.stripe.webhooks.constructEvent(
      input.payload,
      input.signature,
      input.secret,
    );
  } catch {
    return { status: 400, body: { ok: false, error: "bad signature" } };
  }
  const outcome = await input.store.applyEvent(toPaymentEvent(event));
  return {
    status: 200,
    body: { ok: true, outcome },
    event: { id: event.id, type: event.type },
  };
}

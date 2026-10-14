import "server-only";
/**
 * The production payment store (REQ-007 FR-3, SR-2): one call to the
 * `apply_stripe_event` function, which records the event id, the purchase
 * and the entitlement in one transaction and names the outcome with the same
 * words as the reducer. Uses the admin client; the webhook is the only caller.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplyOutcome, PaymentEvent } from "@/lib/payments/entitlement";
import type { PaymentStore } from "@/lib/payments/memory-store";

const OUTCOMES = new Set<ApplyOutcome>([
  "granted",
  "duplicate",
  "ignored",
  "revoked",
  "refunded_before_completion",
  "refund_recorded",
  "already_paid",
  "invalid",
  "subscription_granted",
  "subscription_updated",
  "subscription_revoked",
]);

export class SupabasePaymentStore implements PaymentStore {
  constructor(private readonly admin: SupabaseClient) {}

  async applyEvent(event: PaymentEvent): Promise<ApplyOutcome> {
    // REQ-009 Session C: the subscription half of the ledger.
    if (event.subscriptionId) {
      const s = await this.admin.rpc("apply_stripe_subscription_event", {
        p_event_id: event.id,
        p_type: event.type,
        p_subscription_id: event.subscriptionId,
        p_customer_id: event.customerId ?? null,
        p_account_id: event.accountId ?? null,
        p_status: event.subscriptionStatus ?? null,
        p_period_end: event.periodEnd ?? null,
        p_occurred_at: event.occurredAt,
      });
      if (s.error)
        throw new Error(`apply_stripe_subscription_event: ${s.error.message}`);
      const outcome = s.data as string;
      if (!OUTCOMES.has(outcome as ApplyOutcome))
        throw new Error(
          `apply_stripe_subscription_event: unknown outcome ${outcome}`,
        );
      return outcome as ApplyOutcome;
    }
    const r = await this.admin.rpc("apply_stripe_event", {
      p_event_id: event.id,
      p_type: event.type,
      p_session_id: event.sessionId ?? null,
      p_payment_intent_id: event.paymentIntentId ?? null,
      p_account_id: event.accountId ?? null,
      p_assessment_id: event.assessmentId ?? null,
      p_amount_cents: event.amountCents ?? null,
      p_currency: event.currency ? event.currency.toLowerCase() : null,
      p_receipt_url: event.receiptUrl ?? null,
      p_occurred_at: event.occurredAt,
    });
    if (r.error) throw new Error(`apply_stripe_event: ${r.error.message}`);
    const outcome = r.data as string;
    if (!OUTCOMES.has(outcome as ApplyOutcome))
      throw new Error(`apply_stripe_event: unknown outcome ${outcome}`);
    return outcome as ApplyOutcome;
  }

  /** Stores the receipt URL on the purchase for a session (FR-7); a no-op when the row is missing. */
  async setReceiptUrl(sessionId: string, receiptUrl: string): Promise<void> {
    const r = await this.admin
      .from("purchases")
      .update({ receipt_url: receiptUrl })
      .eq("stripe_checkout_session_id", sessionId);
    if (r.error) throw new Error(`purchases update: ${r.error.message}`);
  }
}

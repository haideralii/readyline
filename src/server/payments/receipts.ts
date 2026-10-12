import "server-only";
/**
 * The Stripe receipt URL for a purchase (REQ-007 FR-7). A Checkout Session
 * carries no receipt; the charge behind its payment intent does, so after a
 * grant the webhook route looks it up once and stores it on the purchase
 * row. Failure here never fails the webhook: the receipt is a convenience,
 * and Stripe emails it to the customer as well.
 */
import type Stripe from "stripe";
import { fakeReceiptUrl } from "@/lib/payments/fake-session";

export type ReceiptLookup = (input: {
  sessionId: string;
  paymentIntentId: string | null;
}) => Promise<string | null>;

/** The one SDK call this needs; a Stripe instance satisfies it. */
export type PaymentIntentClient = {
  paymentIntents: {
    retrieve(
      id: string,
      params?: Stripe.PaymentIntentRetrieveParams,
    ): Promise<Stripe.PaymentIntent>;
  };
};

export function stripeReceiptLookup(
  stripe: PaymentIntentClient,
): ReceiptLookup {
  return async ({ paymentIntentId }) => {
    if (!paymentIntentId) return null;
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = pi.latest_charge;
    if (!charge || typeof charge === "string") return null;
    return charge.receipt_url ?? null;
  };
}

export function fakeReceiptLookup(origin: string): ReceiptLookup {
  return async ({ sessionId }) => fakeReceiptUrl(origin, sessionId);
}

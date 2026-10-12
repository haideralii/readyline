import "server-only";
/**
 * Creating a Checkout Session (REQ-007 FR-2, SR-3): server code only, with
 * the Stripe client injected so the unit test passes a fake and asserts the
 * parameters. The action in ./actions.ts does the sign-in, ownership, draft
 * and rate-limit checks and then calls this.
 */
import type Stripe from "stripe";
import {
  buildCheckoutParams,
  type CheckoutInput,
} from "@/lib/payments/checkout-params";

/** The one SDK call this module makes. */
export type CheckoutClient = {
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
        options?: Stripe.RequestOptions,
      ): Promise<Pick<Stripe.Checkout.Session, "id" | "url">>;
    };
  };
};

export type CheckoutSession = { id: string; url: string };

export async function createCheckoutSession(input: {
  stripe: CheckoutClient;
  checkout: CheckoutInput;
  /** Makes a retried request return the same session instead of a second one. */
  idempotencyKey: string;
}): Promise<CheckoutSession> {
  const params = buildCheckoutParams(input.checkout);
  const session = await input.stripe.checkout.sessions.create(params, {
    idempotencyKey: input.idempotencyKey,
  });
  if (!session.url) throw new Error("Checkout session has no URL");
  return { id: session.id, url: session.url };
}

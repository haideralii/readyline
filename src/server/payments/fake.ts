import "server-only";
/**
 * Server wiring for fake Stripe mode (REQ-007 Q5, D-709): a Checkout client
 * whose session is a page on our own origin, and the signer the fake page
 * uses to post events to the real webhook route. Nothing here runs unless
 * `isFakeStripeMode` is true.
 */
import type Stripe from "stripe";
import {
  encodeFakeSession,
  FAKE_CHECKOUT_PATH,
  fakeSecretKey,
  type FakeSessionData,
} from "@/lib/payments/fake-session";
import { readPricing } from "@/lib/payments/pricing";
import type { CheckoutClient } from "./checkout";
import { createStripeClient } from "./stripe";

/** Falls back to the e2e display price when PACK_PRICE_AUD_CENTS is unset. */
const FALLBACK_AMOUNT_CENTS = 39900;
const FALLBACK_SUBSCRIPTION_CENTS = 3900;

export class FakeCheckoutClient implements CheckoutClient {
  constructor(private readonly webhookSecret: string) {}
  readonly checkout = {
    sessions: {
      create: async (params: Stripe.Checkout.SessionCreateParams) => {
        const metadata = (params.metadata ?? {}) as Record<string, string>;
        const successUrl = params.success_url ?? "";
        const subscription = params.mode === "subscription";
        const pricing = readPricing();
        const data: FakeSessionData = {
          accountId: params.client_reference_id ?? metadata.account_id ?? "",
          assessmentId: metadata.assessment_id ?? "",
          packVersion: metadata.pack_version ?? "",
          amountCents: subscription
            ? (pricing.subscriptionPriceCents ?? FALLBACK_SUBSCRIPTION_CENTS)
            : (pricing.packPriceCents ?? FALLBACK_AMOUNT_CENTS),
          currency: "aud",
          successUrl,
          cancelUrl: params.cancel_url ?? "",
          ...(subscription ? { mode: "subscription" as const } : {}),
        };
        const id = encodeFakeSession(data, this.webhookSecret);
        const origin = new URL(successUrl).origin;
        return { id, url: `${origin}${FAKE_CHECKOUT_PATH}/${id}` };
      },
    },
  };
}

/** Signs a payload the way Stripe would, with the local webhook secret. */
export function signFakeEvent(payload: string, webhookSecret: string): string {
  return createStripeClient(fakeSecretKey()).webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
}

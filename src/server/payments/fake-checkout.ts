/**
 * The fake Checkout page's buttons (REQ-007 Q5, D-709). Each one builds the
 * event Stripe would send, signs it with the local webhook secret and posts
 * it to the real webhook route on this origin, so everything after the
 * signature check is the production path. Inert outside fake mode. Called
 * by the page's route handler (batch 45b item 2), which answers with a 303
 * so the return to the site is a full page load, as Stripe's own return is.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  decodeFakeSession,
  fakeCompletedEvent,
  fakeRefundedEvent,
  fakeSubscribedEvent,
  fakeSubscriptionStatusEvent,
} from "@/lib/payments/fake-session";
import { parseInput, strictObject } from "@/lib/validation";
import { signFakeEvent } from "@/server/payments/fake";
import { readStripeEnv } from "@/server/payments/stripe";

export const FakeCheckoutInput = strictObject({
  id: z.string().min(16).max(4096),
  action: z.enum([
    "pay",
    "refund",
    "subscribe",
    "payment-failed",
    "cancel-subscription",
    "renew",
  ]),
});

export type FakeCheckoutInputData = z.infer<typeof FakeCheckoutInput>;

/**
 * Posts the event for the pressed button (already validated at the route)
 * and returns the path the browser goes to next, or null when the request
 * is not one the fake page makes (outside fake mode, a malformed session).
 */
export async function runFakeCheckout(
  input: FakeCheckoutInputData,
): Promise<string | null> {
  const env = readStripeEnv();
  if (!env.fake) return null;
  const parsed = parseInput(FakeCheckoutInput, input);
  if (!parsed.ok) return null;
  const data = decodeFakeSession(parsed.data.id, env.webhookSecret);
  if (!data) return null;
  const origin = new URL(data.successUrl).origin;
  const now = new Date();
  const id = parsed.data.id;
  const event = (() => {
    switch (parsed.data.action) {
      case "pay":
        return fakeCompletedEvent(id, data, now);
      case "refund":
        return fakeRefundedEvent(id, data, origin, now);
      // REQ-009 Session C: the subscription lifecycle, each one the event Stripe would send.
      case "subscribe":
        return fakeSubscribedEvent(id, data, now);
      case "payment-failed":
        return fakeSubscriptionStatusEvent(
          id,
          data,
          "past_due",
          "invoice.payment_failed",
          now,
        );
      case "cancel-subscription":
        return fakeSubscriptionStatusEvent(
          id,
          data,
          "canceled",
          "customer.subscription.deleted",
          now,
        );
      case "renew":
        return fakeSubscriptionStatusEvent(
          id,
          data,
          "active",
          "customer.subscription.updated",
          now,
        );
    }
  })();
  const payload = JSON.stringify(event);
  const response = await fetch(`${origin}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signFakeEvent(payload, env.webhookSecret),
    },
    body: payload,
    cache: "no-store",
  });
  log.info("stripe.fake.posted", {
    action: parsed.data.action,
    status: response.status,
  });
  if (parsed.data.action === "pay" || parsed.data.action === "subscribe")
    return data.successUrl.replace("{CHECKOUT_SESSION_ID}", id);
  if (parsed.data.action === "refund") return "/documents";
  return "/account";
}

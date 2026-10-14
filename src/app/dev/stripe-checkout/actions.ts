"use server";
/**
 * The fake Checkout page's buttons (REQ-007 Q5, D-709). Each one builds the
 * event Stripe would send, signs it with the local webhook secret and posts
 * it to the real webhook route on this origin, so everything after the
 * signature check is the production path. Inert outside fake mode.
 */
import { redirect } from "next/navigation";
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

const Input = strictObject({
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

export async function fakeCheckoutAction(formData: FormData): Promise<void> {
  const env = readStripeEnv();
  if (!env.fake) redirect("/");
  const parsed = parseInput(Input, {
    id: formData.get("id"),
    action: formData.get("action"),
  });
  if (!parsed.ok) redirect("/");
  const data = decodeFakeSession(parsed.data.id, env.webhookSecret);
  if (!data) redirect("/");
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
    redirect(data.successUrl.replace("{CHECKOUT_SESSION_ID}", parsed.data.id));
  if (parsed.data.action === "refund") redirect("/documents");
  redirect("/account");
}

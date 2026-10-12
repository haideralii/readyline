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
} from "@/lib/payments/fake-session";
import { parseInput, strictObject } from "@/lib/validation";
import { signFakeEvent } from "@/server/payments/fake";
import { readStripeEnv } from "@/server/payments/stripe";

const Input = strictObject({
  id: z.string().min(16).max(4096),
  action: z.enum(["pay", "refund"]),
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
  const event =
    parsed.data.action === "pay"
      ? fakeCompletedEvent(parsed.data.id, data, new Date())
      : fakeRefundedEvent(parsed.data.id, data, origin, new Date());
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
  if (parsed.data.action === "pay")
    redirect(data.successUrl.replace("{CHECKOUT_SESSION_ID}", parsed.data.id));
  redirect("/documents");
}

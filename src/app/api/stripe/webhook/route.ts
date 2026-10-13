/**
 * Stripe webhook endpoint (REQ-007 FR-3, FR-5, FR-7, SR-1, SR-2, SR-6).
 * Reads the raw body as text (never JSON) so the SDK can verify the
 * signature, applies the event through the Supabase store in one
 * transaction, and answers 200 only after the write. After the response, a
 * granted pack gets its receipt URL looked up and its generation job started
 * (D-706, D-707). Logs carry the event id and type, never the payload.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { handleStripeWebhook } from "@/lib/payments/webhook";
import { continueGeneration, keepAlive } from "@/server/generation/kick";
import {
  fakeReceiptLookup,
  stripeReceiptLookup,
  type ReceiptLookup,
} from "@/server/payments/receipts";
import {
  createStripeClient,
  readStripeEnv,
  StripeEnvError,
} from "@/server/payments/stripe";
import { SupabasePaymentStore } from "@/server/payments/store";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Generation time after the response; the job route carries on from there (D-707). */
const AFTER_BUDGET_MS = 35_000;

// Stripe's header is "t=<unix>,v1=<hex>[,v0=...]"; anything else never reaches the SDK.
const Headers = strictObject({
  signature: z
    .string()
    .min(1)
    .max(4096)
    .regex(/^t=\d+,v1=[0-9a-f]+/)
    .optional(),
});

async function attachReceipt(
  lookup: ReceiptLookup,
  store: SupabasePaymentStore,
  payment: { sessionId: string; paymentIntentId: string | null },
): Promise<void> {
  try {
    const url = await lookup(payment);
    if (url) await store.setReceiptUrl(payment.sessionId, url);
  } catch (e) {
    log.warn("stripe.receipt.lookup-failed", {
      sessionId: payment.sessionId,
      error: e,
    });
  }
}

export async function POST(request: Request) {
  let env;
  try {
    env = readStripeEnv();
  } catch (e) {
    if (e instanceof StripeEnvError)
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 },
      );
    throw e;
  }
  const payload = await request.text();
  // The only input we read ourselves is the signature header; its shape is
  // checked through the validation layer (REQ-002 FR-3), its value by the SDK.
  const header = parseInput(Headers, {
    signature: request.headers.get("stripe-signature") ?? undefined,
  });
  const signature = header.ok ? (header.data.signature ?? null) : null;
  try {
    const stripe = createStripeClient(env.secretKey);
    const store = new SupabasePaymentStore(createSupabaseAdminClient());
    const result = await handleStripeWebhook({
      payload,
      signature,
      secret: env.webhookSecret,
      stripe,
      store,
    });
    if (result.status === 200) {
      log.info("stripe.webhook.applied", {
        eventId: result.event?.id,
        type: result.event?.type,
        outcome: result.body.outcome,
      });
      if (result.body.outcome === "granted") {
        const payment = result.payment;
        const lookup = env.fake
          ? fakeReceiptLookup(new URL(request.url).origin)
          : stripeReceiptLookup(stripe);
        keepAlive(async () => {
          if (payment) await attachReceipt(lookup, store, payment);
          await continueGeneration(AFTER_BUDGET_MS);
        });
      }
    } else log.warn("stripe.webhook.rejected", { error: result.body.error });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    if (e instanceof SupabaseEnvError)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 },
      );
    // 500 makes Stripe retry, which the event ledger makes safe.
    log.error("stripe.webhook.failed", { error: e });
    return NextResponse.json({ error: "webhook failed" }, { status: 500 });
  }
}

/**
 * Stripe webhook endpoint (REQ-007 FR-3, SR-1, SR-2, SR-6). Reads the raw
 * body as text (never JSON) so the SDK can verify the signature, applies the
 * event through the Supabase store in one transaction, and answers 200 only
 * after the write. Logs carry the event id and type, never the payload.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { handleStripeWebhook } from "@/lib/payments/webhook";
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

// Stripe's header is "t=<unix>,v1=<hex>[,v0=...]"; anything else never reaches the SDK.
const Headers = strictObject({
  signature: z
    .string()
    .min(1)
    .max(4096)
    .regex(/^t=\d+,v1=[0-9a-f]+/)
    .optional(),
});

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
    const result = await handleStripeWebhook({
      payload,
      signature,
      secret: env.webhookSecret,
      stripe: createStripeClient(env.secretKey),
      store: new SupabasePaymentStore(createSupabaseAdminClient()),
    });
    if (result.status === 200)
      log.info("stripe.webhook.applied", {
        eventId: result.event?.id,
        type: result.event?.type,
        outcome: result.body.outcome,
      });
    else log.warn("stripe.webhook.rejected", { error: result.body.error });
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

/**
 * Fake Stripe mode (REQ-007 AC-1, Dev response Q5, D-709): with STRIPE_FAKE=1
 * outside production, Checkout is a page on our own origin whose "Pay"
 * posts a signed `checkout.session.completed` event to the real webhook
 * route, so the signature check, the SQL function, the job and the download
 * page run exactly as in production without a Stripe account. The session
 * id carries the session's own data, signed, so no process state is needed
 * and a tampered id is refused. Pure functions here; the server wiring is
 * in src/server/payments/fake.ts.
 */
import { createHmac, createHash } from "node:crypto";

export const FAKE_PRICE_ID = "price_fake_pack";
export const FAKE_REGISTERS_PRICE_ID = "price_fake_registers";
export const FAKE_CHECKOUT_PATH = "/dev/stripe-checkout";

export type FakeSessionData = {
  accountId: string;
  assessmentId: string;
  packVersion: string;
  amountCents: number;
  currency: "aud";
  successUrl: string;
  cancelUrl: string;
  /** REQ-009 Session C: a subscription-mode session; absent means the one-off pack. */
  mode?: "payment" | "subscription";
};

/** Secret keys with these prefixes charge real cards; fake mode refuses to start beside one. */
export function isLiveKey(secretKey: string): boolean {
  return secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
}

/** True only when asked for, never on Vercel production, never beside a live key. */
export function isFakeStripeMode(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.STRIPE_FAKE?.trim() === "1" &&
    env.VERCEL_ENV?.trim() !== "production" &&
    !isLiveKey(env.STRIPE_SECRET_KEY?.trim() ?? "")
  );
}

/** The webhook secret in fake mode: the configured one, or a fixed local-only value built at runtime. */
export function fakeWebhookSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.STRIPE_WEBHOOK_SECRET?.trim();
  return configured || ["whsec", "fake", "local", "only", "0000"].join("_");
}

/** A placeholder key: the SDK only needs one to construct, and signing never uses it. */
export function fakeSecretKey(): string {
  return ["sk", "test", "fake", "local", "only"].join("_");
}

function b64url(json: string): string {
  return Buffer.from(json, "utf8").toString("base64url");
}

function mac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex").slice(0, 16);
}

export function encodeFakeSession(
  data: FakeSessionData,
  secret: string,
): string {
  const body = b64url(JSON.stringify(data));
  return `cs_fake_${body}.${mac(body, secret)}`;
}

export function decodeFakeSession(
  id: string,
  secret: string,
): FakeSessionData | null {
  const m = /^cs_fake_([A-Za-z0-9_-]+)\.([0-9a-f]{16})$/.exec(id);
  if (!m) return null;
  const [, body, signature] = m;
  if (mac(body, secret) !== signature) return null;
  try {
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<FakeSessionData>;
    if (
      typeof data.accountId !== "string" ||
      typeof data.assessmentId !== "string" ||
      typeof data.packVersion !== "string" ||
      typeof data.amountCents !== "number" ||
      data.currency !== "aud" ||
      typeof data.successUrl !== "string" ||
      typeof data.cancelUrl !== "string" ||
      (data.mode !== undefined &&
        data.mode !== "payment" &&
        data.mode !== "subscription")
    )
      return null;
    return data as FakeSessionData;
  } catch {
    return null;
  }
}

export function fakePaymentIntentId(sessionId: string): string {
  return `pi_fake_${createHash("sha256").update(sessionId).digest("hex").slice(0, 24)}`;
}

export function fakeChargeId(sessionId: string): string {
  return `ch_fake_${createHash("sha256").update(sessionId).digest("hex").slice(24, 48)}`;
}

/** Where the fake receipt lives: the same page, in its paid state. */
export function fakeReceiptUrl(origin: string, sessionId: string): string {
  return `${origin.replace(/\/$/, "")}${FAKE_CHECKOUT_PATH}/${sessionId}?receipt=1`;
}

/** The shape the webhook maps (src/lib/payments/webhook.ts); only the fields it reads are present. */
export function fakeCompletedEvent(
  sessionId: string,
  data: FakeSessionData,
  now: Date,
): Record<string, unknown> {
  return {
    id: `evt_fake_${createHash("sha256").update(`completed:${sessionId}`).digest("hex").slice(0, 24)}`,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(now.getTime() / 1000),
    livemode: false,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        payment_intent: fakePaymentIntentId(sessionId),
        client_reference_id: data.accountId,
        metadata: {
          account_id: data.accountId,
          assessment_id: data.assessmentId,
          pack_version: data.packVersion,
        },
        amount_total: data.amountCents,
        currency: data.currency,
      },
    },
  };
}

/**
 * The subscription and customer ids a fake subscription session stands for.
 * The subscription id carries the session id itself after its prefix (batch
 * 43, D-914): the fake billing portal is the fake checkout page, which can
 * only decode a session id, and a hash of it could not be turned back; a
 * Stripe id is opaque text, so the length is no concern.
 */
export function fakeSubscriptionId(sessionId: string): string {
  return `sub_fake_${sessionId.replace(/^cs_fake_/, "")}`;
}

/** The session id a fake subscription id was made from, or null for a real one. */
export function fakeSessionIdForSubscription(
  subscriptionId: string,
): string | null {
  return subscriptionId.startsWith("sub_fake_")
    ? `cs_fake_${subscriptionId.slice("sub_fake_".length)}`
    : null;
}
export function fakeCustomerId(sessionId: string): string {
  return `cus_fake_${createHash("sha256").update(`cus:${sessionId}`).digest("hex").slice(0, 24)}`;
}

/** A subscription-mode checkout completion (REQ-009 Session C): the webhook grants the registers. */
export function fakeSubscribedEvent(
  sessionId: string,
  data: FakeSessionData,
  now: Date,
): Record<string, unknown> {
  return {
    id: `evt_fake_${createHash("sha256").update(`subscribed:${sessionId}`).digest("hex").slice(0, 24)}`,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(now.getTime() / 1000),
    livemode: false,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "subscription",
        payment_status: "paid",
        subscription: fakeSubscriptionId(sessionId),
        customer: fakeCustomerId(sessionId),
        client_reference_id: data.accountId,
        metadata: { account_id: data.accountId, kind: "subscription" },
      },
    },
  };
}

/** A subscription lifecycle event with the status Stripe would send; `nonce` makes each press a new event. */
export function fakeSubscriptionStatusEvent(
  sessionId: string,
  data: FakeSessionData,
  status: "active" | "past_due" | "canceled" | "unpaid",
  type:
    | "customer.subscription.updated"
    | "customer.subscription.deleted"
    | "invoice.payment_failed",
  now: Date,
): Record<string, unknown> {
  const id = `evt_fake_${createHash("sha256").update(`${type}:${status}:${sessionId}:${now.getTime()}`).digest("hex").slice(0, 24)}`;
  if (type === "invoice.payment_failed")
    return {
      id,
      object: "event",
      type,
      created: Math.floor(now.getTime() / 1000),
      livemode: false,
      data: {
        object: {
          id: `in_fake_${sessionId.slice(8, 24)}`,
          object: "invoice",
          customer: fakeCustomerId(sessionId),
          parent: {
            subscription_details: {
              subscription: fakeSubscriptionId(sessionId),
              metadata: { account_id: data.accountId, kind: "subscription" },
            },
          },
        },
      },
    };
  return {
    id,
    object: "event",
    type,
    created: Math.floor(now.getTime() / 1000),
    livemode: false,
    data: {
      object: {
        id: fakeSubscriptionId(sessionId),
        object: "subscription",
        status,
        customer: fakeCustomerId(sessionId),
        metadata: { account_id: data.accountId, kind: "subscription" },
        items: {
          data: [
            {
              current_period_end:
                Math.floor(now.getTime() / 1000) + 30 * 86_400,
            },
          ],
        },
      },
    },
  };
}

export function fakeRefundedEvent(
  sessionId: string,
  data: FakeSessionData,
  origin: string,
  now: Date,
): Record<string, unknown> {
  return {
    id: `evt_fake_${createHash("sha256").update(`refunded:${sessionId}`).digest("hex").slice(0, 24)}`,
    object: "event",
    type: "charge.refunded",
    created: Math.floor(now.getTime() / 1000),
    livemode: false,
    data: {
      object: {
        id: fakeChargeId(sessionId),
        object: "charge",
        payment_intent: fakePaymentIntentId(sessionId),
        metadata: { account_id: data.accountId },
        amount_refunded: data.amountCents,
        currency: data.currency,
        receipt_url: fakeReceiptUrl(origin, sessionId),
      },
    },
  };
}

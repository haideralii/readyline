// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decodeFakeSession,
  encodeFakeSession,
  fakeCompletedEvent,
  fakePaymentIntentId,
  fakeRefundedEvent,
  fakeSessionIdForSubscription,
  fakeSubscriptionId,
  fakeWebhookSecret,
  isFakeStripeMode,
  type FakeSessionData,
} from "./fake-session";

const SECRET = ["unit", "test", "secret"].join("-");
const data: FakeSessionData = {
  accountId: "11111111-1111-4111-8111-111111111111",
  assessmentId: "1:abc",
  packVersion: "2026-10-12.3",
  amountCents: 39900,
  currency: "aud",
  successUrl:
    "http://localhost:3000/documents?purchase=success&session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "http://localhost:3000/pricing",
};

describe("fake Stripe mode (REQ-007 Q5, D-709)", () => {
  it("is on only when asked for, never on Vercel production, never beside a live key", () => {
    expect(isFakeStripeMode({})).toBe(false);
    expect(isFakeStripeMode({ STRIPE_FAKE: "1" })).toBe(true);
    expect(isFakeStripeMode({ STRIPE_FAKE: "1", VERCEL_ENV: "preview" })).toBe(
      true,
    );
    expect(
      isFakeStripeMode({ STRIPE_FAKE: "1", VERCEL_ENV: "production" }),
    ).toBe(false);
    const live = ["sk", "live", "0123456789abcdef"].join("_");
    expect(
      isFakeStripeMode({ STRIPE_FAKE: "1", STRIPE_SECRET_KEY: live }),
    ).toBe(false);
    expect(isFakeStripeMode({ STRIPE_FAKE: "true" })).toBe(false);
  });

  it("uses the configured webhook secret when there is one", () => {
    expect(fakeWebhookSecret({ STRIPE_WEBHOOK_SECRET: " abc " })).toBe("abc");
    expect(fakeWebhookSecret({})).toMatch(/^whsec_/);
  });

  it("round-trips a session through a signed id and refuses a tampered one", () => {
    const id = encodeFakeSession(data, SECRET);
    expect(id).toMatch(/^cs_fake_[A-Za-z0-9_-]+\.[0-9a-f]{16}$/);
    expect(decodeFakeSession(id, SECRET)).toEqual(data);
    expect(decodeFakeSession(id, "other")).toBeNull();
    const [body, sig] = id.slice("cs_fake_".length).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...data, amountCents: 1 }),
    ).toString("base64url");
    expect(decodeFakeSession(`cs_fake_${forged}.${sig}`, SECRET)).toBeNull();
    expect(decodeFakeSession(`cs_fake_${body}.0000000000000000`, SECRET)).toBe(
      null,
    );
    expect(decodeFakeSession("cs_live_abc", SECRET)).toBeNull();
  });

  it("builds the events the webhook maps, with ids derived from the session and no email", () => {
    const id = encodeFakeSession(data, SECRET);
    const now = new Date("2026-10-12T10:00:00Z");
    const completed = fakeCompletedEvent(id, data, now);
    const refunded = fakeRefundedEvent(id, data, "http://localhost:3000", now);
    const session = (completed.data as { object: Record<string, unknown> })
      .object;
    const charge = (refunded.data as { object: Record<string, unknown> })
      .object;
    expect(completed.type).toBe("checkout.session.completed");
    expect(session.id).toBe(id);
    expect(session.payment_intent).toBe(fakePaymentIntentId(id));
    expect(session.client_reference_id).toBe(data.accountId);
    expect(session.amount_total).toBe(39900);
    expect(refunded.type).toBe("charge.refunded");
    expect(charge.payment_intent).toBe(fakePaymentIntentId(id));
    expect(charge.amount_refunded).toBe(39900);
    expect(JSON.stringify([completed, refunded])).not.toMatch(/@/);
    expect(completed.id).not.toBe(refunded.id);
  });
});

describe("fake subscription ids carry the session (batch 43, D-914)", () => {
  it("turns a subscription id back into the session id the fake portal needs, and leaves a real id alone", () => {
    const data = {
      accountId: "a",
      assessmentId: "b",
      packVersion: "1",
      amountCents: 3900,
      currency: "aud" as const,
      successUrl: "http://localhost:3000/registers?subscribed=1",
      cancelUrl: "http://localhost:3000/pricing",
      mode: "subscription" as const,
    };
    const sessionId = encodeFakeSession(data, "whsec_test");
    const subscriptionId = fakeSubscriptionId(sessionId);
    expect(subscriptionId.startsWith("sub_fake_")).toBe(true);
    expect(fakeSessionIdForSubscription(subscriptionId)).toBe(sessionId);
    expect(
      decodeFakeSession(
        fakeSessionIdForSubscription(subscriptionId)!,
        "whsec_test",
      ),
    ).toEqual(data);
    expect(fakeSessionIdForSubscription("sub_1AbCdEf")).toBeNull();
  });
});

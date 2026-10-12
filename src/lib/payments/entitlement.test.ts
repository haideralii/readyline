import { describe, expect, it } from "vitest";
import {
  applyStripeEvent,
  EMPTY_LEDGER,
  hasActivePack,
  type Ledger,
  type PaymentEvent,
} from "./entitlement";

const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};

const completed: PaymentEvent = {
  id: "evt_1",
  type: "checkout.session.completed",
  sessionId: "cs_1",
  paymentIntentId: "pi_1",
  accountId: "acct_a",
  assessmentId: "answers-v1-abc",
  amountCents: 39900,
  currency: "AUD",
  receiptUrl: "https://pay.stripe.com/receipts/x",
  occurredAt: "2026-10-12T01:00:00Z",
};

const refunded: PaymentEvent = {
  id: "evt_2",
  type: "charge.refunded",
  paymentIntentId: "pi_1",
  accountId: "acct_a",
  amountCents: 39900,
  currency: "aud",
  occurredAt: "2026-10-12T02:00:00Z",
};

function run(events: PaymentEvent[], ledger: Ledger = EMPTY_LEDGER) {
  const newId = ids();
  const outcomes: string[] = [];
  for (const e of events) {
    const r = applyStripeEvent(ledger, e, newId);
    ledger = r.ledger;
    outcomes.push(r.outcome);
  }
  return { ledger, outcomes };
}

describe("entitlement reducer (REQ-007 FR-3, FR-4, SR-2)", () => {
  it("a completed checkout records a paid purchase and grants one pack entitlement", () => {
    const { ledger, outcomes } = run([completed]);
    expect(outcomes).toEqual(["granted"]);
    expect(ledger.purchases).toHaveLength(1);
    expect(ledger.purchases[0]).toMatchObject({
      accountId: "acct_a",
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
      amountCents: 39900,
      currency: "aud",
      status: "paid",
      receiptUrl: "https://pay.stripe.com/receipts/x",
    });
    expect(ledger.entitlements).toHaveLength(1);
    expect(ledger.entitlements[0]).toMatchObject({
      kind: "pack",
      assessmentId: "answers-v1-abc",
      sourcePurchaseId: ledger.purchases[0].id,
      revokedAt: null,
    });
    expect(hasActivePack(ledger, "acct_a")).toBe(true);
    expect(hasActivePack(ledger, "acct_b")).toBe(false);
  });

  it("a replayed event is a no-op, and a second completion for the same session grants nothing", () => {
    const { ledger, outcomes } = run([
      completed,
      completed,
      { ...completed, id: "evt_1b" },
      {
        ...completed,
        id: "evt_1c",
        type: "checkout.session.async_payment_succeeded",
      },
    ]);
    expect(outcomes).toEqual([
      "granted",
      "duplicate",
      "already_paid",
      "already_paid",
    ]);
    expect(ledger.entitlements).toHaveLength(1);
    expect(ledger.seenEventIds).toEqual(["evt_1", "evt_1b", "evt_1c"]);
  });

  it("a refund marks the purchase refunded and revokes the entitlement, once", () => {
    const { ledger, outcomes } = run([
      completed,
      refunded,
      { ...refunded, id: "evt_3" },
    ]);
    expect(outcomes).toEqual(["granted", "revoked", "duplicate"]);
    expect(ledger.purchases[0]).toMatchObject({
      status: "refunded",
      refundedAt: "2026-10-12T02:00:00Z",
    });
    expect(ledger.entitlements[0].revokedAt).toBe("2026-10-12T02:00:00Z");
    expect(hasActivePack(ledger, "acct_a")).toBe(false);
  });

  it("a refund that arrives before the completion leaves the purchase refunded and never grants", () => {
    const { ledger, outcomes } = run([refunded, completed]);
    expect(outcomes).toEqual(["refund_recorded", "refunded_before_completion"]);
    expect(ledger.purchases).toHaveLength(1);
    expect(ledger.purchases[0]).toMatchObject({
      status: "refunded",
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
    });
    expect(ledger.entitlements).toEqual([]);
  });

  it("other event types are recorded and ignored; malformed events change nothing but the ledger of ids", () => {
    const { ledger, outcomes } = run([
      {
        id: "evt_x",
        type: "payment_intent.created",
        occurredAt: "2026-10-12T00:00:00Z",
      },
      {
        id: "evt_y",
        type: "checkout.session.completed",
        occurredAt: "2026-10-12T00:00:00Z",
      },
      {
        id: "evt_z",
        type: "charge.refunded",
        occurredAt: "2026-10-12T00:00:00Z",
      },
    ]);
    expect(outcomes).toEqual(["ignored", "invalid", "invalid"]);
    expect(ledger.purchases).toEqual([]);
    expect(ledger.entitlements).toEqual([]);
    expect(ledger.seenEventIds).toEqual(["evt_x", "evt_y", "evt_z"]);
  });

  it("does not mutate the ledger it is given", () => {
    const before = JSON.stringify(EMPTY_LEDGER);
    run([completed, refunded]);
    expect(JSON.stringify(EMPTY_LEDGER)).toBe(before);
  });
});

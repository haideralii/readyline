// @vitest-environment node
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { MemoryPaymentStore } from "./memory-store";
import { handleStripeWebhook, toPaymentEvent } from "./webhook";

// The key is never used: constructEvent and generateTestHeaderString only hash.
const stripe = new Stripe("sk_test_placeholder_key_for_signatures");
const SECRET = "whsec_test_secret_for_unit_tests";

function completedEvent(id = "evt_completed_1"): Record<string, unknown> {
  return {
    id,
    object: "event",
    type: "checkout.session.completed",
    created: 1760000000,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        payment_intent: "pi_test_1",
        client_reference_id: "acct-a",
        metadata: {
          account_id: "acct-a",
          assessment_id: "answers-v1-abc",
          pack_version: "2026-10-12.3",
        },
        amount_total: 39900,
        currency: "aud",
      },
    },
  };
}

function refundedEvent(id = "evt_refund_1"): Record<string, unknown> {
  return {
    id,
    object: "event",
    type: "charge.refunded",
    created: 1760003600,
    data: {
      object: {
        id: "ch_test_1",
        object: "charge",
        payment_intent: "pi_test_1",
        metadata: { account_id: "acct-a" },
        amount_refunded: 39900,
        currency: "aud",
        receipt_url: "https://pay.stripe.com/receipts/r1",
      },
    },
  };
}

function signed(body: Record<string, unknown>, secret = SECRET) {
  const payload = JSON.stringify(body);
  return {
    payload,
    signature: stripe.webhooks.generateTestHeaderString({ payload, secret }),
  };
}

async function post(
  store: MemoryPaymentStore,
  body: Record<string, unknown>,
  options: {
    secret?: string;
    tamper?: (payload: string) => string;
    noHeader?: boolean;
  } = {},
) {
  const { payload, signature } = signed(body, options.secret);
  return handleStripeWebhook({
    payload: options.tamper ? options.tamper(payload) : payload,
    signature: options.noHeader ? null : signature,
    secret: SECRET,
    stripe,
    store,
  });
}

describe("Stripe webhook (REQ-007 AC-2, SR-1, SR-2)", () => {
  it("a valid signature grants once; the replayed event is a no-op", async () => {
    const store = new MemoryPaymentStore();
    const first = await post(store, completedEvent());
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true, outcome: "granted" });
    expect(first.event).toEqual({
      id: "evt_completed_1",
      type: "checkout.session.completed",
    });
    const again = await post(store, completedEvent());
    expect(again.body.outcome).toBe("duplicate");
    expect(store.ledger.entitlements).toHaveLength(1);
    expect(store.ledger.purchases[0]).toMatchObject({
      accountId: "acct-a",
      sessionId: "cs_test_1",
      paymentIntentId: "pi_test_1",
      amountCents: 39900,
      currency: "aud",
      status: "paid",
    });
    expect(store.ledger.entitlements[0].assessmentId).toBe("answers-v1-abc");
  });

  it("a tampered body, a wrong secret or a missing header is rejected and nothing is written", async () => {
    const store = new MemoryPaymentStore();
    const tampered = await post(store, completedEvent(), {
      tamper: (p) => p.replace("39900", "1"),
    });
    expect(tampered.status).toBe(400);
    expect(tampered.body).toEqual({ ok: false, error: "bad signature" });
    const wrongSecret = await post(store, completedEvent(), {
      secret: "whsec_other",
    });
    expect(wrongSecret.status).toBe(400);
    const noHeader = await post(store, completedEvent(), { noHeader: true });
    expect(noHeader.status).toBe(400);
    expect(noHeader.body.error).toBe("missing signature");
    expect(store.outcomes).toEqual([]);
    expect(store.ledger.purchases).toEqual([]);
  });

  it("a refund revokes the entitlement and marks the purchase refunded", async () => {
    const store = new MemoryPaymentStore();
    await post(store, completedEvent());
    const r = await post(store, refundedEvent());
    expect(r.body.outcome).toBe("revoked");
    expect(store.ledger.purchases[0].status).toBe("refunded");
    expect(store.ledger.entitlements[0].revokedAt).not.toBeNull();
  });

  it("events out of order (refund before completed) end revoked with no entitlement", async () => {
    const store = new MemoryPaymentStore();
    const r = await post(store, refundedEvent());
    expect(r.body.outcome).toBe("refund_recorded");
    const c = await post(store, completedEvent());
    expect(c.body.outcome).toBe("refunded_before_completion");
    expect(store.ledger.entitlements).toEqual([]);
    expect(store.ledger.purchases).toHaveLength(1);
    expect(store.ledger.purchases[0]).toMatchObject({
      status: "refunded",
      sessionId: "cs_test_1",
    });
  });

  it("other event types are acknowledged and ignored", async () => {
    const store = new MemoryPaymentStore();
    const r = await post(store, {
      id: "evt_other",
      object: "event",
      type: "payment_intent.created",
      created: 1760000000,
      data: { object: { id: "pi_x", object: "payment_intent" } },
    });
    expect(r.status).toBe(200);
    expect(r.body.outcome).toBe("ignored");
  });

  it("maps only the fields the ledger needs; expanded objects give their id", () => {
    const e = toPaymentEvent({
      ...completedEvent("evt_map"),
      data: {
        object: {
          ...(completedEvent().data as { object: Record<string, unknown> })
            .object,
          payment_intent: { id: "pi_expanded", object: "payment_intent" },
        },
      },
    } as unknown as Stripe.Event);
    expect(e).toEqual({
      id: "evt_map",
      type: "checkout.session.completed",
      sessionId: "cs_test_1",
      paymentIntentId: "pi_expanded",
      accountId: "acct-a",
      assessmentId: "answers-v1-abc",
      amountCents: 39900,
      currency: "aud",
      occurredAt: "2025-10-09T08:53:20.000Z",
    });
    expect(Object.keys(e)).not.toContain("customer_email");
  });
});

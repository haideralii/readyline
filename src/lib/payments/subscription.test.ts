import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  applyStripeEvent,
  EMPTY_LEDGER,
  hasActiveSubscription,
  type Ledger,
  type PaymentEvent,
} from "./entitlement";
import { buildSubscriptionCheckoutParams } from "./checkout-params";
import { toPaymentEvent } from "./webhook";

/**
 * REQ-009 Session C: the subscription rules (D-056) as the reducer applies
 * them, the webhook mapping of the four lifecycle events, and the
 * subscription-mode Checkout parameters. Mocked events only; no Stripe.
 */
let n = 0;
const newId = () => `id-${++n}`;

function apply(
  ledger: Ledger,
  event: Partial<PaymentEvent> & { id: string; type: string },
) {
  return applyStripeEvent(
    ledger,
    { occurredAt: "2026-10-13T00:00:00Z", ...event },
    newId,
  );
}

const subscribed = (): Ledger =>
  apply(EMPTY_LEDGER, {
    id: "evt-1",
    type: "checkout.session.completed",
    sessionId: "cs_1",
    accountId: "acc",
    subscriptionId: "sub_1",
    customerId: "cus_1",
  }).ledger;

describe("subscription reducer (REQ-009 Session C, D-056)", () => {
  it("a subscription-mode checkout grants a subscription entitlement, once", () => {
    const first = apply(EMPTY_LEDGER, {
      id: "evt-1",
      type: "checkout.session.completed",
      sessionId: "cs_1",
      accountId: "acc",
      subscriptionId: "sub_1",
      customerId: "cus_1",
    });
    expect(first.outcome).toBe("subscription_granted");
    expect(hasActiveSubscription(first.ledger, "acc")).toBe(true);
    expect(first.ledger.purchases).toEqual([]);
    expect(first.ledger.subscriptions[0]).toMatchObject({
      stripeSubscriptionId: "sub_1",
      status: "active",
      accountId: "acc",
    });
    const replay = apply(first.ledger, {
      id: "evt-1",
      type: "checkout.session.completed",
      subscriptionId: "sub_1",
      accountId: "acc",
    });
    expect(replay.outcome).toBe("duplicate");
    const created = apply(first.ledger, {
      id: "evt-2",
      type: "customer.subscription.created",
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
    });
    expect(created.outcome).toBe("subscription_updated");
    expect(created.ledger.entitlements).toHaveLength(1);
  });

  it("past_due keeps the entitlement; canceled and unpaid revoke it; active again grants a fresh one", () => {
    const ledger = subscribed();
    const failed = apply(ledger, {
      id: "evt-3",
      type: "invoice.payment_failed",
      subscriptionId: "sub_1",
    });
    expect(failed.outcome).toBe("subscription_updated");
    expect(failed.ledger.subscriptions[0].status).toBe("past_due");
    expect(hasActiveSubscription(failed.ledger, "acc")).toBe(true);
    const pastDue = apply(failed.ledger, {
      id: "evt-4",
      type: "customer.subscription.updated",
      subscriptionId: "sub_1",
      subscriptionStatus: "past_due",
    });
    expect(hasActiveSubscription(pastDue.ledger, "acc")).toBe(true);
    const unpaid = apply(pastDue.ledger, {
      id: "evt-5",
      type: "customer.subscription.updated",
      subscriptionId: "sub_1",
      subscriptionStatus: "unpaid",
    });
    expect(unpaid.outcome).toBe("subscription_revoked");
    expect(hasActiveSubscription(unpaid.ledger, "acc")).toBe(false);
    const again = apply(unpaid.ledger, {
      id: "evt-6",
      type: "customer.subscription.updated",
      subscriptionId: "sub_1",
      subscriptionStatus: "unpaid",
    });
    expect(again.outcome).toBe("subscription_updated");
    const renewed = apply(again.ledger, {
      id: "evt-7",
      type: "customer.subscription.updated",
      subscriptionId: "sub_1",
      subscriptionStatus: "active",
    });
    expect(renewed.outcome).toBe("subscription_granted");
    expect(hasActiveSubscription(renewed.ledger, "acc")).toBe(true);
    expect(
      renewed.ledger.entitlements.filter((e) => !e.revokedAt),
    ).toHaveLength(1);
    const deleted = apply(renewed.ledger, {
      id: "evt-8",
      type: "customer.subscription.deleted",
      subscriptionId: "sub_1",
    });
    expect(deleted.outcome).toBe("subscription_revoked");
    expect(hasActiveSubscription(deleted.ledger, "acc")).toBe(false);
  });

  it("an event for an unknown subscription with no account is invalid; a known one needs no account", () => {
    expect(
      apply(EMPTY_LEDGER, {
        id: "e",
        type: "customer.subscription.updated",
        subscriptionId: "sub_x",
        subscriptionStatus: "active",
      }).outcome,
    ).toBe("invalid");
    const r = apply(subscribed(), {
      id: "e2",
      type: "customer.subscription.deleted",
      subscriptionId: "sub_1",
    });
    expect(r.outcome).toBe("subscription_revoked");
    expect(
      apply(EMPTY_LEDGER, { id: "e3", type: "customer.subscription.updated" })
        .outcome,
    ).toBe("invalid");
  });

  it("a pack checkout is untouched by the subscription rules", () => {
    const r = apply(EMPTY_LEDGER, {
      id: "p1",
      type: "checkout.session.completed",
      sessionId: "cs_p",
      paymentIntentId: "pi_1",
      accountId: "acc",
      amountCents: 39900,
    });
    expect(r.outcome).toBe("granted");
    expect(hasActiveSubscription(r.ledger, "acc")).toBe(false);
  });
});

describe("webhook mapping of subscription events", () => {
  const base = {
    created: 1760313600,
    livemode: false,
    object: "event" as const,
  };
  it("subscription-mode checkout carries the subscription and customer ids", () => {
    const e = toPaymentEvent({
      ...base,
      id: "evt_c",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          object: "checkout.session",
          mode: "subscription",
          subscription: "sub_1",
          customer: { id: "cus_1" },
          client_reference_id: "acc",
          metadata: { account_id: "acc", kind: "subscription" },
        },
      },
    } as unknown as Stripe.Event);
    expect(e).toMatchObject({
      subscriptionId: "sub_1",
      customerId: "cus_1",
      accountId: "acc",
      sessionId: "cs_1",
    });
    expect(e.paymentIntentId).toBeUndefined();
  });
  it("subscription lifecycle events carry the status, the account from metadata and the period end", () => {
    const e = toPaymentEvent({
      ...base,
      id: "evt_s",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          object: "subscription",
          status: "past_due",
          customer: "cus_1",
          metadata: { account_id: "acc" },
          items: { data: [{ current_period_end: 1762905600 }] },
        },
      },
    } as unknown as Stripe.Event);
    expect(e).toMatchObject({
      subscriptionId: "sub_1",
      subscriptionStatus: "past_due",
      accountId: "acc",
      customerId: "cus_1",
    });
    expect(e.periodEnd).toBe("2025-11-12T00:00:00.000Z");
  });
  it("invoice.payment_failed names the subscription through the invoice's parent", () => {
    const e = toPaymentEvent({
      ...base,
      id: "evt_i",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_1",
          object: "invoice",
          customer: "cus_1",
          parent: {
            subscription_details: {
              subscription: "sub_1",
              metadata: { account_id: "acc" },
            },
          },
        },
      },
    } as unknown as Stripe.Event);
    expect(e).toMatchObject({
      subscriptionId: "sub_1",
      accountId: "acc",
      customerId: "cus_1",
    });
  });
});

describe("subscription Checkout parameters (CLAUDE.md 5)", () => {
  it("subscription mode, card only, no trial, no promotion codes, the account on the subscription's metadata", () => {
    const p = buildSubscriptionCheckoutParams({
      priceId: "price_reg",
      accountId: "acc",
      email: "owner@example.test",
      siteUrl: "https://readyline.example/",
      cancelPath: "/account",
    });
    expect(p.mode).toBe("subscription");
    expect(p.allowed_payment_method_types).toEqual(["card"]);
    expect(p.line_items).toEqual([{ price: "price_reg", quantity: 1 }]);
    expect(p.subscription_data).toEqual({
      metadata: { account_id: "acc", kind: "subscription" },
    });
    expect(p.subscription_data?.trial_period_days).toBeUndefined();
    expect(p.allow_promotion_codes).toBe(false);
    expect(p.success_url).toBe(
      "https://readyline.example/registers?subscribed=1&session_id={CHECKOUT_SESSION_ID}",
    );
    expect(p.cancel_url).toBe("https://readyline.example/account");
    expect(JSON.stringify(p)).not.toMatch(/afterpay|klarna|zip|instal/i);
  });
});

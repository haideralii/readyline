// @vitest-environment node
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

// `server-only` throws outside a React server context; the test stubs it.
vi.mock("server-only", () => ({}));

const { createCheckoutSession } = await import("./checkout");

describe("createCheckoutSession (REQ-007 FR-2, SR-3)", () => {
  it("creates the session with the card-only params and an idempotency key, and returns id and url", async () => {
    const calls: Array<
      [Stripe.Checkout.SessionCreateParams, Stripe.RequestOptions | undefined]
    > = [];
    const stripe = {
      checkout: {
        sessions: {
          create: async (
            params: Stripe.Checkout.SessionCreateParams,
            options?: Stripe.RequestOptions,
          ) => {
            calls.push([params, options]);
            return {
              id: "cs_test_42",
              url: "https://checkout.stripe.com/c/pay/cs_test_42",
            };
          },
        },
      },
    };
    const session = await createCheckoutSession({
      stripe,
      checkout: {
        priceId: "price_pack",
        accountId: "acct-1",
        email: "owner@example.test",
        assessmentId: "answers-v1-abc",
        packVersion: "2026-10-12.3",
        siteUrl: "https://readyline.example",
        cancelPath: "/pricing",
      },
      idempotencyKey: "acct-1:answers-v1-abc:1",
    });
    expect(session).toEqual({
      id: "cs_test_42",
      url: "https://checkout.stripe.com/c/pay/cs_test_42",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0][0].allowed_payment_method_types).toEqual(["card"]);
    expect(calls[0][0].line_items).toEqual([
      { price: "price_pack", quantity: 1 },
    ]);
    expect(calls[0][1]).toEqual({ idempotencyKey: "acct-1:answers-v1-abc:1" });
  });

  it("refuses a session without a URL rather than redirecting nowhere", async () => {
    const stripe = {
      checkout: {
        sessions: { create: async () => ({ id: "cs_x", url: null }) },
      },
    };
    await expect(
      createCheckoutSession({
        stripe,
        checkout: {
          priceId: "p",
          accountId: "a",
          email: "e@example.test",
          assessmentId: "s",
          packVersion: "v",
          siteUrl: "https://x.example",
          cancelPath: "/pricing",
        },
        idempotencyKey: "k",
      }),
    ).rejects.toThrow(/no URL/);
  });
});

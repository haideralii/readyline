// @vitest-environment node
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import {
  CHECKOUT_FAILED,
  CHECKOUT_NEEDS_ANSWERS,
  CHECKOUT_RATE_LIMITED,
  CHECKOUT_UNAVAILABLE,
  stripeFailureFields,
} from "./messages";

vi.mock("server-only", () => ({}));

describe("checkout messages (batch 23 item 2)", () => {
  it("the failure message promises nothing was charged and passes the claims lint", () => {
    expect(CHECKOUT_FAILED).toMatch(/nothing was charged/);
    for (const m of [
      CHECKOUT_FAILED,
      CHECKOUT_NEEDS_ANSWERS,
      CHECKOUT_RATE_LIMITED,
      CHECKOUT_UNAVAILABLE,
    ])
      expect(findProhibitedClaims(m)).toEqual([]);
  });

  it("logs a Stripe error's type, code and status, never its message", () => {
    const key = ["sk", "test", "0123456789abcdef0123456789"].join("_");
    const err = new Stripe.errors.StripeAuthenticationError({
      type: "invalid_request_error",
      message: `Invalid API Key provided: ${key}`,
      code: "api_key_invalid",
      statusCode: 401,
    } as never);
    const fields = stripeFailureFields(err);
    expect(fields).toEqual({
      type: "StripeAuthenticationError",
      code: "api_key_invalid",
      status: 401,
    });
    expect(JSON.stringify(fields)).not.toContain(key);
  });

  it("copes with a non-Stripe error", () => {
    expect(stripeFailureFields(new Error("network"))).toEqual({
      type: "Error",
      code: null,
      status: null,
    });
    expect(stripeFailureFields(null)).toEqual({
      type: "unknown",
      code: null,
      status: null,
    });
  });
});

describe("createCheckoutSession lets a Stripe error reach the action (batch 23 item 2)", () => {
  it("rejects with the SDK error so the action can turn it into a message", async () => {
    const { createCheckoutSession } = await import("./checkout");
    const stripe = {
      checkout: {
        sessions: {
          create: async () => {
            throw new Stripe.errors.StripeInvalidRequestError({
              type: "invalid_request_error",
              message: "No such price",
              code: "resource_missing",
              statusCode: 400,
            } as never);
          },
        },
      },
    };
    await expect(
      createCheckoutSession({
        stripe,
        checkout: {
          priceId: "price_missing",
          accountId: "acct-1",
          email: "owner@example.test",
          assessmentId: "1:abc",
          packVersion: "2026-10-12.3",
          siteUrl: "https://readyline.example",
          cancelPath: "/pricing",
        },
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ code: "resource_missing" });
  });
});

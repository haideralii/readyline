import { describe, expect, it } from "vitest";
import { buildCheckoutParams, safeCancelPath } from "./checkout-params";

const input = {
  priceId: "price_123",
  accountId: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.test",
  assessmentId: "answers-v1-abc",
  packVersion: "2026-10-12.3",
  siteUrl: "https://readyline.example/",
  cancelPath: "/start/result",
};

describe("Checkout params (REQ-007 FR-2, AC-3, SR-3)", () => {
  it("is card only with no instalments, promotions or other payment methods", () => {
    const p = buildCheckoutParams(input);
    expect(p.allowed_payment_method_types).toEqual(["card"]);
    expect(p).not.toHaveProperty("payment_method_types");
    expect(p).not.toHaveProperty("payment_method_options");
    expect(p).not.toHaveProperty("payment_method_configuration");
    expect(p.allow_promotion_codes).toBe(false);
    expect(JSON.stringify(p)).not.toMatch(
      /afterpay|klarna|zip|installment|instalment/i,
    );
  });

  it("charges one fixed Price once, in payment mode, with the account on the session and the payment intent", () => {
    const p = buildCheckoutParams(input);
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(p.client_reference_id).toBe(input.accountId);
    expect(p.customer_email).toBe("owner@example.test");
    expect(p.metadata).toEqual({
      account_id: input.accountId,
      assessment_id: "answers-v1-abc",
      pack_version: "2026-10-12.3",
    });
    expect(p.payment_intent_data?.metadata).toEqual(p.metadata);
  });

  it("returns to our own origin, with the cancel path allow-listed", () => {
    const p = buildCheckoutParams(input);
    expect(p.success_url).toBe(
      "https://readyline.example/documents?purchase=success&session_id={CHECKOUT_SESSION_ID}",
    );
    expect(p.cancel_url).toBe("https://readyline.example/start/result");
    expect(
      buildCheckoutParams({ ...input, cancelPath: "https://evil.example" })
        .cancel_url,
    ).toBe("https://readyline.example/pricing");
    expect(safeCancelPath(undefined)).toBe("/pricing");
    expect(safeCancelPath("/account")).toBe("/pricing");
    expect(safeCancelPath("/documents")).toBe("/documents");
  });
});

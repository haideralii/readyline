import { describe, expect, it } from "vitest";
import { checkPackPrice } from "./price-check";

describe("pack price check (REQ-007 FR-9, AC-6)", () => {
  const read = async () => ({ unit_amount: 39900, currency: "aud" });

  it("passes when the Price's amount and currency match the display value", async () => {
    expect(
      await checkPackPrice({ read, priceId: "price_x", expectedCents: 39900 }),
    ).toEqual({ ok: true, amountCents: 39900, currency: "aud" });
  });

  it("fails on a different amount, a different currency, an unset display value or a read error", async () => {
    expect(
      (await checkPackPrice({ read, priceId: "price_x", expectedCents: 34900 }))
        .ok,
    ).toBe(false);
    expect(
      (
        await checkPackPrice({
          read: async () => ({ unit_amount: 39900, currency: "usd" }),
          priceId: "price_x",
          expectedCents: 39900,
        })
      ).ok,
    ).toBe(false);
    expect(
      (await checkPackPrice({ read, priceId: "price_x", expectedCents: null }))
        .ok,
    ).toBe(false);
    const failed = await checkPackPrice({
      read: async () => {
        throw new Error("network");
      },
      priceId: "price_x",
      expectedCents: 39900,
    });
    expect(failed).toEqual({
      ok: false,
      reason: "could not read the Price: network",
    });
  });
});

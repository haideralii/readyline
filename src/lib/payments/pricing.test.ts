import { describe, expect, it } from "vitest";
import { formatAud, readPricing } from "./pricing";

describe("display pricing (REQ-007 FR-1, FR-9)", () => {
  it("reads the three display values and treats anything unset or invalid as null", () => {
    expect(readPricing({})).toEqual({
      packPriceCents: null,
      gstLine: null,
      subscriptionPriceCents: null,
    });
    expect(
      readPricing({
        PACK_PRICE_AUD_CENTS: "39900",
        GST_LINE: " No GST while Readyline is not registered for GST. ",
        SUBSCRIPTION_PRICE_AUD_CENTS: "3900",
      }),
    ).toEqual({
      packPriceCents: 39900,
      gstLine: "No GST while Readyline is not registered for GST.",
      subscriptionPriceCents: 3900,
    });
    expect(
      readPricing({ PACK_PRICE_AUD_CENTS: "399.00" }).packPriceCents,
    ).toBeNull();
    expect(
      readPricing({ PACK_PRICE_AUD_CENTS: "0" }).packPriceCents,
    ).toBeNull();
    expect(
      readPricing({ PACK_PRICE_AUD_CENTS: "-5" }).packPriceCents,
    ).toBeNull();
  });

  it("formats whole dollars without cents and otherwise with two decimals", () => {
    expect(formatAud(39900)).toBe("AUD 399");
    expect(formatAud(39950)).toBe("AUD 399.50");
    expect(formatAud(100500)).toBe("AUD 1,005");
    expect(formatAud(5)).toBe("AUD 0.05");
  });
});

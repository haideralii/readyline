// @vitest-environment node
/**
 * REQ-022 FR-3, AC-2 and REQ-007 AC-6 together: the boot verdict over an
 * injected Price reader. A live key beside a test Price or a wrong display
 * price is refused with the conditions named; a live key with everything
 * right is served; a test key is only logged; fake mode and no key judge
 * nothing. The refusal store answers what the routes read.
 */
import { afterEach, describe, expect, it } from "vitest";
import { judgeStartup, readPriceFact, type PriceReader } from "./price-startup";
import { paymentRefusal, setPaymentRefusal } from "./refusal";

const reader = (
  prices: Record<
    string,
    { livemode: boolean; unit_amount: number | null; currency: string }
  >,
): PriceReader => ({
  async retrieve(id) {
    const p = prices[id];
    if (!p)
      throw Object.assign(new Error("no such price"), { statusCode: 404 });
    return p;
  },
});

const live = { livemode: true, unit_amount: 39900, currency: "aud" };
const test = { livemode: false, unit_amount: 39900, currency: "aud" };

describe("judgeStartup", () => {
  afterEach(() => setPaymentRefusal([]));

  it("a live key with a live AUD Price at the display price serves", async () => {
    const v = await judgeStartup(
      {
        STRIPE_SECRET_KEY: "rk_live_x",
        STRIPE_PRICE_PACK: "p1",
        STRIPE_WEBHOOK_SECRET: "w",
        PACK_PRICE_AUD_CENTS: "39900",
      },
      reader({ p1: live }),
    );
    expect(v).toEqual({ refused: [], logged: "ok" });
  });

  it("a live key beside a test Price, or a differing display price, is refused with the conditions named", async () => {
    const v = await judgeStartup(
      {
        STRIPE_SECRET_KEY: "rk_live_x",
        STRIPE_PRICE_PACK: "p1",
        STRIPE_WEBHOOK_SECRET: "w",
        PACK_PRICE_AUD_CENTS: "34900",
      },
      reader({ p1: test }),
    );
    expect(v.logged).toBe("mismatch");
    expect(v.refused).toEqual([
      "STRIPE_PRICE_PACK is a test-mode Price beside a live Stripe key",
      "PACK_PRICE_AUD_CENTS differs from the unit_amount of STRIPE_PRICE_PACK",
    ]);
  });

  it("a live key whose Price id does not exist is refused, not crashed", async () => {
    const v = await judgeStartup(
      {
        STRIPE_SECRET_KEY: "rk_live_x",
        STRIPE_PRICE_PACK: "nope",
        STRIPE_WEBHOOK_SECRET: "w",
        PACK_PRICE_AUD_CENTS: "39900",
      },
      reader({}),
    );
    expect(v.refused).toEqual([
      "STRIPE_PRICE_PACK could not be read from Stripe (not-found)",
    ]);
  });

  it("a test key is logged, never refused; fake mode and no key judge nothing", async () => {
    const mismatch = await judgeStartup(
      {
        STRIPE_SECRET_KEY: "sk_test_x",
        STRIPE_PRICE_PACK: "p1",
        PACK_PRICE_AUD_CENTS: "34900",
      },
      reader({ p1: test }),
    );
    expect(mismatch).toEqual({ refused: [], logged: "mismatch" });
    const fine = await judgeStartup(
      {
        STRIPE_SECRET_KEY: "sk_test_x",
        STRIPE_PRICE_PACK: "p1",
        PACK_PRICE_AUD_CENTS: "39900",
      },
      reader({ p1: test }),
    );
    expect(fine).toEqual({ refused: [], logged: "ok" });
    expect(
      await judgeStartup(
        {
          STRIPE_SECRET_KEY: "sk_test_x",
          STRIPE_PRICE_PACK: "p1",
          STRIPE_FAKE: "1",
        },
        reader({}),
      ),
    ).toEqual({ refused: [], logged: "none" });
    expect(await judgeStartup({}, reader({}))).toEqual({
      refused: [],
      logged: "none",
    });
  });

  it("readPriceFact classifies a permission error, a missing Price and any other failure", async () => {
    const denied: PriceReader = {
      async retrieve() {
        throw Object.assign(new Error("denied"), {
          type: "StripePermissionError",
          statusCode: 403,
        });
      },
    };
    expect(await readPriceFact(denied, "p")).toEqual({
      ok: false,
      reason: "no-permission",
    });
    expect(await readPriceFact(reader({}), "p")).toEqual({
      ok: false,
      reason: "not-found",
    });
    const broken: PriceReader = {
      async retrieve() {
        throw new Error("network");
      },
    };
    expect(await readPriceFact(broken, "p")).toEqual({
      ok: false,
      reason: "error",
    });
    expect(await readPriceFact(reader({ p: live }), undefined)).toBeNull();
  });

  it("the refusal store is empty until set and reads back what was stored", () => {
    expect(paymentRefusal()).toEqual([]);
    setPaymentRefusal(["STRIPE_FAKE is set beside a live Stripe key"]);
    expect(paymentRefusal()).toEqual([
      "STRIPE_FAKE is set beside a live Stripe key",
    ]);
  });
});

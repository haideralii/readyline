// @vitest-environment node
/**
 * REQ-022 FR-3, AC-2: every combination that must refuse the payment routes
 * beside a live key, nothing refused beside a test key or none, and the
 * generate job's own guard. The strings name variables, never values.
 */
import { describe, expect, it } from "vitest";
import {
  generationProblems,
  liveModeProblems,
  type PriceFact,
} from "./live-guards";

const okLive: PriceFact = {
  ok: true,
  livemode: true,
  unitAmount: 39900,
  currency: "aud",
};
const okTest: PriceFact = {
  ok: true,
  livemode: false,
  unitAmount: 39900,
  currency: "aud",
};

const live = {
  STRIPE_SECRET_KEY: "rk_live_marker",
  STRIPE_WEBHOOK_SECRET: "whsec_marker",
  STRIPE_PRICE_PACK: "price_marker",
  PACK_PRICE_AUD_CENTS: "39900",
};

describe("liveModeProblems (REQ-022 FR-3)", () => {
  it("a live key with everything right refuses nothing", () => {
    expect(
      liveModeProblems({ env: live, pack: okLive, registers: null }),
    ).toEqual([]);
  });

  it("a test key or no key is never judged, whatever else is set", () => {
    expect(
      liveModeProblems({
        env: { ...live, STRIPE_SECRET_KEY: "sk_test_marker", STRIPE_FAKE: "1" },
        pack: okTest,
        registers: null,
      }),
    ).toEqual([]);
    expect(liveModeProblems({ env: {}, pack: null, registers: null })).toEqual(
      [],
    );
  });

  it("STRIPE_FAKE beside a live key refuses", () => {
    const p = liveModeProblems({
      env: { ...live, STRIPE_FAKE: "1" },
      pack: okLive,
      registers: null,
    });
    expect(p).toEqual(["STRIPE_FAKE is set beside a live Stripe key"]);
  });

  it("a missing webhook secret or pack Price id refuses", () => {
    expect(
      liveModeProblems({
        env: { ...live, STRIPE_WEBHOOK_SECRET: "" },
        pack: okLive,
        registers: null,
      }),
    ).toEqual(["STRIPE_WEBHOOK_SECRET is missing beside a live Stripe key"]);
    expect(
      liveModeProblems({
        env: { ...live, STRIPE_PRICE_PACK: " " },
        pack: null,
        registers: null,
      }),
    ).toEqual(["STRIPE_PRICE_PACK is missing beside a live Stripe key"]);
  });

  it("a test-mode Price, a wrong currency, an unset or differing display price each refuse", () => {
    expect(
      liveModeProblems({ env: live, pack: okTest, registers: null }),
    ).toEqual([
      "STRIPE_PRICE_PACK is a test-mode Price beside a live Stripe key",
    ]);
    expect(
      liveModeProblems({
        env: live,
        pack: { ...okLive, currency: "usd" },
        registers: null,
      }),
    ).toEqual(["STRIPE_PRICE_PACK is not priced in AUD"]);
    expect(
      liveModeProblems({
        env: { ...live, PACK_PRICE_AUD_CENTS: "" },
        pack: okLive,
        registers: null,
      }),
    ).toEqual(["PACK_PRICE_AUD_CENTS is not set"]);
    expect(
      liveModeProblems({
        env: { ...live, PACK_PRICE_AUD_CENTS: "34900" },
        pack: okLive,
        registers: null,
      }),
    ).toEqual([
      "PACK_PRICE_AUD_CENTS differs from the unit_amount of STRIPE_PRICE_PACK",
    ]);
  });

  it("a Price that was not or could not be read refuses, naming the reason only", () => {
    expect(
      liveModeProblems({ env: live, pack: null, registers: null }),
    ).toEqual(["STRIPE_PRICE_PACK was not read from Stripe"]);
    expect(
      liveModeProblems({
        env: live,
        pack: { ok: false, reason: "no-permission" },
        registers: null,
      }),
    ).toEqual([
      "STRIPE_PRICE_PACK could not be read from Stripe (no-permission)",
    ]);
  });

  it("the registers Price is judged only when configured, against its own display price", () => {
    const env = {
      ...live,
      STRIPE_PRICE_REGISTERS: "price_marker_2",
      SUBSCRIPTION_PRICE_AUD_CENTS: "3900",
    };
    expect(
      liveModeProblems({
        env,
        pack: okLive,
        registers: { ...okLive, unitAmount: 3900 },
      }),
    ).toEqual([]);
    expect(liveModeProblems({ env, pack: okLive, registers: okTest })).toEqual([
      "STRIPE_PRICE_REGISTERS is a test-mode Price beside a live Stripe key",
      "SUBSCRIPTION_PRICE_AUD_CENTS differs from the unit_amount of STRIPE_PRICE_REGISTERS",
    ]);
    expect(
      liveModeProblems({ env: live, pack: okLive, registers: okTest }),
    ).toEqual([]);
  });

  it("several conditions are all named, and none carries a value", () => {
    const p = liveModeProblems({
      env: { ...live, STRIPE_FAKE: "1", STRIPE_WEBHOOK_SECRET: "" },
      pack: okTest,
      registers: null,
    });
    expect(p).toHaveLength(3);
    for (const s of p) expect(s).not.toMatch(/marker/);
  });
});

describe("generationProblems (REQ-022 FR-3)", () => {
  it("GENERATION_LIVE=1 without a key refuses; with a key, or not live, runs", () => {
    expect(generationProblems({ GENERATION_LIVE: "1" })).toEqual([
      "GENERATION_LIVE is 1 without an ANTHROPIC_API_KEY",
    ]);
    expect(
      generationProblems({ GENERATION_LIVE: "1", ANTHROPIC_API_KEY: "k" }),
    ).toEqual([]);
    expect(generationProblems({ GENERATION_LIVE: "0" })).toEqual([]);
    expect(generationProblems({})).toEqual([]);
  });
});

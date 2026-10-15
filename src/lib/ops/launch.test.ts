// @vitest-environment node
/**
 * REQ-022 FR-1, SR-1: the switchboard's rows over fixed facts, every state
 * reachable, the no-secrets rule proven with marker values, and the runbook
 * (product/ops/LAUNCH.md) naming every row.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  countByState,
  LAUNCH_ROW_NAMES,
  launchRows,
  legalRowName,
  rowsToText,
  stripeMode,
  type LaunchFacts,
} from "./launch";

const NOW = new Date("2026-10-15T03:00:00Z");

function facts(
  over: Partial<LaunchFacts> = {},
  env: Record<string, string> = {},
): LaunchFacts {
  return {
    env,
    requestHost: "readyline.example",
    aboutNamesBusiness: null,
    stripe: { pack: null, registers: null, webhookEndpoint: null },
    email: { provider: "log-only", domainVerified: null, lastTestSendAt: null },
    jobs: { purge: null, generate: null, reminders: null },
    adminTotpEnrolled: null,
    legal: [{ slug: "terms", updated: "2026-10-12" }],
    now: NOW,
    ...over,
  };
}

const byId = (f: LaunchFacts) =>
  Object.fromEntries(launchRows(f).map((r) => [r.id, r]));

const everythingSet = (): LaunchFacts =>
  facts(
    {
      aboutNamesBusiness: true,
      stripe: {
        pack: { ok: true, livemode: true, unitAmount: 39900, currency: "aud" },
        registers: {
          ok: true,
          livemode: true,
          unitAmount: 3900,
          currency: "aud",
        },
        webhookEndpoint: "matches",
      },
      email: {
        provider: "ses",
        domainVerified: true,
        lastTestSendAt: "2026-10-15T01:00:00Z",
      },
      jobs: {
        purge: "2026-10-14T16:00:00Z",
        generate: "2026-10-15T02:30:00Z",
        reminders: "2026-10-14T20:00:00Z",
      },
      adminTotpEnrolled: true,
    },
    {
      BUSINESS_NAME: "MARKER-name",
      BUSINESS_ABN: "12345678901",
      CONTACT_EMAIL: "MARKER-email",
      STRIPE_SECRET_KEY: "rk_live_MARKER",
      STRIPE_PRICE_PACK: "price_MARKER_pack",
      STRIPE_PRICE_REGISTERS: "price_MARKER_reg",
      PACK_PRICE_AUD_CENTS: "39900",
      SUBSCRIPTION_PRICE_AUD_CENTS: "3900",
      STRIPE_WEBHOOK_SECRET: "whsec_MARKER",
      GST_LINE: "MARKER-gst",
      GENERATION_ENABLED: "true",
      GENERATION_LIVE: "1",
      ANTHROPIC_API_KEY: "sk-ant-MARKER",
      ANTHROPIC_MODEL: "MARKER-model",
      NEXT_PUBLIC_SITE_URL: "https://readyline.example",
      CRON_SECRET: "MARKER-cron",
      HASH_PEPPER: "MARKER-pepper",
    },
  );

describe("launchRows (REQ-022 FR-1)", () => {
  it("with every variable and service in place, every row is set except the one that cannot be read here", () => {
    const rows = launchRows(everythingSet());
    const notSet = rows.filter((r) => r.state !== "set").map((r) => r.id);
    expect(notSet).toEqual(["supabase-urls"]);
    expect(byId(everythingSet())["supabase-urls"].state).toBe("unverified");
    expect(countByState(rows).set).toBe(rows.length - 1);
  });

  it("an empty environment reads unset on every variable row, never mismatched", () => {
    const rows = launchRows(facts());
    const states = new Set(rows.map((r) => r.state));
    expect(states.has("mismatched")).toBe(false);
    expect(byId(facts())["business-name"].state).toBe("unset");
    expect(byId(facts())["stripe-mode"].state).toBe("unset");
    expect(byId(facts())["legal-terms"].state).toBe("set");
  });

  it("the Stripe mode row: test key is unset with the D-2202 sentence, fake is mismatched, live is set", () => {
    expect(stripeMode({ STRIPE_SECRET_KEY: "sk_test_x" })).toBe("test");
    expect(stripeMode({ STRIPE_SECRET_KEY: "rk_live_x" })).toBe("live");
    expect(
      stripeMode({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_FAKE: "1" }),
    ).toBe("fake");
    expect(stripeMode({})).toBe("none");
    const test = byId(facts({}, { STRIPE_SECRET_KEY: "sk_test_x" }))[
      "stripe-mode"
    ];
    expect(test.state).toBe("unset");
    expect(test.sentence).toMatch(/D-2202/);
    expect(
      byId(facts({}, { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_FAKE: "1" }))[
        "stripe-mode"
      ].state,
    ).toBe("mismatched");
  });

  it("the pack price row: each mismatch has its own sentence; no permission is unverified", () => {
    const env = {
      STRIPE_SECRET_KEY: "rk_live_x",
      STRIPE_PRICE_PACK: "price_x",
      PACK_PRICE_AUD_CENTS: "39900",
    };
    const row = (
      pack: LaunchFacts["stripe"]["pack"],
      extra: Record<string, string> = {},
    ) =>
      byId(
        facts(
          { stripe: { pack, registers: null, webhookEndpoint: null } },
          { ...env, ...extra },
        ),
      )["price-pack"];
    expect(
      row({ ok: true, livemode: true, unitAmount: 39900, currency: "aud" })
        .state,
    ).toBe("set");
    expect(
      row({ ok: true, livemode: false, unitAmount: 39900, currency: "aud" }),
    ).toMatchObject({
      state: "mismatched",
      sentence: expect.stringMatching(/test-mode Price beside a live key/),
    });
    expect(
      row({ ok: true, livemode: true, unitAmount: 34900, currency: "aud" })
        .sentence,
    ).toMatch(/differs/);
    expect(
      row({ ok: true, livemode: true, unitAmount: 39900, currency: "usd" })
        .sentence,
    ).toMatch(/AUD/);
    expect(row({ ok: false, reason: "no-permission" }).state).toBe(
      "unverified",
    );
    expect(row({ ok: false, reason: "not-found" }).state).toBe("mismatched");
    expect(row(null).state).toBe("unverified");
    expect(
      row(
        { ok: true, livemode: true, unitAmount: 39900, currency: "aud" },
        { PACK_PRICE_AUD_CENTS: "" },
      ).state,
    ).toBe("unset");
    expect(
      byId(facts({}, { STRIPE_SECRET_KEY: "rk_live_x" }))["price-pack"].state,
    ).toBe("unset");
  });

  it("the ABN row distinguishes unset, eleven digits and anything else", () => {
    expect(byId(facts())["business-abn"].state).toBe("unset");
    expect(
      byId(facts({}, { BUSINESS_ABN: "12345678901" }))["business-abn"].state,
    ).toBe("set");
    expect(
      byId(facts({}, { BUSINESS_ABN: "1234" }))["business-abn"].state,
    ).toBe("mismatched");
  });

  it("the jobs rows: a run inside 26 hours is set, older is mismatched, none is unset", () => {
    const f = facts({
      jobs: {
        purge: "2026-10-14T16:00:00Z",
        generate: "2026-10-13T16:00:00Z",
        reminders: null,
      },
    });
    expect(byId(f)["job-purge"].state).toBe("set");
    expect(byId(f)["job-generate"].state).toBe("mismatched");
    expect(byId(f)["job-reminders"].state).toBe("unset");
  });

  it("the site-url row compares hosts only", () => {
    expect(
      byId(facts({}, { NEXT_PUBLIC_SITE_URL: "https://readyline.example" }))[
        "site-url"
      ].state,
    ).toBe("set");
    expect(
      byId(facts({}, { NEXT_PUBLIC_SITE_URL: "https://x.vercel.app" }))[
        "site-url"
      ].state,
    ).toBe("mismatched");
    expect(
      byId(
        facts(
          { requestHost: null },
          { NEXT_PUBLIC_SITE_URL: "https://readyline.example" },
        ),
      )["site-url"].state,
    ).toBe("unverified");
  });

  it("the legal rows follow the pages: within 90 days set, older mismatched, unreadable mismatched", () => {
    const f = facts({
      legal: [
        { slug: "terms", updated: "2026-10-12" },
        { slug: "privacy", updated: "2026-06-01" },
        { slug: "ai", updated: "soon" },
      ],
    });
    const ids = byId(f);
    expect(ids["legal-terms"].state).toBe("set");
    expect(ids["legal-privacy"].state).toBe("mismatched");
    expect(ids["legal-ai"].state).toBe("mismatched");
    expect(ids["legal-terms"].name).toBe(legalRowName("terms"));
  });

  it("the email and admin rows read the facts the server gathers", () => {
    const f = facts({
      email: {
        provider: "ses",
        domainVerified: false,
        lastTestSendAt: "2026-10-13T01:00:00Z",
      },
      adminTotpEnrolled: false,
    });
    expect(byId(f)["email-provider"].state).toBe("set");
    expect(byId(f)["email-domain"].state).toBe("mismatched");
    expect(byId(f)["email-test-send"].state).toBe("unset");
    expect(byId(f)["admin-totp"].state).toBe("unset");
    expect(byId(facts())["email-domain"].state).toBe("unverified");
  });

  it("the hash pepper row is unset until HASH_PEPPER exists (retro finding 34)", () => {
    const unset = byId(facts())["hash-pepper"];
    expect(unset.state).toBe("unset");
    expect(unset.sentence).toMatch(/HASH_PEPPER/);
    expect(byId(facts({}, { HASH_PEPPER: "x" }))["hash-pepper"].state).toBe(
      "set",
    );
  });
});

describe("the no-secrets rule (REQ-022 SR-1)", () => {
  it("no value from the environment or the facts reaches a name, a state or a sentence", () => {
    const f = everythingSet();
    const text = rowsToText(launchRows(f));
    // Flags and amounts ("true", "1", "39900") are words a sentence may use;
    // every longer value is a key, an id, a name or an address and must never appear.
    for (const value of Object.values(f.env))
      if (value && value.length >= 6) expect(text).not.toContain(value);
    expect(text).not.toMatch(/MARKER/);
    expect(text).not.toMatch(/readyline\.example/);
    expect(text).not.toMatch(/\b39900\b|\b3900\b/);
    // The same holds for a broken environment: a bad ABN or URL is never echoed.
    const bad = rowsToText(
      launchRows(
        facts(
          {},
          { BUSINESS_ABN: "MARKER-abn", NEXT_PUBLIC_SITE_URL: "MARKER-url" },
        ),
      ),
    );
    expect(bad).not.toMatch(/MARKER/);
  });
});

describe("product/ops/LAUNCH.md (REQ-022 FR-4)", () => {
  it("names every fixed row of the switchboard, and the legal row pattern", () => {
    const md = readFileSync("product/ops/LAUNCH.md", "utf8");
    for (const name of LAUNCH_ROW_NAMES) expect(md, name).toContain(name);
    expect(md).toContain("page updated in the last 90 days");
  });
});

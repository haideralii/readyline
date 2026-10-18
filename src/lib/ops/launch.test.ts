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
    jobs: { purge: null, generate: null, reminders: null, uptime: null },
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
        provider: "smtp",
        dns: { spf: true, dmarc: true },
        domainVerified: true,
        lastTestSendAt: "2026-10-15T01:00:00Z",
      },
      jobs: {
        purge: "2026-10-14T16:00:00Z",
        generate: "2026-10-15T02:30:00Z",
        reminders: "2026-10-14T20:00:00Z",
        uptime: "2026-10-15T02:30:00Z",
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
      // REQ-030 FR-6: the DSN is a value too; the row says set or unset and never echoes it.
      SENTRY_DSN: "https://MARKER-dsn@o0.ingest.sentry.io/0",
      // REQ-022 Session B: the SMTP values, the password above all (SR-1, PO 23:10).
      EMAIL_PROVIDER: "smtp",
      EMAIL_FROM: "MARKER-from@marker.example",
      SMTP_HOST: "MARKER-host",
      SMTP_PORT: "465",
      SMTP_USER: "MARKER-user",
      SMTP_PASS: "MARKER-pass",
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
        uptime: null,
      },
    });
    expect(byId(f)["job-purge"].state).toBe("set");
    expect(byId(f)["job-generate"].state).toBe("mismatched");
    expect(byId(f)["job-reminders"].state).toBe("unset");
  });

  it("REQ-030 FR-6: the uptime row has a 90-minute window and the error-reporting row reads SENTRY_DSN", () => {
    // NOW is 03:00Z; a report at 02:00Z is inside 90 minutes, one at 01:00Z is not.
    const inside = facts({
      jobs: {
        purge: null,
        generate: null,
        reminders: null,
        uptime: "2026-10-15T02:00:00Z",
      },
    });
    expect(byId(inside)["job-uptime"].state).toBe("set");
    const late = facts({
      jobs: {
        purge: null,
        generate: null,
        reminders: null,
        uptime: "2026-10-15T01:00:00Z",
      },
    });
    expect(byId(late)["job-uptime"].state).toBe("mismatched");
    expect(byId(late)["job-uptime"].sentence).toContain("kick workflow");
    expect(byId(facts())["job-uptime"].state).toBe("unset");
    expect(byId(facts())["error-reporting"].state).toBe("unset");
    expect(
      byId(facts({}, { SENTRY_DSN: "https://k@h/1" }))["error-reporting"].state,
    ).toBe("set");
    // No value reaches a sentence (REQ-010 FR-2).
    expect(
      JSON.stringify(launchRows(facts({}, { SENTRY_DSN: "https://k@h/1" }))),
    ).not.toContain("k@h");
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
        provider: "smtp",
        domainVerified: false,
        lastTestSendAt: "2026-10-13T01:00:00Z",
      },
      adminTotpEnrolled: false,
    });
    expect(byId(f)["email-provider"].state).toBe("set");
    // The domain row reads the sender's DNS (D-2824): no EMAIL_FROM in these facts, so not verified here.
    expect(byId(f)["email-domain"].state).toBe("unverified");
    // D-2839: a send five days old is still a send; the row no longer expires.
    expect(byId(f)["email-test-send"].state).toBe("set");
    expect(byId(f)["admin-totp"].state).toBe("unset");
    expect(byId(facts())["email-domain"].state).toBe("unverified");
  });

  it("the sending domain row reads the sender's DNS: unverified without a sender or an answer, mismatched naming the record, set with both (D-2824)", () => {
    const base = {
      provider: "smtp",
      configured: "smtp" as const,
      missing: [],
      domainVerified: null,
      lastTestSendAt: null,
    };
    const from = { EMAIL_FROM: "Readyline <no-reply@readyline.example>" };
    expect(
      byId(facts({ email: { ...base, dns: null } }))["email-domain"].state,
    ).toBe("unverified");
    const noDmarc = byId(
      facts({ email: { ...base, dns: { spf: true, dmarc: false } } }, from),
    )["email-domain"];
    expect(noDmarc.state).toBe("mismatched");
    expect(noDmarc.sentence).toContain("DMARC");
    expect(
      byId(
        facts({ email: { ...base, dns: { spf: true, dmarc: true } } }, from),
      )["email-domain"].state,
    ).toBe("set");
    expect(
      byId(
        facts({ email: { ...base, dns: { spf: null, dmarc: true } } }, from),
      )["email-domain"].state,
    ).toBe("unverified");
  });

  it("the provider row reads mismatched when smtp is named with a value missing (REQ-022 Session B)", () => {
    const row = byId(
      facts({
        email: {
          provider: "log-only",
          configured: "smtp",
          missing: ["SMTP_PASS", "HASH_PEPPER"],
          domainVerified: null,
          lastTestSendAt: null,
        },
      }),
    )["email-provider"];
    expect(row.state).toBe("mismatched");
    expect(row.sentence).toContain("SMTP_PASS, HASH_PEPPER");
    expect(
      byId(
        facts({
          email: {
            provider: "log-only",
            configured: "log",
            missing: [],
            domainVerified: null,
            lastTestSendAt: null,
          },
        }),
      )["email-provider"].state,
    ).toBe("unset");
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

describe("the test-email row (D-2839)", () => {
  it("is set with the send's Sydney day and time once a test email was sent, and never expires", async () => {
    const { launchRows, sydneyDateTime } = await import("./launch");
    const f = facts();
    f.email.lastTestSendAt = "2026-10-01T04:04:00Z";
    f.now = new Date("2026-10-18T00:00:00Z");
    const row = launchRows(f).find((r) => r.id === "email-test-send")!;
    expect(row.state).toBe("set");
    // 1 October 2026 is before Sydney's daylight saving starts (4 October), so 04:04Z is 2:04 pm AEST.
    expect(row.sentence).toBe("Test email sent 1 October 2026 at 2:04 pm.");
    expect(sydneyDateTime("not a date")).toBe("not a date");
  });
});

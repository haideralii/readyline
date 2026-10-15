import { describe, expect, it } from "vitest";
import { EMAIL_MASK, OMITTED, REDACTED, redact, redactString } from "./redact";

/**
 * Token-shaped fixtures are assembled at runtime so no literal secret-shaped
 * string is committed (the secret scanner would flag it, and a copied fixture
 * could be mistaken for a real key). Each helper mirrors a pattern in redact.ts.
 */
const body = (n: number, alphabet = "abcdefghijklmnopqrstuvwxyz0123456789") =>
  Array.from({ length: n }, (_, i) => alphabet[i % alphabet.length]).join("");
const fake = {
  stripeLive: ["sk", "live", body(16)].join("_"),
  stripeTest: ["sk", "test", body(16)].join("_"),
  stripeWebhook: ["whsec", "test", body(16)].join("_"),
  anthropic: ["sk", "ant", "api03", body(16)].join("-"),
  bearer: `Bearer ${body(30)}`,
  aws: "AKIA" + body(16, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  github: "ghp_" + body(30),
  jwt: ["eyJ" + body(20), "eyJ" + body(20), body(26)].join("."),
};

describe("redactString", () => {
  it.each([
    ["contact haider@example.com today", `contact ${EMAIL_MASK} today`],
    [`key ${fake.stripeLive}`, `key ${REDACTED}`],
    [fake.stripeWebhook, REDACTED],
    [fake.anthropic, REDACTED],
    [`Authorization: ${fake.bearer}`, `Authorization: ${REDACTED}`],
    [`aws ${fake.aws}`, `aws ${REDACTED}`],
    [fake.github, REDACTED],
    [`jwt ${fake.jwt}`, `jwt ${REDACTED}`],
  ])("masks %j", (input, expected) => {
    expect(redactString(input)).toBe(expected);
  });

  it("leaves ordinary text alone", () => {
    expect(redactString("Household tasks, 0120, certification")).toBe(
      "Household tasks, 0120, certification",
    );
  });

  it("truncates very long strings", () => {
    const out = redactString("x".repeat(5000));
    expect(out.length).toBeLessThan(2100);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("redact", () => {
  it("replaces sensitive keys whatever the value", () => {
    expect(
      redact({
        password: "hunter2",
        apiKey: "k",
        Authorization: "x",
        cookie: "c",
        sessionId: "s",
        private_key: "p",
      }),
    ).toEqual({
      password: REDACTED,
      apiKey: REDACTED,
      Authorization: REDACTED,
      cookie: REDACTED,
      sessionId: REDACTED,
      private_key: REDACTED,
    });
  });

  it("omits free-text keys that could hold participant details", () => {
    expect(
      redact({
        notes: "Jane Doe fell at 3pm",
        description: "x",
        answers: { q1: "y" },
        code: "P-014",
      }),
    ).toEqual({
      notes: OMITTED,
      description: OMITTED,
      answers: OMITTED,
      code: "P-014",
    });
  });

  // Retro review of REQ-002 (15 Oct 2026, fix 16): the questionnaire's and
  // the account's own free-text keys, nested inside the objects a log line
  // would carry them in, and the suffix rule for keys like incidentNotes.
  it("omits servicesNote, tradingName and note-like suffixes inside nested objects", () => {
    expect(
      redact({
        supports: { servicesNote: "x", groups: ["0120"] },
        business: { tradingName: "Jane Doe Care", structure: "sole-trader" },
        owner: { name: "Jane Doe", role: "Director" },
        incident: { incidentNotes: "fell at 3pm", errorMessage: "boom" },
        context: { hostname: "app", fileName: "a.docx", accountId: "a1" },
      }),
    ).toEqual({
      supports: { servicesNote: OMITTED, groups: ["0120"] },
      business: { tradingName: OMITTED, structure: "sole-trader" },
      owner: { name: OMITTED, role: "Director" },
      incident: { incidentNotes: OMITTED, errorMessage: OMITTED },
      context: { hostname: "app", fileName: "a.docx", accountId: "a1" },
    });
  });

  it("masks emails and tokens inside nested values and arrays", () => {
    expect(
      redact({
        user: { email: "a@b.co", tags: ["ok", fake.stripeTest] },
      }),
    ).toEqual({
      user: { email: EMAIL_MASK, tags: ["ok", REDACTED] },
    });
  });

  it("turns errors into name and redacted message without a stack", () => {
    const out = redact(new Error("failed for a@b.co")) as Record<
      string,
      unknown
    >;
    expect(out).toEqual({ name: "Error", message: `failed for ${EMAIL_MASK}` });
    expect(out).not.toHaveProperty("stack");
  });

  it("does not mutate the input", () => {
    const input = { password: "p", list: ["a@b.co"] };
    redact(input);
    expect(input).toEqual({ password: "p", list: ["a@b.co"] });
  });

  it("keeps numbers, booleans, null and dates", () => {
    const d = new Date("2026-10-11T00:00:00Z");
    expect(redact({ n: 1, b: true, z: null, d })).toEqual({
      n: 1,
      b: true,
      z: null,
      d: d.toISOString(),
    });
  });

  it("stops at the depth limit instead of recursing forever", () => {
    type Nested = { child?: Nested };
    const root: Nested = {};
    let cur = root;
    for (let i = 0; i < 20; i++) {
      cur.child = {};
      cur = cur.child;
    }
    expect(JSON.stringify(redact(root))).toContain("[depth limit]");
  });
});

import { describe, expect, it } from "vitest";
import { EMAIL_MASK, OMITTED, REDACTED, redact, redactString } from "./redact";

describe("redactString", () => {
  it.each([
    ["contact haider@example.com today", `contact ${EMAIL_MASK} today`],
    ["key sk_live_abcdefghijklmnop", `key ${REDACTED}`],
    ["whsec_test_1234567890abcdef", REDACTED],
    ["sk-ant-api03-abcdefghijklmnop", REDACTED],
    [
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123",
      `Authorization: ${REDACTED}`,
    ],
    ["aws AKIAABCDEFGHIJKLMNOP", `aws ${REDACTED}`],
    ["ghp_abcdefghijklmnopqrstuvwxyz1234", REDACTED],
    [
      "jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuvwxyz",
      `jwt ${REDACTED}`,
    ],
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

  it("masks emails and tokens inside nested values and arrays", () => {
    expect(
      redact({
        user: { email: "a@b.co", tags: ["ok", "sk_test_abcdefghijklmnop"] },
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

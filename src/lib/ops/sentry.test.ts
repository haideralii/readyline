import { describe, expect, it } from "vitest";
import { redactUrl, scrubEvent, sentryEnabled, sentryOptions } from "./sentry";

/**
 * REQ-030 FR-1, AC-1 and AC-2 (D-2865, D-2875): no DSN, no options and
 * nothing initialised; with a fixture DSN the options carry the environment
 * and the sha, no tracing, no PII; `beforeSend` leaves the markers and
 * nothing else of an address, a key or a free-text field.
 */
describe("sentryOptions (REQ-030 FR-1)", () => {
  it("AC-1: unset or blank SENTRY_DSN is off, with no options to initialise", () => {
    expect(sentryEnabled({})).toBe(false);
    expect(sentryEnabled({ SENTRY_DSN: "  " })).toBe(false);
    expect(sentryOptions({})).toBeNull();
    expect(sentryOptions({ SENTRY_DSN: "" })).toBeNull();
  });

  it("carries the fixture DSN, VERCEL_ENV, the sha, full sampling of errors, no tracing and no PII", () => {
    const o = sentryOptions({
      SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
    });
    expect(o).toMatchObject({
      dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
      environment: "preview",
      release: "0123456789abcdef0123456789abcdef01234567",
      sampleRate: 1,
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
    expect(o?.beforeSend).toBe(scrubEvent);
    expect(sentryOptions({ SENTRY_DSN: "https://k@h/1" })?.environment).toBe(
      "development",
    );
  });
});

describe("scrubEvent (REQ-030 AC-2, SR-1)", () => {
  const event = {
    message: "Mail to test@example.com failed with sk_test_abcdefghij12345678",
    exception: {
      values: [
        {
          type: "Error",
          value: "token sk_test_abcdefghij12345678 for test@example.com",
        },
      ],
    },
    breadcrumbs: [
      {
        category: "http",
        message: "GET /registers for test@example.com",
        data: { note: "Jane fell in the kitchen", status: 500 },
      },
    ],
    request: {
      url: "https://readyline.example/registers/incidents/8f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f?token=abc",
      method: "GET",
      headers: {
        cookie: "sb-access-token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
        authorization: "Bearer abcdefghijklmnopqrstuvwxyz",
        "user-agent": "Mozilla/5.0",
        "content-type": "application/json",
      },
      cookies: { sb: "x" },
      data: { note: "free text" },
      query_string: "token=abc",
    },
    user: { id: "u1", email: "test@example.com", ip_address: "1.2.3.4" },
    extra: {
      note: "A participant's note",
      accountId: "acc-1",
      email: "test@example.com",
    },
    tags: { errorId: "abc123" },
  };

  it("masks the address and the key, omits the free-text field, strips user, cookies, body and query, and keeps the tag", () => {
    const out = scrubEvent(event);
    const text = JSON.stringify(out);
    expect(text).not.toContain("test@example.com");
    expect(text).not.toContain("sk_test_");
    expect(text).not.toContain("eyJ");
    expect(text).not.toContain("Jane fell");
    expect(text).not.toContain("participant");
    expect(text).not.toContain("token=abc");
    expect(text).not.toContain("1.2.3.4");
    expect(out.message).toBe("Mail to [email] failed with [redacted]");
    expect(out.exception?.values?.[0].value).toBe(
      "token [redacted] for [email]",
    );
    expect(out.breadcrumbs?.[0].data).toEqual({
      note: "[free-text omitted]",
      status: 500,
    });
    expect(out.extra).toEqual({
      note: "[free-text omitted]",
      accountId: "acc-1",
      email: "[email]",
    });
    expect(out.user).toBeUndefined();
    expect(out.request).toEqual({
      method: "GET",
      url: "https://readyline.example/registers/incidents/[redacted]",
      headers: {
        "user-agent": "Mozilla/5.0",
        "content-type": "application/json",
      },
    });
    expect(out.tags).toEqual({ errorId: "abc123" });
    // Never mutates the input.
    expect(event.user).toBeDefined();
    expect(event.message).toContain("test@example.com");
  });

  it("redacts path segments that are not plain words and drops the query", () => {
    expect(
      redactUrl(
        "https://a.example/auditor/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef?x=1",
      ),
    ).toBe("https://a.example/auditor/[redacted]");
    expect(
      redactUrl("/documents/8f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f/finish"),
    ).toBe("/documents/[redacted]/finish");
    expect(redactUrl("/path/audit-day")).toBe("/path/audit-day");
    expect(redactUrl("/email/unsubscribe/not-a-real-token")).toBe(
      "/email/unsubscribe/not-a-real-token",
    );
    expect(redactUrl("::not a url::")).toBe("/[redacted]");
  });
});

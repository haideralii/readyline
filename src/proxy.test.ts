import { afterEach, describe, expect, it } from "vitest";
import {
  buildCsp,
  isPurchaseRoute,
  supabaseOriginFromEnv,
  needsSessionRedirect,
} from "./proxy";

const ORIGINAL = process.env.NEXT_PUBLIC_SUPABASE_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL;
});

describe("buildCsp connect-src (REQ-004 SR-2)", () => {
  it("stays 'self' only when Supabase is not configured", () => {
    const csp = buildCsp("abc", false, null);
    expect(csp).toContain("connect-src 'self';");
    expect(csp).not.toContain("supabase");
  });

  it("adds exactly the Supabase project origin, nothing wider", () => {
    const csp = buildCsp(
      "abc",
      false,
      "https://dpwwzhylcyosnkmlcnnp.supabase.co",
    );
    expect(csp).toContain(
      "connect-src 'self' https://dpwwzhylcyosnkmlcnnp.supabase.co;",
    );
    expect(csp).not.toContain("*.supabase.co");
  });

  it("keeps the websocket allowance for development after the origin", () => {
    const csp = buildCsp("abc", true, "http://127.0.0.1:54321");
    expect(csp).toContain(
      "connect-src 'self' http://127.0.0.1:54321 ws: wss:;",
    );
  });
});

describe("buildCsp form-action on purchase routes (REQ-007 SR-5, D-710)", () => {
  it("allows Stripe's hosted Checkout as a form destination only on purchase routes", () => {
    expect(buildCsp("abc", false, null)).toContain("form-action 'self';");
    expect(buildCsp("abc", false, null, { purchaseRoute: true })).toContain(
      "form-action 'self' https://checkout.stripe.com;",
    );
  });

  it("adds no Stripe host anywhere else in the policy", () => {
    const csp = buildCsp("abc", false, null, { purchaseRoute: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic';");
    expect(csp).toContain("connect-src 'self';");
    expect(csp).not.toContain("frame-src");
    expect(csp.match(/stripe/g)?.length).toBe(1);
  });

  it("names the pricing and documents pages exactly, not their subpaths", () => {
    expect(isPurchaseRoute("/pricing")).toBe(true);
    expect(isPurchaseRoute("/documents")).toBe(true);
    expect(isPurchaseRoute("/documents/abc")).toBe(false);
    expect(isPurchaseRoute("/")).toBe(false);
    expect(isPurchaseRoute("/start/result")).toBe(false);
  });
});

describe("supabaseOriginFromEnv", () => {
  it("returns the origin only, dropping any path", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://example.supabase.co/rest/v1";
    expect(supabaseOriginFromEnv()).toBe("https://example.supabase.co");
  });

  it("returns null when unset or malformed", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(supabaseOriginFromEnv()).toBeNull();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not a url";
    expect(supabaseOriginFromEnv()).toBeNull();
  });
});

describe("needsSessionRedirect (batch 47 item 7)", () => {
  it("sends a visitor without a Supabase session cookie to sign-in for the documents and checklist routes only", () => {
    expect(needsSessionRedirect("/documents", [])).toBe(
      "/sign-in?next=%2Fdocuments",
    );
    expect(needsSessionRedirect("/documents/abc/finish", ["other"])).toBe(
      "/sign-in?next=%2Fdocuments%2Fabc%2Ffinish",
    );
    expect(needsSessionRedirect("/checklist", [])).toBe(
      "/sign-in?next=%2Fchecklist",
    );
    expect(needsSessionRedirect("/documentsx", [])).toBeNull();
    expect(needsSessionRedirect("/pricing", [])).toBeNull();
    expect(needsSessionRedirect("/", [])).toBeNull();
  });

  it("lets a request with a session cookie through, chunked or not, and leaves the page to verify it", () => {
    expect(
      needsSessionRedirect("/documents", ["sb-abc-auth-token"]),
    ).toBeNull();
    expect(
      needsSessionRedirect("/checklist", [
        "sb-abc-auth-token.0",
        "sb-abc-auth-token.1",
      ]),
    ).toBeNull();
    expect(needsSessionRedirect("/documents", ["sb-abc-code-verifier"])).toBe(
      "/sign-in?next=%2Fdocuments",
    );
  });

  it("leaves a download route to its own handler, which refuses a bad file name before any redirect (batch 48 item 3)", () => {
    expect(needsSessionRedirect("/documents/abc/download", [])).toBeNull();
    expect(needsSessionRedirect("/documents/abc/download/more", [])).toBeNull();
    expect(needsSessionRedirect("/documents/abc", [])).toBe(
      "/sign-in?next=%2Fdocuments%2Fabc",
    );
  });
});

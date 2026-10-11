import { afterEach, describe, expect, it } from "vitest";
import { buildCsp, supabaseOriginFromEnv } from "./proxy";

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

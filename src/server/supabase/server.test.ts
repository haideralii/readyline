// @vitest-environment node
/**
 * REQ-012 Session B, ASVS re-verification row 4 (V3 session): every session
 * cookie the server client writes is HttpOnly and SameSite=Lax, and Secure
 * exactly when the site URL is https (D-2344: production is, CI's
 * http://localhost is not, where WebKit would drop a Secure cookie). The
 * Supabase SSR client and Next's cookie store are stubbed so the options the
 * adapter adds are what is asserted, whatever Supabase itself passes in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type SetCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};
const setCalls: SetCall[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [{ name: "sb-test-auth-token", value: "x" }],
    set: (name: string, value: string, options: Record<string, unknown>) => {
      setCalls.push({ name, value, options });
    },
  }),
}));

let captured: {
  cookies: {
    getAll: () => unknown;
    setAll: (
      c: { name: string; value: string; options: Record<string, unknown> }[],
    ) => void;
  };
} | null = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: typeof captured,
  ) => {
    captured = options;
    return { from: () => ({}) };
  },
}));

vi.mock("./env", () => ({
  readSupabaseEnv: () => ({
    url: "https://example.supabase.co",
    publishableKey: "sb_publishable_fixture",
  }),
}));

const { createSupabaseServerClient } = await import("./server");

async function cookieOptions(siteUrl: string) {
  setCalls.length = 0;
  captured = null;
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  await createSupabaseServerClient();
  captured!.cookies.setAll([
    {
      name: "sb-test-auth-token",
      value: "token",
      options: { path: "/", maxAge: 3600, sameSite: "none", secure: false },
    },
  ]);
  return setCalls;
}

afterEach(() => vi.unstubAllEnvs());

describe("the session cookie flags (ASVS row 4; V3; D-2344)", () => {
  it("every cookie the client writes is HttpOnly, SameSite=Lax and Secure on an https site, whatever Supabase asked for", async () => {
    const calls = await cookieOptions("https://readyline.example");
    expect(calls).toHaveLength(1);
    expect(calls[0].options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 3600,
    });
  });

  it("Secure follows the site URL's scheme: off on http://localhost, so CI's WebKit keeps the cookie", async () => {
    const calls = await cookieOptions("http://localhost:3000");
    expect(calls[0].options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
  });

  it("reads the store's cookies back unchanged", async () => {
    await cookieOptions("https://readyline.example");
    expect(captured!.cookies.getAll()).toEqual([
      { name: "sb-test-auth-token", value: "x" },
    ]);
  });
});

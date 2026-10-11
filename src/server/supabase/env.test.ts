import { describe, expect, it } from "vitest";
import {
  SupabaseEnvError,
  hasSupabaseEnv,
  readSupabaseAdminEnv,
  readSupabaseEnv,
} from "./env";

const full = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SUPABASE_SECRET_KEY: "sb_secret_example",
};

describe("readSupabaseEnv", () => {
  it("returns the public settings", () => {
    expect(readSupabaseEnv(full)).toEqual({
      url: full.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: full.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      secretKey: full.SUPABASE_SECRET_KEY,
    });
  });

  it("names every missing public variable", () => {
    expect(() => readSupabaseEnv({})).toThrow(SupabaseEnvError);
    expect(() => readSupabaseEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing/,
    );
  });

  it("treats blank values as missing", () => {
    expect(() =>
      readSupabaseEnv({ ...full, NEXT_PUBLIC_SUPABASE_URL: " " }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL is missing/);
  });
});

describe("readSupabaseAdminEnv", () => {
  it("requires the secret key", () => {
    const { SUPABASE_SECRET_KEY: _omit, ...noSecret } = full;
    void _omit;
    expect(() => readSupabaseAdminEnv(noSecret)).toThrow(
      /SUPABASE_SECRET_KEY is missing/,
    );
  });

  it("returns all three when present", () => {
    expect(readSupabaseAdminEnv(full).secretKey).toBe("sb_secret_example");
  });
});

describe("hasSupabaseEnv", () => {
  it("is true only when all three are set", () => {
    expect(hasSupabaseEnv(full)).toBe(true);
    expect(hasSupabaseEnv({ ...full, SUPABASE_SECRET_KEY: "" })).toBe(false);
    expect(hasSupabaseEnv({})).toBe(false);
  });
});

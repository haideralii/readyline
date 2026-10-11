import { describe, expect, it } from "vitest";
import { EnvError, REQUIRED, assertEnv, validateEnv } from "./env";

const good = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

describe("validateEnv", () => {
  it("accepts a complete environment and applies defaults", () => {
    const r = validateEnv(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.env.NEXT_PUBLIC_BRAND_NAME).toBe("{{BRAND}}");
  });

  it("names every missing required variable and where it lives in production (AC-4)", () => {
    const r = validateEnv({ NODE_ENV: "production" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      for (const v of REQUIRED) {
        expect(
          r.problems.some(
            (p) =>
              p.startsWith(`${v.name} is missing`) &&
              p.includes(v.productionHome),
          ),
        ).toBe(true);
      }
    }
  });

  it("treats an empty string as missing", () => {
    const r = validateEnv({ ...good, NEXT_PUBLIC_SITE_URL: "   " });
    expect(r.ok).toBe(false);
  });

  it("rejects a malformed value with the variable name", () => {
    const r = validateEnv({ ...good, NEXT_PUBLIC_SITE_URL: "not a url" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0]).toMatch(/^NEXT_PUBLIC_SITE_URL:/);
  });
});

describe("assertEnv", () => {
  it("throws an EnvError whose message names the variable", () => {
    expect(() => assertEnv({})).toThrow(EnvError);
    expect(() => assertEnv({})).toThrow(/NEXT_PUBLIC_SITE_URL is missing/);
  });

  it("returns the parsed env when valid", () => {
    expect(assertEnv(good).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });
});

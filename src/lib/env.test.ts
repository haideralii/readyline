import { describe, expect, it } from "vitest";
import {
  EnvError,
  PRODUCTION_REQUIRED,
  REQUIRED_LATER,
  REQUIRED,
  assertEnv,
  isProductionDeployment,
  readHashPepper,
  validateEnv,
} from "./env";

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

describe("validateEnv for the production deployment (REQ-010 FR-2, AC-2)", () => {
  it("requires every production variable and names each missing one", () => {
    const r = validateEnv(good, { production: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      for (const v of PRODUCTION_REQUIRED.filter((x) => !(x.name in good)))
        expect(
          r.problems.some((p) => p.startsWith(`${v.name} is missing`)),
          v.name,
        ).toBe(true);
    }
    const full = Object.fromEntries(
      PRODUCTION_REQUIRED.map((v) => [v.name, "set"]),
    );
    expect(
      validateEnv(
        { ...full, NEXT_PUBLIC_SITE_URL: "https://readyline.example" },
        { production: true },
      ).ok,
    ).toBe(true);
  });

  it("recognises the Vercel production deployment only", () => {
    expect(isProductionDeployment({ VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionDeployment({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isProductionDeployment({ NODE_ENV: "production" })).toBe(false);
    expect(isProductionDeployment({})).toBe(false);
  });

  it("reads HASH_PEPPER when set and answers null otherwise; no deployment refuses to start over it (retro finding 34, D-2238)", () => {
    expect(PRODUCTION_REQUIRED.map((v) => v.name)).not.toContain("HASH_PEPPER");
    expect(REQUIRED_LATER.map((v) => v.name)).toContain("HASH_PEPPER");
    expect(readHashPepper({ HASH_PEPPER: " k " })).toBe("k");
    expect(readHashPepper({})).toBeNull();
    expect(
      readHashPepper({ HASH_PEPPER: "  ", VERCEL_ENV: "preview" }),
    ).toBeNull();
    expect(readHashPepper({ VERCEL_ENV: "production" })).toBeNull();
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

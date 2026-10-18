// @vitest-environment node
/**
 * REQ-012 FR-1e: the per-instance limiters (D-424; a fixed window in memory,
 * one counter per serverless instance) at their own numbers: the public
 * questionnaire action at 120 a minute, the health route at 60 a minute, the
 * sample document at 30 a minute. Hit n-1 and hit n pass, hit n+1 is
 * refused, a fresh window starts again. The numbers are pinned to the
 * source, so a change to a limit is a change here too.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HEALTH_LIMIT, MemoryRateLimiter } from "./health";

const PER_INSTANCE = [
  {
    name: "questionnaire derivation",
    file: "src/app/start/actions.ts",
    pin: "const DERIVE_LIMIT = { limit: 120, windowMs: 60_000 } as const;",
    limit: 120,
    windowMs: 60_000,
  },
  {
    name: "health route",
    file: "src/lib/ops/health.ts",
    pin: "export const HEALTH_LIMIT = { limit: 60, windowMs: 60_000 } as const;",
    limit: 60,
    windowMs: 60_000,
  },
  {
    name: "sample document",
    file: "src/app/sample/complaints-policy.docx/route.ts",
    pin: "const limiter = new MemoryRateLimiter(30, 60_000);",
    limit: 30,
    windowMs: 60_000,
  },
] as const;

describe("the per-instance limiters (REQ-012 FR-1e; D-424)", () => {
  it("the health constant is the one the table says", () => {
    expect(HEALTH_LIMIT).toEqual({ limit: 60, windowMs: 60_000 });
  });

  for (const l of PER_INSTANCE) {
    it(`${l.name}: ${l.limit} a minute is pinned in ${l.file}`, () => {
      expect(readFileSync(l.file, "utf8")).toContain(l.pin);
    });

    it(`${l.name}: hit ${l.limit} allowed, hit ${l.limit + 1} refused, a new window allows again`, () => {
      const limiter = new MemoryRateLimiter(l.limit, l.windowMs);
      const key = "203.0.113.7";
      for (let i = 1; i <= l.limit; i++)
        expect(limiter.allow(key, 1_000 + i), `hit ${i}`).toBe(true);
      expect(limiter.allow(key, 1_000 + l.limit + 1)).toBe(false);
      expect(limiter.allow(key, 1_000 + l.limit + 2)).toBe(false);
      // Another address is its own counter.
      expect(limiter.allow("198.51.100.9", 1_000 + l.limit + 3)).toBe(true);
      // The window started at the first hit; after it, the counter starts over.
      expect(limiter.allow(key, 1_000 + 1 + l.windowMs)).toBe(true);
    });
  }
});

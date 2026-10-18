import { describe, expect, it } from "vitest";
import { healthBody, MemoryRateLimiter } from "./health";

describe("health body (REQ-010 FR-4)", () => {
  it("carries the version with the short SHA, the region and the deployment kind, nothing else", () => {
    const body = healthBody(
      {
        VERCEL_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
        VERCEL_REGION: "syd1",
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://readyline.example/",
        SUPABASE_SECRET_KEY: "never-shown",
      },
      "0.1.0",
    );
    expect(body).toEqual({
      ok: true,
      version: "0.1.0+0123456789ab",
      sha: "0123456789ab",
      region: "syd1",
      deployment: "production",
      // REQ-022 FR-9: the origin without its trailing slash.
      siteUrl: "https://readyline.example",
    });
    expect(JSON.stringify(body)).not.toContain("never-shown");
  });

  it("answers for a local run too", () => {
    expect(healthBody({}, "0.1.0")).toEqual({
      ok: true,
      version: "0.1.0+local",
      sha: "local",
      region: "local",
      deployment: "development",
      siteUrl: "http://localhost:3000",
    });
  });
});

describe("MemoryRateLimiter", () => {
  it("allows the limit within a window, refuses beyond it, and resets after the window", () => {
    const limiter = new MemoryRateLimiter(3, 1000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(true);
    expect(limiter.allow("a", 2)).toBe(true);
    expect(limiter.allow("a", 3)).toBe(false);
    expect(limiter.allow("b", 3)).toBe(true);
    expect(limiter.allow("a", 1001)).toBe(true);
  });
});

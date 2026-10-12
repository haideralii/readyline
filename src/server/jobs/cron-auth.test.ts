import { describe, expect, it } from "vitest";
import { isAuthorisedCronRequest, mayRunScheduledJobs } from "./cron-auth";

// Assembled at runtime so no secret-shaped literal is committed (gitleaks).
const secret = Array.from(
  { length: 32 },
  (_, i) => "0123456789abcdef"[i % 16],
).join("");

describe("isAuthorisedCronRequest", () => {
  it("accepts only the exact bearer token", () => {
    expect(isAuthorisedCronRequest(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorisedCronRequest(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorisedCronRequest(`bearer ${secret}`, secret)).toBe(false);
    expect(isAuthorisedCronRequest(secret, secret)).toBe(false);
    expect(isAuthorisedCronRequest(null, secret)).toBe(false);
  });

  it("authorises nobody when the secret is unset or too short", () => {
    expect(isAuthorisedCronRequest("Bearer x", undefined)).toBe(false);
    expect(isAuthorisedCronRequest("Bearer short", "short")).toBe(false);
  });
});

describe("mayRunScheduledJobs (REQ-010 FR-6)", () => {
  it("runs locally and in CI, on Vercel production, and never on a Vercel preview", () => {
    expect(mayRunScheduledJobs({})).toBe(true);
    expect(mayRunScheduledJobs({ CI: "true" })).toBe(true);
    expect(mayRunScheduledJobs({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(
      true,
    );
    expect(mayRunScheduledJobs({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(
      false,
    );
    expect(mayRunScheduledJobs({ VERCEL: "1" })).toBe(false);
  });
});

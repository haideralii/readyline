import { describe, expect, it } from "vitest";
import { isAuthorisedCronRequest } from "./cron-auth";

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

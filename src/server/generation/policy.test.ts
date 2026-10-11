import { describe, expect, it } from "vitest";
import { decideGeneration, isGenerationEnabled } from "./policy";

describe("generation policy (REQ-005 FR-9, AC-8, AC-10)", () => {
  it("is off unless GENERATION_ENABLED is exactly true", () => {
    expect(isGenerationEnabled({})).toBe(false);
    expect(isGenerationEnabled({ GENERATION_ENABLED: "1" })).toBe(false);
    expect(isGenerationEnabled({ GENERATION_ENABLED: "false" })).toBe(false);
    expect(isGenerationEnabled({ GENERATION_ENABLED: "TRUE " })).toBe(true);
  });

  it("refuses with a plain message when disabled, deleted, without an account or over quota", () => {
    const base = {
      enabled: true,
      hasAccount: true,
      deleted: false,
      withinQuota: true,
    };
    expect(decideGeneration({ ...base, enabled: false })).toMatchObject({
      allowed: false,
      reason: "disabled",
    });
    expect(decideGeneration({ ...base, deleted: true })).toMatchObject({
      allowed: false,
      reason: "deleted",
    });
    expect(decideGeneration({ ...base, hasAccount: false })).toMatchObject({
      allowed: false,
      reason: "no-account",
    });
    const quota = decideGeneration({ ...base, withinQuota: false });
    expect(quota).toMatchObject({ allowed: false, reason: "quota" });
    if (!quota.allowed) expect(quota.message).toMatch(/limit resets/);
    expect(decideGeneration(base)).toEqual({ allowed: true });
  });
});

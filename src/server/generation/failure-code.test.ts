// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GENERATION_FAILURE_CODES,
  generationFailureCode,
  reasonForCi,
} from "./failure-code";

describe("generationFailureCode (after-window item 9)", () => {
  it("maps every loadContext reason to its code and the two job branches to theirs", () => {
    expect(generationFailureCode("entitlement read: boom", "context")).toBe(
      "entitlement-read",
    );
    expect(generationFailureCode("entitlement missing", "context")).toBe(
      "entitlement-missing",
    );
    expect(generationFailureCode("account missing", "context")).toBe(
      "account-missing",
    );
    expect(generationFailureCode("account deleted", "context")).toBe(
      "account-deleted",
    );
    expect(generationFailureCode("owner missing", "context")).toBe(
      "owner-missing",
    );
    expect(
      generationFailureCode("questionnaire draft missing", "context"),
    ).toBe("questionnaire-missing");
    expect(generationFailureCode("questionnaire incomplete", "context")).toBe(
      "questionnaire-incomplete",
    );
    expect(generationFailureCode("anything else", "context")).toBe("other");
    expect(generationFailureCode("no groups", "build")).toBe("build-failed");
    expect(generationFailureCode("TypeError: x", "attempts")).toBe(
      "attempts-exhausted",
    );
    expect(GENERATION_FAILURE_CODES).toContain("other");
  });

  it("logs the raw reason in CI alone, never on a Vercel deployment", () => {
    expect(reasonForCi({ CI: "true" })).toBe(true);
    expect(
      reasonForCi({
        CI: "true",
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
    expect(reasonForCi({ CI: "true", VERCEL_ENV: "preview" })).toBe(false);
    expect(reasonForCi({})).toBe(false);
  });
});

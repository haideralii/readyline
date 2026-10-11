import { describe, expect, it } from "vitest";
import {
  assertNoProhibitedClaims,
  findProhibitedClaims,
  isBrandNameAllowed,
} from "./claims";
import { AI_DISCLOSURE, BRAND, GENERAL_INFORMATION_NOTICE } from "./brand";

describe("findProhibitedClaims", () => {
  it.each([
    ["Guaranteed registration or your money back", "guaranteed-outcome"],
    ["We guarantee your approval", "guaranteed-outcome"],
    ["Our audit-proof policy pack", "audit-proof"],
    ["Audit proof templates", "audit-proof"],
    ["100% pass rate with auditors", "pass-rate"],
    ["Templates approved by auditors", "approved-by-authority"],
    ["Approved by the NDIS Commission", "approved-by-authority"],
    ["NDIS approved documents", "ndis-affiliation"],
    ["NDIS-certified policy set", "ndis-affiliation"],
    ["The official NDIS registration toolkit", "official-ndis"],
    ["I heart NDIS", "i-heart-ndis"],
    ["We are a registered provider", "self-described-registered-provider"],
    [
      "{{BRAND}} is an NDIS registered provider",
      "self-described-registered-provider",
    ],
  ])("flags %j as %s", (text, rule) => {
    const findings = findProhibitedClaims(text);
    expect(findings.map((f) => f.rule)).toContain(rule);
  });

  it.each([
    "Documents aligned to the NDIS Practice Standards, prepared for your review.",
    "How to become a registered NDIS provider in 2026",
    "What does an NDIS registration audit cost?",
    "Verification audit vs certification audit: which applies to you?",
    "Not affiliated with the NDIS Quality and Safeguards Commission.",
    "Your auditor decides the outcome; we help you prepare.",
  ])("allows descriptive wording: %j", (text) => {
    expect(findProhibitedClaims(text)).toEqual([]);
  });

  it("returns findings in document order with offsets", () => {
    const text = "NDIS approved. Also audit-proof.";
    const findings = findProhibitedClaims(text);
    expect(findings.map((f) => f.rule)).toEqual([
      "ndis-affiliation",
      "audit-proof",
    ]);
    expect(findings[0].index).toBe(0);
    expect(findings[1].index).toBe(text.indexOf("audit-proof"));
  });
});

describe("assertNoProhibitedClaims", () => {
  it("throws a readable error listing each finding", () => {
    expect(() =>
      assertNoProhibitedClaims("Guaranteed registration. Audit-proof.", "copy"),
    ).toThrow(/copy contains 2 prohibited claim\(s\)/);
  });

  it("does not throw for clean text", () => {
    expect(() =>
      assertNoProhibitedClaims("Prepared for your review."),
    ).not.toThrow();
  });
});

describe("brand and site notices", () => {
  it("uses the placeholder until a name is chosen", () => {
    expect(BRAND).toBe("{{BRAND}}");
  });

  it("general information notice says what it must and nothing prohibited", () => {
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/general information/i);
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/not legal advice/i);
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/seek legal advice/i);
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/not affiliated/i);
    expect(findProhibitedClaims(GENERAL_INFORMATION_NOTICE)).toEqual([]);
  });

  it("AI disclosure names AI and the provider's responsibility", () => {
    expect(AI_DISCLOSURE).toMatch(/\bAI\b/);
    expect(AI_DISCLOSURE).toMatch(/responsible for reviewing/i);
    expect(findProhibitedClaims(AI_DISCLOSURE)).toEqual([]);
  });
});

describe("isBrandNameAllowed", () => {
  it.each(["{{BRAND}}", "Readiness Desk", "Provider Prep"])(
    "allows %j",
    (name) => expect(isBrandNameAllowed(name)).toBe(true),
  );

  it.each(["NDISReady", "my-ndis-docs", "Ndis Helper"])(
    "rejects %j because it contains the NDIS mark",
    (name) => expect(isBrandNameAllowed(name)).toBe(false),
  );
});

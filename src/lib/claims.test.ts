import { describe, expect, it } from "vitest";
import {
  assertNoProhibitedClaims,
  findProhibitedClaims,
  isBrandNameAllowed,
} from "./claims";
import {
  AI_DISCLOSURE,
  BRAND,
  GENERAL_INFORMATION_NOTICE,
  GENERAL_INFORMATION_STATEMENT,
  INDEPENDENCE_STATEMENT,
} from "./brand";

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
      "Readyline is an NDIS registered provider",
      "self-described-registered-provider",
    ],
    // REQ-012 FR-4a (D-2905, D-2906): promises and comparisons.
    ["With Readyline you will be fully compliant", "compliant-promise"],
    ["Our pack keeps you compliant with the standards", "compliant-promise"],
    ["Certified documents for your audit", "certified-claim"],
    ["Readyline certifies your policies", "certified-claim"],
    ["The subscription keeps you audit-ready", "audit-ready-promise"],
    ["Audit-ready in 10 minutes", "audit-ready-promise"],
    ["Our checklist ensures you pass", "ensures-you"],
    ["With these policies you will pass the audit", "will-pass"],
    ["Ready to register in a week", "ready-to-register"],
    ["A free pack for every new provider", "free-with-fee"],
    ["Start your free trial today", "free-with-fee"],
    ["Free for $0 a month", "free-with-fee"],
    ["Cheaper than a consultant", "comparative"],
    ["The cheapest way to register", "comparative"],
    ["The only tool built for small providers", "comparative"],
    ["Australia's leading registration tool", "comparative"],
    ["Unlike other providers, we read the Rules", "comparative"],
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
    // REQ-012 FR-4a: the descriptive sentence each D-2905 and D-2906 rule must let through.
    "A compliant provider is one the Commission has found to meet the standards.",
    "Certified providers have a mid-term audit about 18 months in.",
    "The certification audit includes a site visit.",
    "The registers and the reminders are what an auditor asks for.",
    "Using Readyline does not mean you will pass an audit or be registered.",
    "You register through the Commission's portal.",
    "The questionnaire is free. The document pack is one fixed price.",
    "The verification audit is the quicker of the two.",
    // D-2942: a comparison between the two audit kinds, with its reason.
    "Usually the quicker audit, and usually the cheaper one, because there is no site visit.",
    "I am the only worker and the only key personnel.",
    "The leading cause of a finding is a missing register.",
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
  it("defaults to Readyline when no override is set", () => {
    expect(BRAND).toBe("Readyline");
  });

  it("general information notice says what it must and nothing prohibited", () => {
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/general information/i);
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/not legal advice/i);
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/seek legal advice/i);
    expect(GENERAL_INFORMATION_NOTICE).toMatch(/not affiliated/i);
    expect(findProhibitedClaims(GENERAL_INFORMATION_NOTICE)).toEqual([]);
    // The footer shows the statement without the independence sentence (its trust line says it once).
    expect(GENERAL_INFORMATION_STATEMENT).toMatch(/general information/i);
    expect(GENERAL_INFORMATION_STATEMENT).toMatch(/not legal advice/i);
    expect(GENERAL_INFORMATION_STATEMENT).toMatch(/seek legal advice/i);
    expect(GENERAL_INFORMATION_STATEMENT).not.toMatch(
      /affiliated|independent/i,
    );
    expect(INDEPENDENCE_STATEMENT).toMatch(/not affiliated/i);
    expect(GENERAL_INFORMATION_NOTICE).toBe(
      `${GENERAL_INFORMATION_STATEMENT} ${INDEPENDENCE_STATEMENT}`,
    );
  });

  it("AI disclosure names AI and the provider's responsibility", () => {
    expect(AI_DISCLOSURE).toMatch(/\bAI\b/);
    expect(AI_DISCLOSURE).toMatch(/responsible for reviewing/i);
    expect(findProhibitedClaims(AI_DISCLOSURE)).toEqual([]);
  });
});

describe("isBrandNameAllowed", () => {
  it.each(["Readyline", "Readiness Desk", "Provider Prep"])(
    "allows %j",
    (name) => expect(isBrandNameAllowed(name)).toBe(true),
  );

  it.each(["NDISReady", "my-ndis-docs", "Ndis Helper"])(
    "rejects %j because it contains the NDIS mark",
    (name) => expect(isBrandNameAllowed(name)).toBe(false),
  );
});

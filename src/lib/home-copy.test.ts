import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { readinessCounts } from "@/lib/questionnaire/readiness";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { HOME_COPY, heroHeadline, homeStrings } from "./home-copy";

describe("home page copy (REQ-013 FR-8; CLAUDE.md 4.3)", () => {
  it("passes the prohibited-claims lint and names no superlative or testimonial", () => {
    for (const s of homeStrings())
      expect(findProhibitedClaims(s), s).toEqual([]);
    const all = homeStrings().join("\n");
    expect(all).not.toMatch(
      /market[- ]leading|best|#1|number one|trusted by|customers say|testimonial|guarantee/i,
    );
    expect(all).not.toMatch(/is being built/);
  });

  it("hero (batch 24 item 1): the audit question, the configured price, the deal and the refund promise", () => {
    expect(heroHeadline("AUD 399")).toBe(
      "Find out which NDIS audit you'll face — free. Then get every document it needs, drafted from your answers, for AUD 399.",
    );
    expect(heroHeadline(null)).toMatch(/for one fixed price\.$/);
    expect(HOME_COPY.cta).toBe("See which audit I need");
    expect(HOME_COPY.ctaSecondary).toBe("See a sample document");
    expect(HOME_COPY.priceLine("AUD 399")).toMatch(
      /^AUD 399 one-off .*No subscription needed, no instalments, no interest\./,
    );
    expect(HOME_COPY.refundLine).toMatch(/refund/i);
    // Never a countdown, instalment or BNPL phrasing (CLAUDE.md section 5).
    expect(homeStrings().join("\n")).not.toMatch(
      /pay later|afterpay|zip pay|per month for|limited time|only \d+ left|hurry/i,
    );
  });

  it("the hero paragraph is short enough for three lines on a phone (batch 26 item 5)", () => {
    expect(HOME_COPY.lead.length).toBeLessThanOrEqual(170);
    expect(HOME_COPY.lead).toMatch(/which audit you face/);
  });

  it("states the price of entry, the time and the three trust cues", () => {
    expect(HOME_COPY.ctaNote).toMatch(/Free/);
    expect(HOME_COPY.ctaNote).toMatch(/ten minutes/);
    const titles = HOME_COPY.trust.map((t) => t.title);
    expect(titles).toEqual([
      "Sourced to the Commission",
      "Hosted in Australia",
      "No participant data",
      "Independent",
    ]);
  });

  it("the source cue names the Commission's pages and the Rules on legislation.gov.au, and never claims every rule (retro review of REQ-013, finding 9)", () => {
    const cue = HOME_COPY.trust.find(
      (t) => t.title === "Sourced to the Commission",
    )!;
    expect(cue.text).toMatch(/Commission's published pages/);
    expect(cue.text).toMatch(/legislation\.gov\.au/);
    expect(cue.text).toMatch(/You review every document/);
    expect(cue.text).not.toMatch(/^Every /);
  });

  it("the example result is the real sole-trader reference case, not an invented number", () => {
    const c = loadReferenceCases().find(
      (x) => x.id === "verification-sole-trader",
    )!;
    expect(HOME_COPY.example.summary).toContain(
      `${c.result.documents.length} documents and ${c.result.registers.length} registers`,
    );
    expect(c.result.pathway).toBe("verification");
    expect(c.result.modules.map((m) => m.id)).toEqual(["verification"]);
    expect(c.result.midTermAudit.applies).toBe(false);
    // REQ-014: the example's ready line is what the reference case answered.
    expect(HOME_COPY.example.line).toEqual(readinessCounts(c.result));
  });
});

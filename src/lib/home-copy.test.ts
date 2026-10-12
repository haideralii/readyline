import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { readinessCounts } from "@/lib/questionnaire/readiness";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { HOME_COPY, homeStrings } from "./home-copy";

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

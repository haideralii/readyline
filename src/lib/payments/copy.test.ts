// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { PRICING_COPY, pricingStrings } from "./copy";
import { refundPromise, sectionParagraphs } from "./refund-promise";

describe("pricing page copy (REQ-007 AC-4, business rules)", () => {
  it("passes the prohibited-claims lint on every string, refund promise included", () => {
    for (const s of [...pricingStrings(), ...refundPromise()]) {
      expect(findProhibitedClaims(s), s).toEqual([]);
    }
  });

  it("carries the AI disclosure and the not-legal-advice line, and names no urgency or scarcity", () => {
    expect(PRICING_COPY.aiDisclosure).toMatch(/generated with AI/);
    expect(PRICING_COPY.notLegalAdvice).toMatch(/not legal advice/);
    const all = pricingStrings().join("\n");
    // Purchase pressure only; "mid-term audit countdown" is a feature name from the brief.
    expect(all).not.toMatch(
      /limited time|hurry|only \d+ left|last chance|today only|offer ends|act now/i,
    );
    expect(all).not.toMatch(/\bfrom\s+AUD/i);
    expect(all).toMatch(/No instalments, no interest, no late fees/);
  });

  it("reads the refund promise from product/legal/refunds.md, word for word", () => {
    const raw = readFileSync("product/legal/refunds.md", "utf8");
    const body = raw.replace(/^---[\s\S]*?\n---\n?/, "");
    const expected = sectionParagraphs(body, [
      "Our promise",
      "The document pack",
    ]);
    expect(expected.length).toBeGreaterThanOrEqual(3);
    expect(expected[0]).toMatch(/^We want you to be happy/);
    expect(expected[1]).toMatch(/full refund within 14 days/);
    expect(refundPromise()).toEqual(expected);
  });

  it("sectionParagraphs takes only the named sections and stops at the next heading", () => {
    expect(
      sectionParagraphs(
        "# Title\n\n## A\n\nfirst\n\n## B\n\nsecond\nthird\n\n## C\n\nfourth\n",
        ["A", "C"],
      ),
    ).toEqual(["first", "fourth"]);
  });
});

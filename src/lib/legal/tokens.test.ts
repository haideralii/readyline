// @vitest-environment node
/**
 * Batch 47 items 1 and 2: the legal pages' runtime tokens, and the rule that
 * no public legal page carries a bracketed "to be added" placeholder.
 */
import { describe, expect, it } from "vitest";
import { loadLegalPages } from "./pages";
import {
  applyLegalTokens,
  LEGAL_TOKEN_PATTERN,
  type LegalTokenValues,
} from "./tokens";

const OFF =
  "The registers subscription is not switched on in this environment.";
const READ = "16 October 2026";
const values = (over: Partial<LegalTokenValues> = {}): LegalTokenValues => ({
  subscriptionOffered: true,
  businessLine: null,
  subscriptionOff: OFF,
  vendorTermsDate: READ,
  ...over,
});

describe("applyLegalTokens", () => {
  it("fills the business line once set and removes it otherwise, without leaving a double space", () => {
    const md = "Built by one person. {{business-line}} It is not a law firm.";
    expect(
      applyLegalTokens(
        md,
        values({ businessLine: "It is registered as X, ABN 1." }),
      ),
    ).toBe(
      "Built by one person. It is registered as X, ABN 1. It is not a law firm.",
    );
    expect(applyLegalTokens(md, values())).toBe(
      "Built by one person. It is not a law firm.",
    );
  });

  it("says the off sentence only while the subscription is off, and keeps a #subscription block only while on", () => {
    const md =
      "## Subscription\n\n{{subscription-off}}\n\n{{#subscription}}You can cancel at any time.{{/subscription}}\n\nEnd.";
    expect(applyLegalTokens(md, values({ subscriptionOffered: false }))).toBe(
      `## Subscription\n\n${OFF}\n\nEnd.`,
    );
    expect(applyLegalTokens(md, values())).toBe(
      "## Subscription\n\nYou can cancel at any time.\n\nEnd.",
    );
  });

  // REQ-022 Session E (D-2258, D-2248): the read date in words, every time it appears.
  it("fills the vendor-terms date wherever the token appears", () => {
    const md =
      "It does not use our requests to train its models under its commercial terms, as read on {{vendor-terms-date}}. Read again on {{vendor-terms-date}}.";
    expect(applyLegalTokens(md, values())).toBe(
      `It does not use our requests to train its models under its commercial terms, as read on ${READ}. Read again on ${READ}.`,
    );
  });
});

describe("the legal pages as written (product/legal)", () => {
  const pages = loadLegalPages();

  it("carry no bracketed 'to be added' placeholder and no 'when available'", () => {
    for (const p of pages) {
      expect(p.body, p.slug).not.toMatch(/\[[^\]]*\bto be added\b/i);
      expect(p.body, p.slug).not.toMatch(/when available/i);
    }
  });

  it("use only the tokens the renderer knows, so none can leak to a reader", () => {
    const known =
      /\{\{(business-line|subscription-off|#subscription|\/subscription|vendor-terms-date)\}\}/g;
    for (const p of pages) {
      const stripped = p.body.replace(known, "");
      expect(stripped, p.slug).not.toMatch(LEGAL_TOKEN_PATTERN);
    }
  });

  // FR-14 (h), D-2258: the two "train its models" sentences carry the read date.
  it("date the training sentence on the privacy and AI pages through the token", () => {
    for (const slug of ["privacy", "ai"] as const) {
      const p = pages.find((x) => x.slug === slug)!;
      expect(p.body, slug).toContain(
        "train its models under its commercial terms, as read on {{vendor-terms-date}}.",
      );
    }
  });
});

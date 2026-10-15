// @vitest-environment node
/**
 * Batch 47 items 1 and 2: the legal pages' runtime tokens, and the rule that
 * no public legal page carries a bracketed "to be added" placeholder.
 */
import { describe, expect, it } from "vitest";
import { loadLegalPages } from "./pages";
import { applyLegalTokens, LEGAL_TOKEN_PATTERN } from "./tokens";

const OFF =
  "The registers subscription is not switched on in this environment.";

describe("applyLegalTokens", () => {
  it("fills the business line once set and removes it otherwise, without leaving a double space", () => {
    const md = "Built by one person. {{business-line}} It is not a law firm.";
    expect(
      applyLegalTokens(md, {
        subscriptionOffered: true,
        businessLine: "It is registered as X, ABN 1.",
        subscriptionOff: OFF,
      }),
    ).toBe(
      "Built by one person. It is registered as X, ABN 1. It is not a law firm.",
    );
    expect(
      applyLegalTokens(md, {
        subscriptionOffered: true,
        businessLine: null,
        subscriptionOff: OFF,
      }),
    ).toBe("Built by one person. It is not a law firm.");
  });

  it("says the off sentence only while the subscription is off, and keeps a #subscription block only while on", () => {
    const md =
      "## Subscription\n\n{{subscription-off}}\n\n{{#subscription}}You can cancel at any time.{{/subscription}}\n\nEnd.";
    expect(
      applyLegalTokens(md, {
        subscriptionOffered: false,
        businessLine: null,
        subscriptionOff: OFF,
      }),
    ).toBe(`## Subscription\n\n${OFF}\n\nEnd.`);
    expect(
      applyLegalTokens(md, {
        subscriptionOffered: true,
        businessLine: null,
        subscriptionOff: OFF,
      }),
    ).toBe("## Subscription\n\nYou can cancel at any time.\n\nEnd.");
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
      /\{\{(business-line|subscription-off|#subscription|\/subscription)\}\}/g;
    for (const p of pages) {
      const stripped = p.body.replace(known, "");
      expect(stripped, p.slug).not.toMatch(LEGAL_TOKEN_PATTERN);
    }
  });
});

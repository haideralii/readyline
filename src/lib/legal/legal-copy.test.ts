// @vitest-environment node
/**
 * REQ-008 AC-2, AC-4 and FR-1 over the product owner's copy in
 * product/legal/*.md: front matter, no prohibited claims, no hand-typed
 * heading numbers, no links off the site, and a readability warning (never a
 * failure) above each page's target grade. Warnings print as GitHub Actions
 * annotations so they show on the pull request.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { readability } from "@/lib/text/readability";
import { contactEmail } from "./config";
import {
  hasHandTypedNumbers,
  LEGAL_SLUGS,
  loadLegalPage,
  markdownToText,
  withoutQuotedMentions,
  type LegalSlug,
} from "./pages";

/** FR-1: grade 9 or below for the refund and AI pages, 11 for the rest. */
const TARGET: Record<LegalSlug, number> = {
  refunds: 9,
  ai: 9,
  terms: 11,
  privacy: 11,
  about: 11,
};

function warn(file: string, message: string) {
  console.warn(`::warning file=${file}::${message}`);
}

describe("product/legal copy (REQ-008)", () => {
  for (const slug of LEGAL_SLUGS) {
    const file = `product/legal/${slug}.md`;

    it(`${file}: front matter carries updated and owner po (AC-4)`, () => {
      const page = loadLegalPage(slug);
      expect(page.owner).toBe("po");
      expect(page.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.title, "NDIS must not be in a page title").not.toMatch(
        /ndis/i,
      );
    });

    it(`${file}: no prohibited claims outside quoted mentions (AC-2)`, () => {
      const page = loadLegalPage(slug);
      expect(findProhibitedClaims(withoutQuotedMentions(page.body))).toEqual(
        [],
      );
    });

    it(`${file}: headings are numbered by the renderer, not the copy (D-043)`, () => {
      expect(hasHandTypedNumbers(loadLegalPage(slug).body)).toBe(false);
    });

    it(`${file}: links stay on the site`, () => {
      const page = loadLegalPage(slug);
      expect(page.body.match(/\]\((?:https?:)?\/\/[^)]*\)/g) ?? []).toEqual([]);
    });

    it(`${file}: readability is reported (warning above grade ${TARGET[slug]}, FR-1)`, () => {
      const page = loadLegalPage(slug);
      const score = readability(markdownToText(page.body));
      expect(score.words).toBeGreaterThan(50);
      console.info(
        `${file}: readability grade ${score.grade} (target ${TARGET[slug]}; ${score.words} words, ${score.sentences} sentences)`,
      );
      if (score.grade > TARGET[slug]) {
        warn(
          file,
          `readability grade ${score.grade} is above the target ${TARGET[slug]} for this page (${score.words} words, ${score.sentences} sentences)`,
        );
      }
    });
  }

  it("warns when CONTACT_EMAIL is not set (the footer then has no Contact link)", () => {
    if (!contactEmail()) {
      warn(
        ".env.example",
        "CONTACT_EMAIL is not set; the footer shows no Contact link and the legal pages point to a contact address that is not there yet",
      );
    }
    expect(true).toBe(true);
  });
});

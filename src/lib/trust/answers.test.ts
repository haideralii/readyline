/**
 * REQ-034 FR-7 (D-2949), AC-7: the trust page's words. No secure, safe,
 * bank-level, guaranteed, compliant or certified; every heading a question;
 * every sentence of ours under 20 words (the one policy sentence quoted as it
 * stands, D-2950, is the policy's and is exempt); the page at or under a
 * Year 8 reading grade; the claims lint clean; every anchor a privacy
 * heading.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { legalHeadingId, loadLegalPage } from "@/lib/legal/pages";
import { slugify } from "@/lib/text/slug";
import { readability } from "@/lib/text/readability";
import {
  pinnedFacts,
  sentencesOf,
  TRUST_BANNED_WORDS,
  TRUST_NAV_LABEL,
  TRUST_ROWS,
  TRUST_SOURCE_LINK_LABEL,
  TRUST_TITLE,
} from "./answers";

const words = [
  TRUST_TITLE,
  TRUST_SOURCE_LINK_LABEL,
  TRUST_NAV_LABEL,
  ...TRUST_ROWS.flatMap((r) => [r.question, ...r.answer]),
];

describe("the trust page's words (REQ-034 FR-7, AC-7)", () => {
  it("has eight rows with distinct ids and headings that are questions", () => {
    expect(TRUST_ROWS).toHaveLength(8);
    expect(new Set(TRUST_ROWS.map((r) => r.id)).size).toBe(8);
    for (const r of TRUST_ROWS)
      expect(r.question.endsWith("?"), r.id).toBe(true);
  });

  it("carries none of the banned words and no prohibited claim", () => {
    for (const w of words) {
      for (const re of TRUST_BANNED_WORDS) expect(w, re.source).not.toMatch(re);
      expect(findProhibitedClaims(w), w).toEqual([]);
    }
  });

  it("keeps every sentence of ours under 20 words; the quoted breach sentence is the policy's", () => {
    for (const r of TRUST_ROWS) {
      const quoted = r.answer.every((a) => r.sources.includes(a));
      for (const s of sentencesOf(r.answer.join(" "))) {
        const n = s.split(/\s+/).length;
        if (!quoted) expect(n, `${r.id}: ${s}`).toBeLessThan(20);
      }
    }
  });

  it("reads at or under Year 8 across the page (D-2949)", () => {
    const text = words
      .join(" ")
      .replace(/\{\{vendor-terms-date\}\}/g, "1 October 2026");
    expect(readability(text).grade).toBeLessThanOrEqual(8);
  });

  it("points every row at a heading the privacy policy has, and the renderer gives it an id", () => {
    const page = loadLegalPage("privacy");
    const headings = page.body
      .split("\n")
      .filter((l) => l.startsWith("## "))
      .map((l) => l.slice(3).trim());
    for (const r of TRUST_ROWS) {
      expect(headings, r.id).toContain(r.section);
      const id = legalHeadingId(page.markdown, r.section);
      expect(id, r.id).toMatch(/^\d+-[a-z-]+$/);
      expect(id).toBe(slugify(`${id!.split("-")[0]} ${r.section}`));
    }
    expect(legalHeadingId(page.markdown, "No such heading")).toBeNull();
  });

  it("names the places and numbers an answer carries so the pin has something to hold", () => {
    expect(pinnedFacts(TRUST_ROWS[1].answer)).toEqual([
      "90 days",
      "Sydney",
      "United States",
    ]);
    expect(pinnedFacts(TRUST_ROWS[4].answer)).toEqual(["30 days", "90 days"]);
    expect(pinnedFacts(["Nothing here."])).toEqual([]);
    expect(sentencesOf("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
  });
});

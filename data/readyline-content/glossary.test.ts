/**
 * REQ-025 FR-13, D-2219; REQ-027 D-2709, D-2713, D-2715: the glossary is the
 * one source of every audit term's plain meaning. Each term has one meaning
 * of one short sentence, at most 15 words (D-2852), with no full stop,
 * claim-free and lint-clean; the `more` field of D-2713 is gone. The places
 * that used to carry their own wording (the audit kinds, the checklist's
 * audit items, the home example and the result page) read from it and hold
 * no copy of a meaning.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import {
  GLOSSARY_MAX_WORDS,
  auditKindsContent,
  glossaryBracket,
  glossaryContent,
  glossaryMeaning,
  glossarySentence,
  glossaryTerm,
  resolveGlossaryTokens,
} from "@/lib/questionnaire/content";
import glossary from "./glossary.json";

const READERS = [
  "data/readyline-content/audit-kinds.json",
  "src/lib/checklist/derive.ts",
  "src/lib/home-copy.ts",
  "src/app/start/_components/steps/result-step.tsx",
  "src/components/glossary-terms.tsx",
];

describe("the glossary (REQ-025 FR-13; REQ-027 D-2709, D-2713)", () => {
  it("has the thirteen terms, each with one meaning of at most 15 words (D-2852), claim-free, as a lower-case clause", () => {
    expect(glossary.items).toHaveLength(13);
    expect(new Set(glossary.items.map((t) => t.id)).size).toBe(13);
    for (const t of glossary.items) {
      expect(t.meaning.split(/\s+/).length, t.id).toBeLessThanOrEqual(
        GLOSSARY_MAX_WORDS,
      );
      expect(t.meaning, t.id).not.toMatch(/\.$/);
      expect(t.meaning[0], t.id).toBe(t.meaning[0].toLowerCase());
      expect(findProhibitedClaims(t.meaning), t.id).toEqual([]);
      expect(lintText(t.meaning), t.id).toEqual([]);
    }
  });

  it("D-2852: no term carries a `more`; the term for the Commission's heading and the review status hold", () => {
    for (const t of glossary.items) expect("more" in t, t.id).toBe(false);
    // D-2709: the read's term for the Commission's own heading; the matcher's forms stay "registration group(s)".
    expect(glossaryTerm("registration-group").term).toBe(
      "registration group or class",
    );
    // D-2705: the restrictive-practice meaning is read and adopted, so nothing is marked to verify.
    for (const t of glossary.items) expect("verify" in t, t.id).toBe(false);
    // The PO's check line flips this to "reviewed" in the A1 branch before its PR (D-2709).
    expect(["draft", "reviewed"]).toContain(glossary.status);
    expect(glossary.note).toContain("every entry status reviewed");
  });

  it("the loader hands out the meaning, a sentence form and the bracket form", () => {
    expect(glossaryMeaning("verification-audit")).toBe(
      "an approved auditor checks your documents without coming to see you",
    );
    expect(glossarySentence("mid-term-audit")).toBe(
      "A second audit that most certification providers must have.",
    );
    expect(glossaryBracket("adopt")).toBe(
      "adopt (take a document as your own and date it)",
    );
    expect(glossaryTerm("key-personnel")).toEqual({
      term: "key personnel",
      meaning:
        "the people who run the business or have a real say in running it",
    });
    expect(glossaryContent.items.map((t) => t.id)).toContain("adopt");
  });

  it("a token resolves to the bracket form as plain text, and the audit kinds carry it inside their sentence (D-2715)", () => {
    expect(resolveGlossaryTokens("A {{glossary:mid-term-audit}} is due.")).toBe(
      "A mid-term audit (a second audit that most certification providers must have) is due.",
    );
    const midTerm = auditKindsContent.items.find((k) => k.id === "mid-term")!;
    expect(midTerm.description).toContain(glossaryBracket("mid-term-audit"));
    expect(midTerm.description).not.toContain("{{");
    // D-2715, finding 137(c): the description keeps its own "18 months" clause for the audit-day bracket.
    expect(midTerm.description).toContain("18 months");
  });

  it("no reader keeps its own copy of a meaning (decision 12)", () => {
    for (const rel of READERS) {
      const text = readFileSync(join(process.cwd(), rel), "utf8");
      for (const t of glossary.items) {
        expect(text.includes(t.meaning), `${rel} carries "${t.id}"`).toBe(
          false,
        );
      }
    }
  });
});

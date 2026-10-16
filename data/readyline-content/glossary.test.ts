/**
 * REQ-025 FR-13, D-2219; REQ-027 D-2709, D-2713, D-2715: the glossary is the
 * one source of every audit term's plain meaning. Each term has one meaning
 * of at most 20 words with no full stop and, where it helps, a `more` of at
 * most two sentences and 240 characters; both claim-free and lint-clean. The
 * places that used to carry their own wording (the audit kinds, the
 * checklist's audit items, the home example and the result page) read from
 * it and hold no copy of a meaning or a `more`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import {
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

/** The twelve pairs the PO adopted from the glossary read (D-2709), by id. */
const WITH_MORE = [
  "verification-audit",
  "certification-audit",
  "practice-standards",
  "module",
  "registration-group",
  "mid-term-audit",
  "restrictive-practice",
  "key-personnel",
  "self-assessment",
  "worker-screening-check",
  "reportable-incident",
  "adopt",
];

const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z])/).length;

describe("the glossary (REQ-025 FR-13; REQ-027 D-2709, D-2713)", () => {
  it("has the thirteen terms, each with one meaning of at most 20 words, claim-free, as a lower-case clause", () => {
    expect(glossary.items).toHaveLength(13);
    expect(new Set(glossary.items.map((t) => t.id)).size).toBe(13);
    for (const t of glossary.items) {
      expect(t.meaning.split(/\s+/).length, t.id).toBeLessThanOrEqual(20);
      expect(t.meaning, t.id).not.toMatch(/\.$/);
      expect(t.meaning[0], t.id).toBe(t.meaning[0].toLowerCase());
      expect(findProhibitedClaims(t.meaning), t.id).toEqual([]);
      expect(lintText(t.meaning), t.id).toEqual([]);
    }
  });

  it("the twelve `more` fields are at most two sentences and 240 characters, claim-free and lint-clean; quality-indicator has none", () => {
    for (const t of glossary.items) {
      const more = (t as { more?: string }).more;
      if (WITH_MORE.includes(t.id)) {
        expect(more, t.id).toBeTruthy();
        expect(more!.length, t.id).toBeLessThanOrEqual(240);
        expect(sentences(more!), t.id).toBeLessThanOrEqual(2);
        expect(more, t.id).toMatch(/\.$/);
        expect(findProhibitedClaims(more!), t.id).toEqual([]);
        expect(lintText(more!), t.id).toEqual([]);
      } else {
        expect(more, t.id).toBeUndefined();
      }
    }
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

  it("the loader hands out the meaning, a sentence form, the bracket form and `more`", () => {
    expect(glossaryMeaning("verification-audit")).toBe(
      "an approved auditor checks your documents without coming to see you",
    );
    expect(glossarySentence("mid-term-audit")).toBe(
      "A second audit that most certification providers must have.",
    );
    expect(glossaryBracket("adopt")).toBe(
      "adopt (take a document as your own and date it)",
    );
    expect(glossaryTerm("key-personnel").more).toBe(
      "Partners and board members count too (NDIS Act s 11A).",
    );
    expect(glossaryTerm("quality-indicator").more).toBeUndefined();
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

  it("no reader keeps its own copy of a meaning or a `more` (decision 12)", () => {
    for (const rel of READERS) {
      const text = readFileSync(join(process.cwd(), rel), "utf8");
      for (const t of glossary.items) {
        expect(text.includes(t.meaning), `${rel} carries "${t.id}"`).toBe(
          false,
        );
        const more = (t as { more?: string }).more;
        if (more)
          expect(text.includes(more), `${rel} carries ${t.id}'s more`).toBe(
            false,
          );
      }
    }
  });
});

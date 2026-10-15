/**
 * REQ-025 FR-13, D-2219: the glossary is the one source of every audit
 * term's plain meaning. Each term has one meaning of at most 20 words, no
 * claim, no banned word; the four places that used to carry their own
 * wording (the audit kinds, the checklist's audit items, the home example
 * and the result page) read from it and hold no copy of a meaning.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import {
  glossaryContent,
  glossaryMeaning,
  glossarySentence,
  auditKindsContent,
} from "@/lib/questionnaire/content";
import glossary from "./glossary.json";

const READERS = [
  "data/readyline-content/audit-kinds.json",
  "src/lib/checklist/derive.ts",
  "src/lib/home-copy.ts",
  "src/app/start/_components/steps/result-step.tsx",
];

describe("the glossary (REQ-025 FR-13)", () => {
  it("has the thirteen terms, each with one meaning of at most 20 words, claim-free", () => {
    expect(glossary.items).toHaveLength(13);
    expect(new Set(glossary.items.map((t) => t.id)).size).toBe(13);
    for (const t of glossary.items) {
      expect(t.meaning.split(/\s+/).length, t.id).toBeLessThanOrEqual(20);
      expect(t.meaning, t.id).not.toMatch(/\.$/);
      expect(findProhibitedClaims(t.meaning), t.id).toEqual([]);
      expect(lintText(t.meaning), t.id).toEqual([]);
    }
  });

  it("the loader hands out the meaning and a sentence form", () => {
    expect(glossaryMeaning("verification-audit")).toBe(
      "an auditor checks your documents at a desk; nobody visits",
    );
    expect(glossarySentence("mid-term-audit")).toBe(
      "A check about halfway through your three years.",
    );
    expect(glossaryContent.items.map((t) => t.id)).toContain("adopt");
  });

  it("the restrictive-practice meaning is marked to verify against the Act (review finding 17)", () => {
    const rp = glossary.items.find((t) => t.id === "restrictive-practice")!;
    expect(rp.verify).toMatch(/NDIS Act 2013 s 9/);
  });

  it("the audit kinds read the mid-term meaning from the glossary", () => {
    const midTerm = auditKindsContent.items.find((k) => k.id === "mid-term")!;
    expect(
      midTerm.description.startsWith(glossarySentence("mid-term-audit")),
    ).toBe(true);
    expect(midTerm.description).not.toContain("{{");
  });

  it("no reader keeps its own copy of a meaning (decision 12)", () => {
    for (const rel of READERS) {
      const text = readFileSync(join(process.cwd(), rel), "utf8");
      for (const t of glossary.items)
        expect(text.includes(t.meaning), `${rel} carries "${t.id}"`).toBe(
          false,
        );
    }
  });
});

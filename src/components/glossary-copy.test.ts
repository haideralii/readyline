import { describe, expect, it } from "vitest";
import {
  GLOSSARY_MAX_WORDS,
  glossaryContent,
} from "@/lib/questionnaire/content";
import { GLOSSARY_ATTRIBUTION, splitHyphenated } from "./glossary-copy";

/**
 * REQ-027 D-2267 item 7: a hyphenated word in a meaning stays one piece the
 * renderer keeps on one line; everything else is left as it is and the text
 * joins back exactly.
 */
describe("the glossary renderer's hyphen rule", () => {
  it("marks each hyphenated word and nothing else; the parts join back to the text", () => {
    const parts = splitHyphenated(
      "Key personnel and sole-trader providers, with few exceptions.",
    );
    expect(parts.filter((p) => p.nowrap).map((p) => p.text)).toEqual([
      "sole-trader",
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(
      "Key personnel and sole-trader providers, with few exceptions.",
    );
    expect(splitHyphenated("no hyphen here").every((p) => !p.nowrap)).toBe(
      true,
    );
    // A dash between spaces is not a hyphenated word.
    expect(splitHyphenated("a - b").filter((p) => p.nowrap)).toEqual([]);
  });

  it("every glossary meaning joins back through the split, and a hyphenated word in one is marked", () => {
    const words = new Set<string>();
    for (const g of glossaryContent.items) {
      const text = `${g.meaning}.`;
      const parts = splitHyphenated(text);
      expect(parts.map((p) => p.text).join("")).toBe(text);
      for (const p of parts)
        if (p.nowrap) words.add(p.text.replace(/[.,;]$/, ""));
    }
    expect([...words]).toEqual(expect.arrayContaining(["four-digit"]));
    expect(Object.keys(GLOSSARY_ATTRIBUTION).sort()).toEqual([
      "guide",
      "page",
      "result",
    ]);
  });

  it("D-2852: every glossary line is one short sentence of at most 15 words, with no second sentence", () => {
    for (const g of glossaryContent.items) {
      const words = g.meaning.trim().split(/\s+/).length;
      expect(words, `${g.id}: "${g.meaning}"`).toBeLessThanOrEqual(
        GLOSSARY_MAX_WORDS,
      );
      expect(g.meaning, g.id).not.toMatch(/\.\s+\S/);
      expect(g.meaning, g.id).not.toMatch(/\.$/);
      expect("more" in g, `${g.id} carries a second sentence`).toBe(false);
    }
    // The five of the PO's 12:30 line, verbatim once the renderer capitalises and closes them.
    const sentence = (id: string) => {
      const m = glossaryContent.items.find((x) => x.id === id)!.meaning;
      return `${m[0].toUpperCase()}${m.slice(1)}.`;
    };
    expect(sentence("practice-standards")).toBe(
      "The quality rules every registered provider must meet.",
    );
    expect(sentence("module")).toBe("One topic's set of those rules.");
    expect(sentence("certification-audit")).toBe(
      "The fuller audit: the auditor visits and talks to you, your workers and participants.",
    );
    expect(sentence("registration-group")).toBe(
      "A type of support you are registered to provide, with a four-digit code.",
    );
    expect(sentence("restrictive-practice")).toBe(
      "Anything that limits a person's rights or movement; the law limits its use.",
    );
  });
});

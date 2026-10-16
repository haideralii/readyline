import { describe, expect, it } from "vitest";
import { glossaryContent } from "@/lib/questionnaire/content";
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

  it("every glossary meaning and more joins back through the split, and the two hyphenated words the checklist showed are marked", () => {
    const words = new Set<string>();
    for (const g of glossaryContent.items) {
      const text = `${g.meaning}.${g.more ? ` ${g.more}` : ""}`;
      const parts = splitHyphenated(text);
      expect(parts.map((p) => p.text).join("")).toBe(text);
      for (const p of parts)
        if (p.nowrap) words.add(p.text.replace(/[.,;]$/, ""));
    }
    expect([...words]).toEqual(
      expect.arrayContaining(["sole-trader", "risk-assessed"]),
    );
    expect(Object.keys(GLOSSARY_ATTRIBUTION).sort()).toEqual([
      "guide",
      "page",
      "result",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  TIGHT_PARAGRAPH_MAX_WORDS,
  countWords,
  lintText,
  splitSentences,
} from "./rules";

describe("copy lint rules (REQ-015 FR-2, AC-3)", () => {
  it("fails a seeded banned word", () => {
    const v = lintText(
      "We leverage the Commission's text to utilise your answers.",
    );
    expect(v.map((x) => x.rule)).toEqual(["banned-word", "banned-word"]);
    expect(lintText("Not applicable here, so N/A.").map((x) => x.rule)).toEqual(
      ["banned-word"],
    );
    expect(
      lintText("Fill this in order to continue.").map((x) => x.rule),
    ).toEqual(["banned-word"]);
  });

  it("fails a 70-word paragraph and passes a 60-word one", () => {
    const ten = "Short words fill this one sentence out to ten words.";
    const seventy = Array.from({ length: 7 }, () => ten).join(" ");
    expect(countWords(seventy)).toBe(70);
    expect(lintText(seventy, { block: true }).map((x) => x.rule)).toEqual([
      "paragraph-length",
    ]);
    const sixty = Array.from({ length: 6 }, () => ten).join(" ");
    expect(lintText(sixty, { block: true })).toEqual([]);
    // Inline strings are not capped as paragraphs.
    expect(lintText(seventy)).toEqual([]);
  });

  it("REQ-025 FR-10: a tight block fails at 50 words and passes at 45", () => {
    const five = "Five short words sit here.";
    const fifty = Array.from({ length: 10 }, () => five).join(" ");
    expect(
      lintText(fifty, { block: true, maxWords: TIGHT_PARAGRAPH_MAX_WORDS }).map(
        (x) => x.rule,
      ),
    ).toEqual(["paragraph-length"]);
    const fortyFive = Array.from({ length: 9 }, () => five).join(" ");
    expect(
      lintText(fortyFive, { block: true, maxWords: TIGHT_PARAGRAPH_MAX_WORDS }),
    ).toEqual([]);
    // Without the option the 60-word cap holds, so the other pages are unchanged.
    expect(lintText(fifty, { block: true })).toEqual([]);
  });

  it("fails a sentence over 35 words", () => {
    const long = `${Array.from({ length: 36 }, (_, i) => `w${i}`).join(" ")}.`;
    expect(lintText(long).map((x) => x.rule)).toEqual(["sentence-length"]);
    const ok = `${Array.from({ length: 35 }, (_, i) => `w${i}`).join(" ")}. Then a short one.`;
    expect(lintText(ok)).toEqual([]);
  });

  it("fails an internal path or file name", () => {
    expect(
      lintText(
        "Source: Readyline document set mapping (data/readyline-content/document-sets.json).",
      ).map((x) => x.rule),
    ).toEqual(["internal-path"]);
    expect(lintText("See src/lib/standards.").map((x) => x.rule)).toEqual([
      "internal-path",
    ]);
    expect(lintText("Open the file checklist.md").map((x) => x.rule)).toEqual([
      "internal-path",
    ]);
    // Customer-facing file types and addresses are fine.
    expect(
      lintText("Download the pack as a .docx and a PDF from readyline.com.au."),
    ).toEqual([]);
  });

  it("keeps abbreviations inside a sentence and ignores whitespace noise", () => {
    expect(splitSentences("Use a code, e.g. P-014. Then save.")).toEqual([
      "Use a code, e.g. P-014.",
      "Then save.",
    ]);
    expect(lintText("   \n  ")).toEqual([]);
  });
});

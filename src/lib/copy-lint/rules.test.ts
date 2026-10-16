import { describe, expect, it } from "vitest";
import {
  AVERAGE_MAX_WORDS,
  TIGHT_PARAGRAPH_MAX_WORDS,
  averageSentenceWords,
  countWords,
  lintAverage,
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

  // REQ-027 FR-1, AC-1 (D-2702): one file over the average and one under.
  it("fails a file whose sentences average over 25 words and passes one at 25", () => {
    expect(AVERAGE_MAX_WORDS).toBe(25);
    const words = (n: number) =>
      `${Array.from({ length: n }, (_, i) => `w${i}`).join(" ")}.`;
    // 30 and 22 words: 26 on average, over; neither sentence passes the 35-word limit.
    const over = [words(30), words(22)];
    expect(averageSentenceWords(over)).toBe(26);
    expect(lintAverage(over)?.rule).toBe("average-sentence-length");
    expect(lintAverage(over)?.detail).toContain("26 words a sentence");
    // 30 and 20: exactly 25, the cap, passes; a page of short lines with one long legal sentence passes too.
    expect(lintAverage([words(30), words(20)])).toBeNull();
    expect(
      lintAverage([words(34), words(6), words(8), words(7), words(5)]),
    ).toBeNull();
    // Nothing counted: no average, no finding.
    expect(averageSentenceWords([])).toBeNull();
    expect(lintAverage(["   "])).toBeNull();
  });

  it("keeps abbreviations inside a sentence and ignores whitespace noise", () => {
    expect(splitSentences("Use a code, e.g. P-014. Then save.")).toEqual([
      "Use a code, e.g. P-014.",
      "Then save.",
    ]);
    expect(lintText("   \n  ")).toEqual([]);
  });
});

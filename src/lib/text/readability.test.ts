import { describe, expect, it } from "vitest";
import { countSentences, countSyllables, readability } from "./readability";

describe("readability (Flesch-Kincaid grade, D-503)", () => {
  it("estimates syllables with the usual English heuristics", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("worker")).toBe(2);
    expect(countSyllables("participant")).toBe(4);
    expect(countSyllables("table")).toBe(2);
    expect(countSyllables("organise")).toBe(3);
    expect(countSyllables("review")).toBe(2);
  });

  it("counts sentences on terminal punctuation and line breaks", () => {
    expect(countSentences("We review this. We tell the worker.")).toBe(2);
    expect(countSentences("Step one\nStep two\nStep three")).toBe(3);
  });

  it("scores plain short sentences well within the target", () => {
    const r = readability(
      "We keep a register of incidents. The owner reviews it each month. We tell the Commission about reportable incidents within the time the rules set.",
    );
    expect(r.grade).toBeLessThan(9);
    expect(r.level).toBe("ok");
  });

  it("flags long, Latinate prose above the fail threshold", () => {
    const r = readability(
      "Notwithstanding the aforementioned organisational considerations, the comprehensive implementation of multidisciplinary governance arrangements necessitates the systematic utilisation of standardised documentation methodologies across all operational jurisdictions.",
    );
    expect(r.grade).toBeGreaterThan(11);
    expect(r.level).toBe("fail");
  });

  it("handles empty text", () => {
    expect(readability("").grade).toBe(0);
  });
});

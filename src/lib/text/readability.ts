/**
 * Flesch-Kincaid grade level, implemented here so tests, the quality gate and
 * the reviewer view report the same number (REQ-005 FR-8, D-503).
 * Thresholds come from the house style: warn above 9, fail above 11.
 */
export const READABILITY_WARN_ABOVE = 9;
export const READABILITY_FAIL_ABOVE = 11;
/** D-047: a section with fewer words than this warns above the fail line but never fails (too small a sample). */
export const SHORT_SECTION_WORDS = 40;

export type Readability = {
  sentences: number;
  words: number;
  syllables: number;
  grade: number;
  level: "ok" | "warn" | "fail";
};

const WORD = /[A-Za-z][A-Za-z'’-]*/g;

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const s =
    w
      .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
      .replace(/^y/, "")
      .match(/[aeiouy]{1,2}/g)?.length ?? 0;
  return Math.max(1, s);
}

export function countSentences(text: string): number {
  const parts = text
    .split(/[.!?]+(?:\s|$)|\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return Math.max(1, parts.length);
}

export function readability(text: string): Readability {
  const words = text.match(WORD) ?? [];
  const wordCount = Math.max(1, words.length);
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  const sentences = words.length === 0 ? 1 : countSentences(text);
  const grade =
    words.length === 0
      ? 0
      : 0.39 * (wordCount / sentences) + 11.8 * (syllables / wordCount) - 15.59;
  const rounded = Math.round(grade * 10) / 10;
  const level =
    rounded > READABILITY_FAIL_ABOVE
      ? "fail"
      : rounded > READABILITY_WARN_ABOVE
        ? "warn"
        : "ok";
  return { sentences, words: words.length, syllables, grade: rounded, level };
}

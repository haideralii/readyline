/**
 * Plain-language rules for customer-facing copy (REQ-015 FR-1, FR-2;
 * product/domain/ui-copy.md). Pure functions over text so the
 * file-walking test in tests/copy-lint.test.ts and the seeded unit test here
 * share one implementation.
 *
 * The limits are the REQ's: a paragraph over 60 words, a sentence over 35
 * words, a banned word, or an internal path or file name fails. The style
 * targets (sentences under 20 words on average, a paragraph under 3 lines on
 * a 375 px screen) are the writer's job; the lint catches what is clearly
 * over.
 */
export const PARAGRAPH_MAX_WORDS = 60;
export const SENTENCE_MAX_WORDS = 35;
/**
 * REQ-025 D-2218, FR-10 (review decisions 10 and 11): on the result page,
 * the pricing page and the guides a paragraph is at most three lines at
 * 360 px, measured as 45 words (ui-copy's number); list items and
 * disclosure summaries are exempt; the lawyer's text is allow-listed by
 * constant, never by path.
 */
export const TIGHT_PARAGRAPH_MAX_WORDS = 45;

/** Words we never use with a customer (FR-1). */
export const BANNED_WORDS: readonly RegExp[] = [
  /\bleverage\b/i,
  /\butili[sz]e[sd]?\b/i,
  /\bin order to\b/i,
  /\bpursuant\b/i,
  /\bN\/A\b/,
  // Batch 45 item 2: a promise with no date; an environment fact is said as one.
  /\bcoming soon\b/i,
  // REQ-013 batch 36 item 2: the evidence-confidence flag is internal; the customer reads a plain "check this" sentence.
  /\bnot confirmed by the Commission/i,
  /\bnot asked about yet\b/i,
  // Batch 47 item 2: a bracketed "to be added" placeholder is never shown on a public page.
  /\[[^\]]*\bto be added\b/i,
];

/** An internal path or file name has no place in customer-facing text (FR-2). */
export const INTERNAL_PATH: readonly RegExp[] = [
  /(^|[\s("'`[])(src|data|product|supabase|e2e|tests|scripts|fixtures)\/[\w./-]+/,
  /\b[\w-]+\.(json|tsx?|mjs|cjs|md|mdx|sql|yml)\b/,
];

/**
 * REQ-027 FR-1 (D-2702): a file's sentences average under 20 words by the
 * style rule and never pass 30 by D-2219; the lint fails a file whose
 * average passes 25 over the counted population (paragraph-like blocks, the
 * copy modules' and content files' strings of ten words or more, a guide's
 * paragraphs and front-matter lines), beside the 35-word hard limit.
 */
export const AVERAGE_MAX_WORDS = 25;
/** A copy module's or content file's string joins the average from this many words (FR-1). */
export const AVERAGE_MIN_STRING_WORDS = 10;

export type CopyViolation = {
  rule:
    | "paragraph-length"
    | "sentence-length"
    | "average-sentence-length"
    | "banned-word"
    | "internal-path";
  detail: string;
};

const ABBREVIATIONS = /\b(e\.g|i\.e|etc|vs|no|St|Dr|Mr|Mrs|Ms|Pty|Ltd)\.$/i;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Splits on sentence-ending punctuation followed by a space and a capital, keeping abbreviations together. */
export function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  const tokens = text.trim().split(/(?<=[.!?][\]"”)]?)\s+(?=[A-Z0-9"“(\[])/);
  for (const t of tokens) {
    if (current && ABBREVIATIONS.test(current)) current = `${current} ${t}`;
    else {
      if (current) parts.push(current);
      current = t;
    }
  }
  if (current) parts.push(current);
  return parts.filter((p) => p.trim().length > 0);
}

/**
 * Lints one piece of copy. `block` is true for a paragraph-like element (p,
 * li, summary, label, ...) whose whole length is capped; inline strings are
 * checked for sentence length, banned words and paths only.
 */
export function lintText(
  text: string,
  options: { block?: boolean; maxWords?: number } = {},
): CopyViolation[] {
  const out: CopyViolation[] = [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return out;
  if (options.block) {
    const max = options.maxWords ?? PARAGRAPH_MAX_WORDS;
    const words = countWords(clean);
    if (words > max)
      out.push({
        rule: "paragraph-length",
        detail: `${words} words (max ${max}): "${clean.slice(0, 60)}…"`,
      });
  }
  for (const s of splitSentences(clean)) {
    const words = countWords(s);
    if (words > SENTENCE_MAX_WORDS)
      out.push({
        rule: "sentence-length",
        detail: `${words} words (max ${SENTENCE_MAX_WORDS}): "${s.slice(0, 60)}…"`,
      });
  }
  for (const re of BANNED_WORDS) {
    const m = re.exec(clean);
    if (m)
      out.push({
        rule: "banned-word",
        detail: `"${m[0]}" in "${clean.slice(0, 60)}…"`,
      });
  }
  for (const re of INTERNAL_PATH) {
    const m = re.exec(clean);
    if (m) {
      out.push({
        rule: "internal-path",
        detail: `"${m[0].trim()}" in "${clean.slice(0, 60)}…"`,
      });
      break;
    }
  }
  return out;
}

/** The mean sentence length over a file's counted sentences, to one decimal; null when there is none (FR-1). */
export function averageSentenceWords(
  sentences: readonly string[],
): number | null {
  const counts = sentences.map(countWords).filter((n) => n > 0);
  if (counts.length === 0) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  return Math.round((total / counts.length) * 10) / 10;
}

/** FR-1 (D-2702): the file fails when its average passes 25; the hard limit on one sentence stays `lintText`'s. */
export function lintAverage(
  sentences: readonly string[],
): CopyViolation | null {
  const avg = averageSentenceWords(sentences);
  if (avg === null || avg <= AVERAGE_MAX_WORDS) return null;
  return {
    rule: "average-sentence-length",
    detail: `${avg} words a sentence on average over ${sentences.length} sentences (max ${AVERAGE_MAX_WORDS})`,
  };
}

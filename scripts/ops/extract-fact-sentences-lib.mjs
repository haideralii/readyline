/**
 * REQ-012 FR-4b (D-2905, D-2911; question 3 (c)): the sentence extractor's
 * pure half. A "fact sentence" is a public sentence that carries a number,
 * a date, a dollar amount, a time frame, a hedge word or an instrument
 * name; each needs a source in the claims-and-sources table or an
 * UNVERIFIED row. Regex classes plus an allow-list of noise sentences; the
 * script prints precision (mapped over found) against the table.
 */

export const CLASSES = Object.freeze({
  number: /\b\d[\d,.]*\b/,
  date: /\b(?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b(?:\s+20\d\d)?|\b20\d\d(?:-\d\d)?\b/,
  dollar: /(?:\$|AUD)\s?\d/,
  // D-2905: any "in / within / under N minutes / hours / days" needs a source.
  time: /\b(?:in|within|under)\s+\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\b/i,
  // D-2911: the hedge words that stand in for a source.
  hedge:
    /\b(?:most providers|usually|typically|in practice|auditors expect|auditors look for|a key part|the Commission suggests)\b/i,
  // Instruments: the Act, the Rules, the Guidelines, the Practice Standards, a section.
  instrument:
    /\b(?:the\s+)?(?:NDIS\s+)?(?:Act|Rules|Guidelines|Practice Standards|Quality Indicators|Code of Conduct|Worker Screening Rules|Incident Management Rules|Complaints Management Rules)\b|\bs\s?\d+[A-Z]{0,2}(?:\(\d+\))?\b|\bsections?\s+\d+/,
});

/** Sentences that carry a class but state no fact a source could back; exact text after whitespace folding. */
export const NOISE = new Set([
  // D-2954 (2): the audit guide's own disclosure that practice is not a rule, ruled as such.
  "Where we add what auditors do in practice, from sector webinars, we say so: practice is not a rule.",
  "Step 1 of 6",
  "Step 2 of 6",
  "Step 3 of 6",
  "Step 4 of 6",
  "Step 5 of 6",
  "Step 6 of 6",
]);

/**
 * Noise by shape (question 3 (c)): interface copy that carries a digit and
 * states no fact a source could back. Each pattern names its kind; a
 * sentence matching any is left out and counted as noise.
 */
export const NOISE_PATTERNS = Object.freeze([
  { kind: "validation", re: /^(?:Enter|Choose|Pick|Type|Add|Use|Leave)\b/ },
  { kind: "field-limit", re: /^Up to \d+ (?:characters|words)/i },
  { kind: "example", re: /\bfor example\b/i },
  {
    kind: "count",
    re: /^\d+ (?:documents?|rows?|items?|workers?|changes?|reminders?|checks?|entries|incidents?|complaints?|days? (?:ago|left))\b/i,
  },
  { kind: "step", re: /^Step \d+ of \d+/i },
  { kind: "code", re: /[{}()<>;=]|\$\{|\bclassName\b|^\W/ },
  {
    kind: "placeholder",
    re: /\b(?:W|KP|INC|CMP|S|V|P)-\d{1,6}\b|0400 000 000|51 824 753 556/,
  },
  { kind: "progress", re: /\b(?:drafted|written|saved|ticked|done) so far\b/i },
  { kind: "class-code-only", re: /^\(?class \d{4}\)?[:.]?$/i },
  // A Tailwind class list read out of a TSX attribute: utility tokens, no capital, no sentence end.
  {
    kind: "class-list",
    re: /^(?=.*[-:])(?:[a-z0-9:\-\[\]\/.%#()!]+\s+){1,}[a-z0-9:\-\[\]\/.%#()!]+$/,
  },
  // Product behaviour the code decides, not a fact about the sector: digit counts, "N adopted document(s)".
  { kind: "digits", re: /^\d+ digits\b/i },
  { kind: "adopted-count", re: /^\d+ adopted documents?\b/i },
]);

/** The noise kind a sentence matches, or null when it is a fact candidate. */
export function noiseKind(sentence) {
  if (NOISE.has(sentence)) return "listed";
  for (const n of NOISE_PATTERNS) if (n.re.test(sentence)) return n.kind;
  return null;
}

const fold = (s) => s.replace(/\s+/g, " ").trim();

/** Splits prose into sentences on . ! ? followed by space and a capital, a quote or a digit; keeps list items whole. */
export function sentencesOf(text) {
  return fold(text)
    .split(/(?<=[.!?])\s+(?=[A-Z"'(\d])/)
    .map(fold)
    .filter((s) => s.length >= 12);
}

/** The classes a sentence carries, in a fixed order; empty when none. */
export function classify(sentence) {
  const out = [];
  for (const [name, re] of Object.entries(CLASSES))
    if (re.test(sentence)) out.push(name);
  // A bare "Step 3 of 6" or a lone year in a date is a number too; a number alone in a code (W-003, s 73E) is not a fact.
  if (
    out.length === 1 &&
    out[0] === "number" &&
    /^(?:[A-Z]{1,3}-?\d{1,6}|\d{4} \d{3} \d{3})$/.test(sentence)
  )
    return [];
  return out;
}

/** Strips front matter, table pipes and markdown marks from a markdown document, returning prose lines with their line numbers. */
export function markdownProse(md) {
  const lines = md.split("\n");
  let i = 0;
  if (lines[0]?.trim() === "---") {
    i = lines.indexOf("---", 1) + 1;
    if (i === 0) i = 0;
  }
  const out = [];
  for (; i < lines.length; i++) {
    let l = lines[i];
    if (/^\s*(```|<!--|\|\s*-+\s*\|)/.test(l)) continue;
    if (/^\s*\|/.test(l))
      l =
        l
          .replace(/^\s*\|/, "")
          .replace(/\|\s*$/, "")
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean)
          .join(". ") + ".";
    l = l
      .replace(/^#+\s*/, "")
      .replace(/^\s*[-*]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .replace(/\*\*|__|`/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, " ");
    if (fold(l)) out.push({ line: i + 1, text: l });
  }
  return out;
}

/** String literals and JSX text of a TypeScript module that read as prose (a space and at least 24 characters). */
export function tsProse(source) {
  const out = [];
  const lines = source.split("\n");
  lines.forEach((l, idx) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return; // a comment is not customer copy
    for (const m of l.matchAll(
      /"((?:[^"\\]|\\.){24,})"|'((?:[^'\\]|\\.){24,})'|`((?:[^`\\$]|\\.){24,})`/g,
    )) {
      const s = (m[1] ?? m[2] ?? m[3]).replace(/\\n/g, " ");
      if (s.includes(" ")) out.push({ line: idx + 1, text: s });
    }
    for (const m of l.matchAll(/>([^<>{}]{24,})</g))
      if (m[1].includes(" ")) out.push({ line: idx + 1, text: m[1] });
  });
  return out;
}

/** Every string value of a JSON document with its path. */
export function jsonProse(json) {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === "string") {
      if (v.length >= 24 && v.includes(" "))
        out.push({ line: 0, text: v, path });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(JSON.parse(json), "$");
  return out;
}

/**
 * Extracts the fact sentences of one file's prose items: { file, line, classes, sentence }.
 */
export function factSentences(file, items) {
  const found = [];
  for (const item of items)
    for (const sentence of sentencesOf(item.text)) {
      if (noiseKind(sentence)) continue;
      const classes = classify(sentence);
      if (classes.length)
        found.push({ file, line: item.line, classes, sentence });
    }
  return found;
}

/**
 * Precision: the share of found sentences whose table row carries a source
 * (a status other than UNVERIFIED). A row is the table line that holds the
 * sentence verbatim; a sentence with no row, or an UNVERIFIED one, is
 * unmapped.
 */
export function precision(found, tableText) {
  const rows = (tableText ?? "").split("\n").map(fold);
  const mappedSet = new Set(
    found.filter((f) => {
      const row = rows.find((l) => l.includes(fold(f.sentence)));
      return Boolean(row) && !/\|\s*UNVERIFIED\s*\|/.test(row);
    }),
  );
  return {
    found: found.length,
    mapped: mappedSet.size,
    unmapped: found.filter((f) => !mappedSet.has(f)),
  };
}

/**
 * Terminology and claims lint for generated text (REQ-005 FR-2 step 4,
 * AC-9). The word lists come from product/domain/house-style.md; the
 * CLAUDE.md 4.3 claim rules are reused from src/lib/claims.ts. Occurrences
 * inside the Commission's own registration class names are ignored, as the
 * house style allows ("except in the Commission's own class names").
 */
import { findProhibitedClaims } from "@/lib/claims";

export type LintSeverity = "error" | "warn";
export type LintFinding = {
  rule: string;
  severity: LintSeverity;
  match: string;
  index: number;
  why: string;
};

type Rule = {
  id: string;
  pattern: RegExp;
  severity: LintSeverity;
  why: string;
};

/** From house-style.md "Terminology" and "Claims". */
export const TERMINOLOGY_RULES: readonly Rule[] = [
  {
    id: "term-participant",
    pattern: /\b(?:clients?|customers?|patients?|consumers?|residents?)\b/gi,
    severity: "error",
    why: "Use 'participant'.",
  },
  {
    id: "term-worker",
    pattern: /\b(?:staff\s+members?|employees?|carers?|support\s+workers?)\b/gi,
    severity: "error",
    why: "Use 'worker'.",
  },
  {
    id: "plain-words",
    pattern:
      /\b(?:utilis(?:e|es|ed|ing|ation)|commenc(?:e|es|ed|ing|ement)|advis(?:e|es|ed|ing))\b/gi,
    severity: "warn",
    why: "Prefer common words: use, start, tell.",
  },
  {
    id: "plain-words-assist",
    pattern: /\bassist(?:s|ed|ing|ance)?\b/gi,
    severity: "warn",
    why: "Prefer 'help' except in the Commission's class names.",
  },
  {
    id: "no-exclamation",
    pattern: /!/g,
    severity: "error",
    why: "No exclamation marks.",
  },
  {
    id: "no-please",
    pattern: /\bplease\b/gi,
    severity: "error",
    why: "No 'please'.",
  },
  {
    id: "spelling-programme",
    pattern: /\bprogrammes?\b/gi,
    severity: "error",
    why: "Use 'program'.",
  },
  {
    id: "spelling-american",
    pattern: /\b\w+iz(?:e|es|ed|ing|ation)\b/gi,
    severity: "warn",
    why: "Australian spelling (organise, not organize).",
  },
  {
    id: "claim-words",
    pattern:
      /\b(?:guaranteed?|audit[\s-]?proof|fully\s+compliant|approved\s+by|endorsed\s+by|commission[\s-]approved|100\s?%)\b/gi,
    severity: "error",
    why: "Say what we do, not that we comply (CLAUDE.md 4.3).",
  },
  {
    id: "claim-complies",
    pattern:
      /\b(?:complies|compliant|in\s+compliance)\s+with\s+(?:the\s+)?(?:standards?|rules?|practice\s+standards)\b/gi,
    severity: "error",
    why: "Say what we do rather than claim compliance.",
  },
];

/** American spellings that are also valid or are Commission class words; not flagged. */
const AMERICAN_ALLOW = new Set([
  "size",
  "sizes",
  "sized",
  "prize",
  "prizes",
  "seize",
  "seized",
  "capsize",
]);

export function lintText(
  text: string,
  options: { allowedPhrases?: readonly string[] } = {},
): LintFinding[] {
  // Blank out allowed phrases (class names) so matches inside them are skipped
  // while every index still refers to the original text.
  let scrubbed = text;
  for (const phrase of options.allowedPhrases ?? []) {
    if (!phrase) continue;
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    scrubbed = scrubbed.replace(re, (m) => " ".repeat(m.length));
  }
  const findings: LintFinding[] = [];
  for (const rule of TERMINOLOGY_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const m of scrubbed.matchAll(re)) {
      if (
        rule.id === "spelling-american" &&
        AMERICAN_ALLOW.has(m[0].toLowerCase())
      )
        continue;
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        match: m[0],
        index: m.index ?? 0,
        why: rule.why,
      });
    }
  }
  for (const c of findProhibitedClaims(scrubbed)) {
    findings.push({
      rule: `claims:${c.rule}`,
      severity: "error",
      match: c.match,
      index: c.index,
      why: "Prohibited claim (CLAUDE.md 4.3).",
    });
  }
  return findings.sort((a, b) => a.index - b.index);
}

export function lintErrors(findings: readonly LintFinding[]): LintFinding[] {
  return findings.filter((f) => f.severity === "error");
}

/**
 * R-7 / D-041: tailored sections never restate statutory timeframes; the
 * fixed section that carries the Commission's rule is the single source.
 */
export const TIMEFRAME_RULES: readonly Rule[] = [
  {
    id: "timeframe-24-hours",
    pattern: /\b24\s*hours?\b/gi,
    severity: "error",
    why: "A statutory timeframe; refer to the fixed section that holds it.",
  },
  {
    id: "timeframe-business-days",
    pattern: /\b\d+\s+business\s+days?\b|\bbusiness\s+days?\b/gi,
    severity: "error",
    why: "A statutory timeframe; refer to the fixed section that holds it.",
  },
  {
    id: "timeframe-within-days",
    pattern: /\bwithin\s+(?:\w+\s+){0,3}(?:hours?|days?)\b/gi,
    severity: "error",
    why: "A statutory timeframe; refer to the fixed section that holds it.",
  },
];

export function lintTimeframes(text: string): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const rule of TIMEFRAME_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const m of text.matchAll(re)) {
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        match: m[0],
        index: m.index ?? 0,
        why: rule.why,
      });
    }
  }
  // Keep the earliest match where rules overlap ("within 24 hours" over "24 hours").
  const kept: LintFinding[] = [];
  for (const f of findings.sort(
    (a, b) => a.index - b.index || b.match.length - a.match.length,
  )) {
    const last = kept[kept.length - 1];
    if (last && f.index < last.index + last.match.length) continue;
    kept.push(f);
  }
  return kept;
}

/**
 * R-8 / D-042: review cycles are provider facts. Any "every N months/weeks/
 * years" in tailored text must be one of the document's cycles; a sentence
 * about a register must use the register cycle, one about the policy,
 * procedure, plan or document must use the policy cycle.
 */
export type ReviewCycles = { policyMonths: number; registerMonths: number };

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function monthsOf(count: string, unit: string): number | null {
  const n = /^\d+$/.test(count)
    ? Number(count)
    : (WORD_NUMBERS[count.toLowerCase()] ?? (count === "" ? 1 : null));
  if (n === null) return null;
  if (/^year/.test(unit)) return n * 12;
  if (/^month/.test(unit)) return n;
  if (/^week/.test(unit)) return Math.round((n * 7) / 30.4);
  return null;
}

/** The text between the nearest boundary characters around a match. */
function unitAround(
  text: string,
  index: number,
  length: number,
  boundary: RegExp,
): string {
  let start = index;
  while (start > 0 && !boundary.test(text[start - 1])) start--;
  let end = index + length;
  while (end < text.length && !boundary.test(text[end])) end++;
  return text.slice(start, end);
}

export function lintReviewCycles(
  text: string,
  cycles: ReviewCycles,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const re =
    /\bevery\s+(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+)?(months?|weeks?|years?)\b/gi;
  for (const m of text.matchAll(re)) {
    const months = monthsOf(m[1] ?? "", m[2]);
    if (months === null) continue;
    const at = m.index ?? 0;
    // The unit is the sentence. In a table row (cells joined by " | " in
    // blocksToText) a cycle cell such as "At least every 12 months" has no
    // subject of its own, so the whole row gives the subject.
    const subjectOf = (s: string) => ({
      register: /\bregister/i.test(s),
      policy:
        /\b(?:polic(?:y|ies)|procedure|plan|framework|this document)\b/i.test(
          s,
        ),
    });
    const line = unitAround(text, at, m[0].length, /\n/);
    let { register: aboutRegister, policy: aboutPolicy } = subjectOf(
      unitAround(text, at, m[0].length, /[.\n]/),
    );
    if (!aboutRegister && !aboutPolicy && line.includes(" | "))
      ({ register: aboutRegister, policy: aboutPolicy } = subjectOf(line));
    // Every subject the sentence names must fit the cycle; with no subject any pack value will do.
    const ok =
      (!aboutRegister || months === cycles.registerMonths) &&
      (!aboutPolicy || months === cycles.policyMonths) &&
      (aboutRegister ||
        aboutPolicy ||
        months === cycles.policyMonths ||
        months === cycles.registerMonths);
    if (!ok) {
      findings.push({
        rule: "review-cycle",
        severity: "error",
        match: m[0],
        index: m.index ?? 0,
        why: `use the review cycles given: policy review every ${cycles.policyMonths} months, register review every ${cycles.registerMonths} months; never choose your own`,
      });
    }
  }
  return findings;
}

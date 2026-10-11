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

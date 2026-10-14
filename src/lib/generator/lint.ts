/**
 * Terminology and claims lint for generated text (REQ-005 FR-2 step 4,
 * AC-9). The word lists come from product/domain/house-style.md; the
 * CLAUDE.md 4.3 claim rules are reused from src/lib/claims.ts. Occurrences
 * inside the Commission's own registration class names are ignored, as the
 * house style allows ("except in the Commission's own class names").
 */
import { findProhibitedClaims } from "@/lib/claims";
import {
  canonicalRecordName,
  isCanonicalRecordName,
} from "@/lib/registers/names";

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
      // D-532 (proposed): "carers" next to families, family or unpaid means the
      // participant's own carers, the Commission's phrase, not a worker role.
      if (
        rule.id === "term-worker" &&
        /^carers?$/i.test(m[0]) &&
        isFamilyCarer(scrubbed, m.index ?? 0, m[0].length)
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

function isFamilyCarer(text: string, index: number, length: number): boolean {
  const before = text.slice(Math.max(0, index - 40), index);
  const after = text.slice(index + length, index + length + 20);
  return (
    /\b(?:families?|family|unpaid|informal)\s+(?:and\s+|members\s+and\s+)?$/i.test(
      before,
    ) || /^\s+and\s+famil(?:y|ies)\b/i.test(after)
  );
}

/**
 * R-12 / D-050: a "[Provider to complete: ...]" placeholder that asks for a
 * Practice Standard or quality indicator. The pack either holds the standards
 * or names the obligation the document rests on, so the model never needs one.
 */
export function lintPlaceholders(text: string): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const m of text.matchAll(/\[Provider to complete[^\]]*\]/gi)) {
    if (!/\b(?:standards?|indicators?)\b/i.test(m[0])) continue;
    findings.push({
      rule: "placeholder-standard",
      severity: "error",
      match: m[0],
      index: m.index ?? 0,
      why: "never ask the provider to name a Practice Standard or quality indicator",
    });
  }
  return findings;
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

/**
 * D-049: a timeframe is statutory only when its sentence (its row, in a
 * table) also names the Commission, notifying or reporting, the Rules, or the
 * document's own rules section; otherwise it is the provider's promise.
 */
const STATUTORY_ANCHOR =
  /\b(?:the\s+commission|commission|notif(?:y|ies|ied|ication|ications)|report(?:s|ed|ing|able)?|the\s+rules|rules)\b/i;

export function lintTimeframes(
  text: string,
  options: { anchors?: readonly string[] } = {},
): LintFinding[] {
  const extra = (options.anchors ?? [])
    .filter(Boolean)
    .map((a) => new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  const anchored = (index: number, length: number) => {
    const line = unitAround(text, index, length, /\n/);
    const scope = line.includes(" | ")
      ? line
      : unitAround(text, index, length, /[.\n]/);
    return STATUTORY_ANCHOR.test(scope) || extra.some((re) => re.test(scope));
  };
  const findings: LintFinding[] = [];
  for (const rule of TIMEFRAME_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const m of text.matchAll(re)) {
      if (!anchored(m.index ?? 0, m[0].length)) continue;
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
 * R-8 / D-042 / D-043: review cycles are provider facts. Any "every N months/
 * weeks/years" in a sentence with review wording (review, check, look at)
 * must be one of the document's cycles; a sentence about a register must use
 * the register cycle, one about the policy, procedure, plan or document must
 * use the policy cycle. Cadences without review wording (a statutory monthly
 * report, for example) are R-7's domain and are not checked here.
 */
export type ReviewCycles = { policyMonths: number; registerMonths: number };

const REVIEW_WORDING =
  /\b(?:review(?:s|ed|ing)?|check(?:s|ed|ing)?|look(?:s|ed|ing)?\s+at)\b/i;

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

/**
 * R-9 / D-044: a cross-reference ("section N" or "section N Title") must name
 * a section of this document's outline, and a title given with the number
 * must be that section's heading. The model otherwise quotes the house
 * style's generic structure ("section 3 What we do") in a document whose
 * section 3 is Definitions.
 */
export type OutlineRef = { number: string; heading: string };

export function lintCrossReferences(
  text: string,
  outline: readonly OutlineRef[],
): LintFinding[] {
  const findings: LintFinding[] = [];
  const byNumber = new Map(outline.map((o) => [o.number, o.heading]));
  const list = outline.map((o) => `${o.number} ${o.heading}`).join(", ");
  const advice = `Refer to sections by the number and title in the outline (${list})`;
  // "section N" and whatever follows it on the same line up to the next boundary.
  const re = /\bsections?[ \t]+(\d+)\b([^.;()|\n]*)/gi;
  for (const m of text.matchAll(re)) {
    const number = m[1];
    const rest = m[2].replace(/^[ \t]+/, "");
    const heading = byNumber.get(number);
    // A capitalised run after the number is a title; lowercase prose is not.
    const titled = /^[A-Z]/.test(rest);
    const named = titled
      ? outline.find((o) => startsWithHeading(rest, o.heading))
      : undefined;
    const title = titled
      ? (named?.heading ?? rest.trim().split(/\s+/).slice(0, 5).join(" "))
      : "";
    const match = title ? `section ${number} ${title}` : `section ${number}`;
    if (heading === undefined) {
      findings.push({
        rule: "cross-reference",
        severity: "error",
        match,
        index: m.index ?? 0,
        why: named
          ? `there is no section ${number} in this document; ${named.heading} is section ${named.number}. ${advice}`
          : `there is no section ${number} in this document. ${advice}`,
      });
      continue;
    }
    if (!title || named?.heading === heading) continue;
    findings.push({
      rule: "cross-reference",
      severity: "error",
      match,
      index: m.index ?? 0,
      why: named
        ? `section ${number} is ${heading}; ${named.heading} is section ${named.number}. ${advice}`
        : `section ${number} is ${heading}, and no section is called ${title}. ${advice}`,
    });
  }
  return findings;
}

/** "Reportable incidents for what to report" starts with the heading "Reportable incidents" (word boundary required). */
function startsWithHeading(rest: string, heading: string): boolean {
  const r = rest.toLowerCase();
  const h = heading.toLowerCase();
  return r === h || (r.startsWith(h) && !/[a-z0-9]/.test(r.charAt(h.length)));
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

type Subjects = { register: boolean; policy: boolean };

/** "Policy review register" is a register (the one that records reviews), not the policy. */
function subjectsOf(raw: string): Subjects {
  const s = raw.replace(/\bpolicy[ \t]+review[ \t]+registers?\b/gi, "register");
  return {
    register: /\bregister/i.test(s),
    policy:
      /\b(?:polic(?:y|ies)|procedure|plan|framework|this document)\b/i.test(s),
  };
}

function hasSubject(s: Subjects): boolean {
  return s.register || s.policy;
}

/** The subjects named right after each review verb ("reviews this policy and ...", "looks at the register"). */
function reviewObjects(raw: string): Subjects {
  // The register's own name holds the word "review"; read it as "register" first.
  const text = raw.replace(
    /\bpolicy[ \t]+review[ \t]+registers?\b/gi,
    "register",
  );
  const out = { register: false, policy: false };
  const re =
    /(?<!\b(?:the|a|an|each|this|that|its|our|every|next|at)\s)\b(?:review(?:s|ed|ing)?|check(?:s|ed|ing)?|look(?:s|ed|ing)?\s+at)\s+((?:\s*[\w'-]+){0,6})/gi;
  for (const m of text.matchAll(re)) {
    // The object ends where a recording verb starts: "reviews this policy and
    // updates the register" reviews the policy only.
    const object = m[1].replace(
      /\b(?:records?|updates?|enters?|logs?|writes?|keeps?|files?|stores?|notes?)\b[\s\S]*$/i,
      "",
    );
    const s = subjectsOf(object);
    out.register ||= s.register;
    out.policy ||= s.policy;
  }
  return out;
}

/* ---------- house style version 2 (batch 40, D-544) ---------- */

/** Sentences of a text, in document order with their offsets (tables split per cell). */
function sentencesOf(text: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  const re = /[^.!?\n|]+[.!?]?/g;
  for (const m of text.matchAll(re)) {
    const s = m[0].trim();
    if (s.length > 0) out.push({ text: s, index: m.index ?? 0 });
  }
  return out;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "is",
  "are",
  "be",
  "that",
  "this",
  "their",
  "our",
  "we",
  "its",
  "as",
  "at",
  "each",
  "all",
  "any",
  "it",
  "they",
  "them",
  "from",
  "has",
  "have",
  "will",
]);

function contentWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Version 2 (a): a generated sentence that shares 80 percent or more of its
 * content words with a quality indicator sentence restates the indicator
 * instead of saying what we do ("no work done" to a policy auditor).
 */
export function lintIndicatorRestatement(
  text: string,
  indicators: readonly string[],
  threshold = 0.8,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const indicatorSets = indicators
    .flatMap((i) => sentencesOf(i).map((s) => contentWords(s.text)))
    .filter((w) => w.length >= 5)
    .map((w) => new Set(w));
  if (indicatorSets.length === 0) return findings;
  for (const s of sentencesOf(text)) {
    const words = contentWords(s.text);
    if (words.length < 5) continue;
    for (const set of indicatorSets) {
      const shared = words.filter((w) => set.has(w)).length;
      if (shared / words.length >= threshold) {
        findings.push({
          rule: "indicator-restatement",
          severity: "error",
          match: s.text.slice(0, 80),
          index: s.index,
          why: "restates a quality indicator; say what we do, which role, by when, on which record",
        });
        break;
      }
    }
  }
  return findings;
}

const VAGUE_TIME =
  /\b(?:timely|promptly|as\s+soon\s+as\s+practicable|as\s+soon\s+as\s+possible|regularly|periodically|appropriate(?:ly)?|without\s+delay|in\s+good\s+time)\b/gi;
const NUMBER_NEAR =
  /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty)\b|\b(?:same\s+day|end\s+of\s+(?:the\s+)?shift|before\s+the\s+end)\b/i;

/**
 * Version 2 (c): a vague time word without a number within six words either
 * side fails; "within 24 hours", "every 12 months", "the same day" pass.
 */
export function lintVagueTime(text: string): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const m of text.matchAll(VAGUE_TIME)) {
    const at = m.index ?? 0;
    const before = text.slice(0, at).split(/\s+/).slice(-6).join(" ");
    const after = text
      .slice(at + m[0].length)
      .split(/\s+/)
      .slice(0, 7)
      .join(" ");
    if (NUMBER_NEAR.test(before) || NUMBER_NEAR.test(after)) continue;
    findings.push({
      rule: "vague-time",
      severity: "error",
      match: m[0],
      index: at,
      why: 'give a number: "within 24 hours", "before the end of the shift", "every 12 months"',
    });
  }
  return findings;
}

/**
 * Version 2 (b): "staff" as an actor fails; "staff" inside a name the pack
 * uses (the staff matrix, a class name passed as an allowed phrase) passes.
 */
export function lintStaffActor(
  text: string,
  options: { allowedPhrases?: readonly string[] } = {},
): LintFinding[] {
  let scrubbed = text.replace(/\bstaff\s+matrix\b/gi, (m) =>
    " ".repeat(m.length),
  );
  for (const phrase of options.allowedPhrases ?? []) {
    if (!phrase) continue;
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    scrubbed = scrubbed.replace(re, (m) => " ".repeat(m.length));
  }
  const findings: LintFinding[] = [];
  for (const m of scrubbed.matchAll(/\b(?:staff|the\s+team|someone)\b/gi)) {
    findings.push({
      rule: "staff-actor",
      severity: "error",
      match: m[0],
      index: m.index ?? 0,
      why: "name the role from the responsibilities table (the owner, the worker on shift, the team leader), never staff, the team or someone",
    });
  }
  return findings;
}

/**
 * Version 2 (d): a named record ("the X register", "the Y form", "the Z
 * checklist") must be one the pack or the Readyline registers hold, by its
 * exact name (case does not matter). The known list comes from the
 * catalogue's document titles, the registers list and the fixed forms.
 */
export function lintRecordNames(
  text: string,
  known: readonly string[],
): LintFinding[] {
  const set = new Set(known.map((k) => k.toLowerCase().trim()));
  const findings: LintFinding[] = [];
  // The name runs from the nearest determiner to the keyword; a word that is itself a determiner ends the search.
  const re =
    /\b(?:the|our|a|an|this|each|its)\s+((?:(?!(?:the|our|a|an|this|each|its)\s)[a-z][\w'-]*\s+){0,6}?(?:register|form|checklist|matrix|log|record of decisions|template))\b/gi;
  for (const m of text.matchAll(re)) {
    const name = m[1].toLowerCase().replace(/\s+/g, " ").trim();
    if (/^(?:register|form|checklist|matrix|log|template)$/.test(name))
      continue;
    // Batch 42 item 2 (D-547): the canonical spelling only. A phrase that
    // ends with a known name passes ("our own incident register") unless
    // that name is a listed alias, which fails with the fix in the reason;
    // an unknown name fails with the general rule.
    const known = tail(name, set);
    if (
      known !== null &&
      (isCanonicalRecordName(known) || canonicalRecordName(known) === null)
    )
      continue;
    const fix = canonicalRecordName(known ?? name);
    findings.push({
      rule: "record-name",
      severity: "error",
      match: m[1],
      index: (m.index ?? 0) + m[0].length - m[1].length,
      why: fix
        ? `write "${fix}", the name this pack and the Readyline registers use`
        : "name only a register, form or document that exists in this pack or in the Readyline registers, by its exact name",
    });
  }
  return findings;
}

/** The longest known name a phrase ends with, or null. */
function tail(name: string, set: ReadonlySet<string>): string | null {
  let best: string | null = null;
  for (const k of set)
    if (
      (name === k || name.endsWith(` ${k}`)) &&
      (!best || k.length > best.length)
    )
      best = k;
  return best;
}

/**
 * Australian phone numbers as prose writes them: 10 digits starting with 0
 * (02 9999 9999, 0412 345 678, (02) 9999 9999), +61 forms, 1800 and 1300
 * numbers, and 13 xx xx numbers. A class code (0115), a year or an ABN
 * without a leading 0 or 61 do not match.
 */
const PHONE =
  /\(0\d\)[\s-]?\d{4}[\s-]?\d{4}\b|\b0\d(?:[\s-]?\d){8}\b|\+61[\s-]?\d(?:[\s-]?\d){8}\b|\b1[38]00[\s-]?\d{3}[\s-]?\d{3}\b|\b13[\s-]?\d{1,2}[\s-]?\d{2,3}\b/g;
const EMAIL = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
const URL =
  /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:gov\.au|com\.au|org\.au|net\.au|edu\.au|com|org|net|au|gov)(?:\/[^\s)]*)?\b/gi;

type ContactKind = "phone" | "email" | "url";

/** The same string, written for comparison: no spaces, brackets or dashes, no scheme, no www, no trailing slash, lower case. */
function normaliseContact(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[\s\-()]+/g, "")
    .replace(/\/+$/, "");
}

/** Every phone number, email address and web address in a text, in order, without overlaps. */
export function contactStringsIn(
  text: string,
): { kind: ContactKind; value: string; index: number }[] {
  const all: { kind: ContactKind; value: string; index: number }[] = [];
  for (const [kind, re] of [
    ["email", EMAIL],
    ["url", URL],
    ["phone", PHONE],
  ] as const)
    for (const m of text.matchAll(new RegExp(re.source, re.flags)))
      all.push({ kind, value: m[0], index: m.index ?? 0 });
  all.sort((a, b) => a.index - b.index || b.value.length - a.value.length);
  const out: typeof all = [];
  let end = -1;
  for (const c of all) {
    if (c.index < end) continue;
    out.push(c);
    end = c.index + c.value.length;
  }
  return out;
}

/**
 * Batch 42 item 1 (D-546): a tailored section may not carry a phone number,
 * an email address or a web address unless the same string is in the pack's
 * fixed text or the FACTS block; the Commission's details live in the fixed
 * contact block and a recorded reply once quoted them from memory.
 */
export function lintContactDetails(
  text: string,
  allowed: readonly string[],
): LintFinding[] {
  const ok = new Set(allowed.map(normaliseContact));
  return contactStringsIn(text)
    .filter((c) => !ok.has(normaliseContact(c.value)))
    .map((c) => ({
      rule: "contact-details",
      severity: "error" as const,
      match: c.value,
      index: c.index,
      why: `a ${c.kind === "url" ? "web address" : c.kind === "email" ? "email address" : "phone number"} the pack does not supply; refer to the fixed section "How to contact the Commission" by its heading, or leave a [phone or email] blank for the provider's own`,
    }));
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
    const line = unitAround(text, at, m[0].length, /\n/);
    const sentence = unitAround(text, at, m[0].length, /[.\n]/);
    const isRow = line.includes(" | ");
    // D-043: only review wording is a review cycle (the row counts for a table).
    if (!REVIEW_WORDING.test(isRow ? line : sentence)) continue;
    // The unit is the sentence, cut at a cell boundary in a table row. The
    // subject of a mention is what the unit names between the previous mention
    // and this one (after the last ";", "," or ":"), else what follows it up to
    // the next mention ("every 12 months for the plan"), else the object of the
    // review verbs in the sentence, then in the row. With no subject anywhere,
    // either pack value will do.
    const unit = unitAround(text, at, m[0].length, isRow ? /[.|\n]/ : /[.\n]/);
    const unitStart = text.indexOf(unit, Math.max(0, at - unit.length));
    const offset = Math.max(0, at - unitStart);
    const before = unit.slice(0, offset);
    const after = unit.slice(offset + m[0].length);
    const prior = [...before.matchAll(re)].pop();
    const spanBefore = (
      prior ? before.slice((prior.index ?? 0) + prior[0].length) : before
    ).replace(/^[\s\S]*[;,:]/, "");
    // A non-global clone: String.match with a /g regex gives no index.
    const next = new RegExp(re.source, "i").exec(after);
    const spanAfter = next ? after.slice(0, next.index) : after;
    let subjects = subjectsOf(spanBefore);
    if (!hasSubject(subjects)) subjects = subjectsOf(spanAfter);
    if (!hasSubject(subjects)) subjects = reviewObjects(sentence);
    if (!hasSubject(subjects) && isRow) subjects = reviewObjects(line);
    const { register: aboutRegister, policy: aboutPolicy } = subjects;
    // Every subject named must fit the cycle; with no subject any pack value will do.
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

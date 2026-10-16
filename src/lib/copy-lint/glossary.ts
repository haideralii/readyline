/**
 * The glossary term match (REQ-027 FR-2, D-2705, D-2710, D-2714, D-2724),
 * pure over text so the copy lint and the e2e render check share one table:
 * which words count as which glossary term, which phrases are not a term at
 * all, and how a bracket's rendered meaning is kept out of "present".
 *
 * The forms are data (FR-2): a noun and its plural, the verb forms of
 * "adopt", and for the worker screening check the clearance's four forms.
 * "standards" alone, "modular" and "class" are not matches; "worker
 * screening" alone is not a match. Phrase exclusions run before the
 * whole-word match: the Commission's "NDIS Worker Orientation Module" is a
 * course, not a Practice Standards module (decision 3 of the fourth pass).
 */
import { glossaryContent, glossaryTerm } from "@/lib/questionnaire/content";

export type GlossaryForms = {
  id: string;
  /** Whole-word, case-insensitive forms that count as the term. */
  forms: readonly string[];
  /** Phrases removed from the text before the match, case-insensitive. */
  exclusions?: readonly string[];
};

export const GLOSSARY_FORMS: readonly GlossaryForms[] = [
  {
    id: "verification-audit",
    forms: ["verification audit", "verification audits"],
  },
  {
    id: "certification-audit",
    forms: ["certification audit", "certification audits"],
  },
  {
    id: "practice-standards",
    forms: ["practice standard", "practice standards"],
  },
  {
    id: "module",
    forms: ["module", "modules"],
    // Finding 116, 155: the Commission's e-learning course, in any case.
    exclusions: ["ndis worker orientation module", "orientation module"],
  },
  {
    id: "quality-indicator",
    forms: ["quality indicator", "quality indicators"],
  },
  {
    id: "registration-group",
    forms: ["registration group", "registration groups"],
  },
  { id: "mid-term-audit", forms: ["mid-term audit", "mid-term audits"] },
  {
    id: "restrictive-practice",
    forms: ["restrictive practice", "restrictive practices"],
  },
  { id: "key-personnel", forms: ["key personnel"] },
  { id: "self-assessment", forms: ["self-assessment", "self-assessments"] },
  {
    id: "worker-screening-check",
    // Finding 117, 169 (decision 4): the check and the clearance it gives, in any case.
    forms: [
      "ndis worker screening check",
      "ndis worker screening checks",
      "ndis worker screening clearance",
      "ndis worker screening clearances",
      "worker screening clearance",
      "worker screening clearances",
    ],
  },
  {
    id: "reportable-incident",
    forms: ["reportable incident", "reportable incidents"],
  },
  { id: "adopt", forms: ["adopt", "adopts", "adopted", "adopting"] },
];

/** The two audit ids a template-literal `${kind}-audit` reaches (finding 48). */
export const AUDIT_IDS = ["verification-audit", "certification-audit"] as const;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word: no letter, digit or hyphen on either side. */
function wholeWord(form: string): RegExp {
  return new RegExp(`(?<![\\w-])${escape(form)}(?![\\w-])`, "gi");
}

/** The text with every exclusion phrase blanked, so "orientation module" never reads as "module". */
export function withoutExclusions(text: string): string {
  let out = text;
  for (const g of GLOSSARY_FORMS)
    for (const phrase of g.exclusions ?? [])
      out = out.replace(wholeWord(phrase), " ");
  return out;
}

/**
 * The glossary ids present in `text`, in the order they first appear
 * (FR-3's order), after the exclusions; `skip` is the test's `VERIFY_TERMS`
 * list (D-2705). Matching is case-insensitive and whole-word.
 */
export function findGlossaryTerms(
  text: string,
  options: { skip?: readonly string[] } = {},
): string[] {
  const clean = withoutExclusions(text);
  const first = new Map<string, number>();
  for (const g of GLOSSARY_FORMS) {
    if (options.skip?.includes(g.id)) continue;
    let at = Number.POSITIVE_INFINITY;
    for (const form of g.forms) {
      const m = wholeWord(form).exec(clean);
      if (m && m.index < at) at = m.index;
    }
    if (at !== Number.POSITIVE_INFINITY) first.set(g.id, at);
  }
  return [...first.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

/**
 * D-2714, D-2724: a bracket's rendered text, `term (meaning)`, is removed
 * before the term pass, so the meaning's own glossary words never make a
 * term "present"; the meaning is then sought in the full text. Both the
 * component's bracket and a token's plain-text bracket read the same.
 */
export function stripGlossaryBrackets(text: string): string {
  let out = text;
  for (const g of glossaryContent.items) {
    const t = glossaryTerm(g.id);
    out = out.replace(
      new RegExp(`${escape(t.term)}\\s*\\(${escape(t.meaning)}\\)`, "gi"),
      " ",
    );
  }
  return out;
}

/** Every `{{glossary:<id>}}` token in a text, in order (D-2715: allowed on a one-term page alone). */
export function glossaryTokens(text: string): string[] {
  return [...text.matchAll(/\{\{glossary:([a-z0-9-]+)\}\}/g)].map((m) => m[1]);
}

/** True when the page's text carries the term's meaning (the sentence or the clause), case-insensitive (AC-3's "has its meaning"). */
export function hasMeaning(text: string, id: string): boolean {
  const meaning = glossaryTerm(id).meaning.toLowerCase();
  return text.toLowerCase().includes(meaning);
}

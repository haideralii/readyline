/**
 * Filling the blanks from account facts (REQ-017 FR-2, D-1702). A blank in a
 * document ("[name]", "[phone or email]") names a fact; the same fact may
 * be asked for in thirty documents, so the "Finish your pack" form asks
 * once per fact key, in plain words with an example, and every document is
 * re-rendered with the answers. A blank the closed list does not know is
 * asked for by its own text and keyed from it. Pure: the server stores the
 * answers, this module maps and applies them.
 */
import { BLANK, collectBlanks, type DocumentBlank } from "./blanks";
import type { DocumentModel, ResolvedSection } from "./document-model";
import type { Block } from "./section-schema";

export type FactQuestion = {
  key: string;
  /** The blank text as it appears in the documents, for example "[name]". */
  blank: string;
  question: string;
  example: string;
  /** Short topic for the desktop grouping. */
  topic: "people" | "contact" | "dates" | "business" | "other";
  /** Rules the server applies to the answer. */
  kind: "text" | "date";
};

/** The closed list: blank text (without brackets, lower case) to the question a support worker can answer. */
const KNOWN: Record<string, Omit<FactQuestion, "key" | "blank">> = {
  name: {
    question: "Who is responsible for your policies?",
    example: "The owner's name, for example Jane Citizen.",
    topic: "people",
    kind: "text",
  },
  role: {
    question: "What is their role in the business?",
    example: "For example Owner, or Director.",
    topic: "people",
    kind: "text",
  },
  "phone or email": {
    question: "How do workers reach that person?",
    example: "A phone number or an email address, for example 0400 000 000.",
    topic: "contact",
    kind: "text",
  },
  date: {
    question: "What date will you approve these documents?",
    example: "Today's date is fine, for example 14 October 2026.",
    topic: "dates",
    kind: "date",
  },
  period: {
    question: "How long do you keep records?",
    example:
      "The Rules require 7 years for incident and complaint records; 7 years is the usual answer for everything else.",
    topic: "business",
    kind: "text",
  },
  "notice period": {
    question:
      "How much notice does either side give to end a service agreement?",
    example: "For example 14 days.",
    topic: "business",
    kind: "text",
  },
  location: {
    question: "Where do you keep your records?",
    example: "For example a locked cabinet at home, or Google Drive.",
    topic: "business",
    kind: "text",
  },
  "owner role": {
    question: "What is the owner's role called?",
    example: "For example Owner, or Director.",
    topic: "people",
    kind: "text",
  },
  "other tool": {
    question: "Which other digital tool do you use, if any?",
    example: "For example a rostering app. Write None if there is none.",
    topic: "business",
    kind: "text",
  },
  "allowed use": {
    question: "What do you use that tool for?",
    example: "For example rostering and timesheets.",
    topic: "business",
    kind: "text",
  },
  limits: {
    question: "What must that tool never be used for?",
    example: "For example participant notes.",
    topic: "business",
    kind: "text",
  },
  state: {
    question: "Which state or territory are you in?",
    example: "For example New South Wales.",
    topic: "business",
    kind: "text",
  },
};

/** Blanks a provider fills by hand in the signed copy, not facts about the business. */
const NOT_A_FACT = new Set([
  "signature",
  "date reported",
  "participant reference",
  "easy read version",
]);

/** Blanks that are row templates in registers and forms (one per entry), never account facts. */
const TEMPLATE_PATTERNS: readonly RegExp[] = [
  /^(?:c|p|inc|cmp|w)-\d+$/i,
  /^yes \/ no$/i,
  /^not started/i,
  /^(?:code|summary|notes|who|purpose|tools|risk|treatment|owner|summary and actions|outcome; what we changed|source|what we changed|nature of the conflict|steps agreed|review date|name and role|low \/ medium \/ high|practice|authorisation reference|time|duration|other training|number|ndis worker screening clearance)$/i,
  /^(?:name|date|role)\] \[/i,
];

/**
 * Facts the account holds rather than the Finish your pack form (D-541 as
 * amended, batch 37): the owner's name and role come from the account page,
 * the approval date from the day a group is adopted. The form never asks
 * for them. REQ-029 (D-2854, D-2855): the three fixed blanks in every
 * document (approver, approval date, change-log author) and the
 * responsibilities "[role]" fill from the adoption snapshot alone
 * (`applyAdoption`), never from the live account; `date` is no longer
 * written as a fact, and a row that exists is ignored.
 */
export const ACCOUNT_FACT_KEYS: ReadonlySet<string> = new Set([
  "name",
  "role",
  "owner-role",
  "date",
]);

export function isAccountFactKey(key: string): boolean {
  return ACCOUNT_FACT_KEYS.has(key);
}

/**
 * The key of a blank the Finish form asks for, or null: a fact blank whose
 * key the account does not hold. One rule for the form's questions, the
 * next-step strip's count and the set page's count, so they can never
 * disagree (run 38599190033: the strip counted the approval date, which
 * waits for adoption, and held the step at finish after the form had
 * nothing left to ask).
 */
export function formFactKeyFor(blank: string): string | null {
  const key = factKeyFor(blank);
  return key !== null && !isAccountFactKey(key) ? key : null;
}

/** The blanks the Finish form can ask for, in order, from a set's blanks. */
export function formBlanks<T extends { blank: string }>(
  blanks: readonly T[],
): T[] {
  return blanks.filter((b) => formFactKeyFor(b.blank) !== null);
}

/** The form's questions: every fact except the ones the account holds. */
export function formQuestionsFor(
  blanks: readonly DocumentBlank[],
): FactQuestion[] {
  return questionsFor(formBlanks(blanks));
}

export function factKeyFor(blank: string): string | null {
  const inner = blank
    .replace(/^\[|\]$/g, "")
    .trim()
    .toLowerCase();
  if (NOT_A_FACT.has(inner)) return null;
  // A whole-section placeholder is a sentence, not a fact (S-8: a blank is a few words).
  if (/[.?!]$/.test(inner) || inner.split(/\s+/).length > 6) return null;
  if (TEMPLATE_PATTERNS.some((re) => re.test(inner))) return null;
  if (KNOWN[inner]) return inner.replace(/[^a-z0-9]+/g, "-");
  // An unknown blank becomes its own question, keyed from its text.
  const key = inner.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return key.length >= 2 && key.length <= 40 ? key : null;
}

/** One question per fact key, in the order the blanks appear across the set. */
export function questionsFor(blanks: readonly DocumentBlank[]): FactQuestion[] {
  const out: FactQuestion[] = [];
  const seen = new Set<string>();
  for (const b of blanks) {
    const key = factKeyFor(b.blank);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const inner = b.blank
      .replace(/^\[|\]$/g, "")
      .trim()
      .toLowerCase();
    const known = KNOWN[inner];
    out.push({
      key,
      blank: b.blank,
      question:
        known?.question ?? `What goes where the documents say ${b.blank}?`,
      example: known?.example ?? "A few words are enough.",
      topic: known?.topic ?? "other",
      kind: known?.kind ?? "text",
    });
  }
  return out;
}

/** The blank a provider fills by hand per participant; a "[name]" in its sentence is the participant's representative, never the owner (REQ-029 FR-7). */
const PARTICIPANT_REFERENCE = "[participant reference]";

/** The sentence around `index` in `text`: from the last sentence end before it to the next one after it. */
function sentenceAround(text: string, index: number): string {
  const ends = /[.!?](?:\s|$)/g;
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(ends)) {
    const at = m.index + 1;
    if (at <= index) start = at;
    else {
      end = at;
      break;
    }
  }
  return text.slice(start, end);
}

/**
 * Replaces every blank whose fact is known; the rest stay bracketed.
 * REQ-029 FR-7 (D-2855): a "[name]" that shares its sentence with
 * "[participant reference]" names the participant's representative, so it
 * is a Word blank and is never filled with the owner's name.
 */
export function fillText(
  text: string,
  facts: Readonly<Record<string, string>>,
): string {
  const hasParticipant = text.includes(PARTICIPANT_REFERENCE);
  return text.replace(BLANK, (blank, offset: number) => {
    const key = factKeyFor(blank);
    if (
      hasParticipant &&
      key === "name" &&
      sentenceAround(text, offset).includes(PARTICIPANT_REFERENCE)
    )
      return blank;
    const value = key ? facts[key] : undefined;
    return value && value.trim() ? value.trim() : blank;
  });
}

/**
 * REQ-029 FR-3(a), D-2855: the live fill from the account. The approver's
 * name and role and the approval date are never filled from the live
 * account (they are the adoption snapshot's, `applyAdoption`); every other
 * saved fact (how workers reach the approver, the AI-appendix answers, the
 * business facts) fills at read time.
 */
export function liveFacts(
  facts: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(facts))
    if (!isAccountFactKey(key) && value.trim()) out[key] = value;
  return out;
}

/** The model with the live facts filled and the snapshot's blanks left bracketed. */
export function applyLiveFacts(
  model: DocumentModel,
  facts: Readonly<Record<string, string>>,
): DocumentModel {
  return applyFacts(model, liveFacts(facts));
}

/**
 * REQ-029 FR-10: a form blank is open until `account_facts` holds its key.
 * The stored model keeps its brackets from this REQ on, so the count the
 * set page, the adopt gate and the strip share reads the facts, not the
 * text. One entry per blank occurrence, as `formBlanks` gives them.
 */
export function openFormBlanks<T extends { blank: string }>(
  blanks: readonly T[],
  facts: Readonly<Record<string, string>>,
): T[] {
  return formBlanks(blanks).filter((b) => {
    const key = formFactKeyFor(b.blank);
    return !(key && facts[key]?.trim());
  });
}

/** REQ-029 FR-1: the details page's order; a key the set uses that is not here follows in reading order. */
export const DETAILS_ORDER: readonly string[] = [
  "name",
  "role",
  "phone-or-email",
  "state",
  "period",
  "location",
  "notice-period",
  "other-tool",
  "allowed-use",
  "limits",
];

/** D-2862, D-2879: "None" for the other tool fills the three AI-appendix keys with the house-style no-tool row. */
export const NO_TOOL_FACTS: Readonly<Record<string, string>> = {
  "other-tool": "No other digital tool",
  "allowed-use": "Not applicable",
  limits: "If we start using one, we add it to this table first",
};

/** The four free-text keys the detector's name part runs on (SR-1, D-2860); the rest hold the owner's own details. */
export const FREE_TEXT_FACT_KEYS: ReadonlySet<string> = new Set([
  "other-tool",
  "allowed-use",
  "limits",
  "location",
]);

/** SR-6: a value may not carry square brackets or control characters, so it is never read as a blank. */
export const FACT_VALUE_FORBIDDEN = /[[\]\u0000-\u001f\u007f]/;
export function isFactValueAllowed(value: string): boolean {
  return !FACT_VALUE_FORBIDDEN.test(value);
}

function questionForKey(key: string): FactQuestion {
  const inner = key.replace(/-/g, " ");
  const known = KNOWN[inner];
  return {
    key,
    blank: `[${inner}]`,
    question:
      known?.question ?? `What goes where the documents say [${inner}]?`,
    example: known?.example ?? "A few words are enough.",
    topic: known?.topic ?? "other",
    kind: known?.kind ?? "text",
  };
}

/**
 * REQ-029 FR-1 (D-2854): the details page's questions, every fact key the
 * set's blanks use, once each, in `DETAILS_ORDER` then reading order; the
 * approver's name and role always (adoption needs them, FR-5); never the
 * date, which is the adoption day, and never the owner-role mirror.
 */
export function detailsQuestionsFor(
  blanks: readonly DocumentBlank[],
): FactQuestion[] {
  const byKey = new Map<string, FactQuestion>();
  for (const q of questionsFor(blanks))
    if (q.key !== "date" && q.key !== "owner-role") byKey.set(q.key, q);
  for (const key of ["name", "role"])
    if (!byKey.has(key)) byKey.set(key, questionForKey(key));
  const ordered: FactQuestion[] = [];
  for (const key of DETAILS_ORDER) {
    const q = byKey.get(key);
    if (q) {
      ordered.push(q);
      byKey.delete(key);
    }
  }
  return [...ordered, ...byKey.values()];
}

function fillBlock(
  block: Block,
  facts: Readonly<Record<string, string>>,
): Block {
  switch (block.type) {
    case "paragraph":
    case "callout":
      return { ...block, text: fillText(block.text, facts) };
    case "bullets":
    case "steps":
      return { ...block, items: block.items.map((i) => fillText(i, facts)) };
    case "table":
      return {
        ...block,
        rows: block.rows.map((r) => r.map((c) => fillText(c, facts))),
      };
  }
}

/** The model with every known blank filled in (AC-2: a second pack carries the facts too). */
export function applyFacts(
  model: DocumentModel,
  facts: Readonly<Record<string, string>>,
): DocumentModel {
  if (Object.keys(facts).length === 0) return model;
  const sections: ResolvedSection[] = model.sections.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => fillBlock(b, facts)),
  }));
  return { ...model, sections };
}

/** Blanks still open after the facts are applied, for the count and the form. */
export function remainingBlanks(
  model: DocumentModel,
  facts: Readonly<Record<string, string>>,
): DocumentBlank[] {
  return collectBlanks(applyFacts(model, facts)).filter((b) =>
    Boolean(factKeyFor(b.blank)),
  );
}

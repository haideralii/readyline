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
    example: "Most providers write 7 years.",
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

/** Replaces every blank whose fact is known; the rest stay bracketed. */
export function fillText(
  text: string,
  facts: Readonly<Record<string, string>>,
): string {
  return text.replace(BLANK, (blank) => {
    const key = factKeyFor(blank);
    const value = key ? facts[key] : undefined;
    return value && value.trim() ? value.trim() : blank;
  });
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

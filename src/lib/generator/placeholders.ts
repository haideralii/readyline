/**
 * What a customer reads where a section is not yet drafted (REQ-016 FR-0a).
 * The catalogue's `brief` is the model's instruction and never reaches a
 * document; these placeholders are written for the provider in the ui-copy
 * voice, by section id, with one generic line for any other section. The
 * lint below fails a rendered document that carries instruction phrasing
 * inside a placeholder, which is how Haider's pack leaked "Never restate
 * statutory timeframes" (D-540).
 */
import type { SectionSpec } from "./catalogue";

/** By outline section id. Each is one complete bracketed line, no verb in the imperative, no reference to the generator. */
const BY_SECTION: Record<string, string> = {
  purpose:
    "[Two sentences: what this document is for and which standard or rule it supports.]",
  scope:
    "[Who and what this document covers: your supports, where you work, and who works for you.]",
  "policy-statement":
    "[Your commitments, one for each thing an auditor looks for.]",
  "how-we-do-this": "[The steps you follow, and who does each one.]",
  responsibilities: "[A table of each role and what it does.]",
  "when-this-applies": "[The situations this procedure applies to.]",
  steps: "[The numbered steps, with who does each one and by when.]",
  context: "[What your business looks like and what this plan protects.]",
  "risks-and-scenarios": "[The situations this plan prepares for.]",
  actions: "[What you do before, during and after each situation.]",
  parties: "[Who the agreement is between.]",
  body: "[The terms of the agreement.]",
  introduction: "[What the Code of Conduct means for your workers.]",
  "our-expectations": "[What you expect of every worker.]",
  principles: "[The principles your practice rests on.]",
  structure: "[How practice governance is organised in your business.]",
  processes: "[The processes that keep practice safe and consistent.]",
  summary: "[A short summary of where you stand against each standard.]",
  "how-we-meet": "[How you meet each standard, in your own words.]",
  "plain-language-summary":
    "[In plain words: what this document means for you, what you can expect from us, and who to talk to.]",
};

/** The one line a customer sees for an undrafted section. */
export function placeholderFor(
  spec: Pick<SectionSpec, "id" | "heading" | "placeholder">,
): string {
  if (spec.placeholder) return spec.placeholder;
  return (
    BY_SECTION[spec.id] ??
    `[Your text for "${spec.heading}", in your own words.]`
  );
}

/** Instruction phrasing that belongs to the generator, never to a document (FR-0a). */
const INSTRUCTION_PHRASES: readonly RegExp[] = [
  /\bNever\b/,
  /\bDo not\b/,
  /\bthe outline\b/i,
  /\bfixed facts?\b/i,
  /\bPractice Standards?\b.*\b(?:ask|name|cite)/i,
  /\b(?:ask|name|cite)\b.*\bPractice Standards?\b/i,
  /\bquality[- ]indicator column\b/i,
  /\bsection brief\b/i,
  /\breply with\b/i,
  /\bJSON\b/,
  /\bcould not be drafted automatically\b/i,
];

export type InstructionLeak = { placeholder: string; phrase: string };

/**
 * Every bracketed placeholder in the text that carries instruction phrasing.
 * Applied to rendered documents in tests and to every fallback.
 */
export function findInstructionLeaks(text: string): InstructionLeak[] {
  const out: InstructionLeak[] = [];
  for (const m of text.matchAll(/\[[^\]]{1,600}\]/g)) {
    for (const re of INSTRUCTION_PHRASES) {
      const hit = m[0].match(re);
      if (hit) {
        out.push({ placeholder: m[0].slice(0, 120), phrase: hit[0] });
        break;
      }
    }
  }
  return out;
}

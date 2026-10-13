/**
 * Fill-in-the-blank placeholders (REQ-016 S-8, D-541): a missing fact sits
 * inside a complete sentence as a bracketed blank of at most four words
 * naming the fact ("[name]", "[phone or email]"), never an instruction and
 * never a question. This module finds the blanks in a document so the set
 * page, the readiness summary and the "Finish your pack" page can list
 * them, and lints a text for blanks that break the rule.
 */
import type { DocumentModel } from "./document-model";
import { blocksToText } from "./section-schema";

export const BLANK = /\[[^\][\n]{1,80}\]/g;
export const BLANK_MAX_WORDS = 6;

/**
 * Verbs in the imperative that turn a blank into an instruction. Words that
 * name a fact as a noun ([name], [state], [record], [date]) are not here.
 */
const IMPERATIVE =
  /^(?:add|insert|enter|describe|complete|write|provide|choose|fill|attach|confirm|give|include|tick|sign|check|explain|specify|identify|select|put|pick|tell|leave|replace|delete|remove)\b/i;

/** Markers that are not blanks for the provider to fill. */
const NOT_A_BLANK = /^\[(?:Signature|Date)\]$/;

export type BlankFinding = {
  blank: string;
  reason: "too-long" | "imperative" | "question";
};

/** The blanks in a text that break S-8. */
export function lintBlanks(text: string): BlankFinding[] {
  const out: BlankFinding[] = [];
  for (const m of text.matchAll(BLANK)) {
    const inner = m[0].slice(1, -1).trim();
    // Words, not separators: "[Not started / In progress / Met]" is five words.
    const words = inner.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
    if (words.length > BLANK_MAX_WORDS)
      out.push({ blank: m[0], reason: "too-long" });
    else if (IMPERATIVE.test(inner.replace(/^[^a-z]*/i, "")))
      out.push({ blank: m[0], reason: "imperative" });
    else if (/\?$/.test(inner)) out.push({ blank: m[0], reason: "question" });
  }
  return out;
}

export type DocumentBlank = {
  typeId: string;
  title: string;
  sectionNumber: string;
  sectionHeading: string;
  blank: string;
};

/** Every blank in a document, in reading order, with the section it sits in. */
export function collectBlanks(model: DocumentModel): DocumentBlank[] {
  const out: DocumentBlank[] = [];
  for (const section of model.sections) {
    const text = blocksToText(section.blocks);
    for (const m of text.matchAll(BLANK)) {
      if (NOT_A_BLANK.test(m[0])) continue;
      out.push({
        typeId: model.typeId,
        title: model.title,
        sectionNumber: section.number,
        sectionHeading: section.heading,
        blank: m[0],
      });
    }
  }
  return out;
}

/** Sections of a document that carry at least one blank for the provider (FR-0c: what "marked for your input" counts). */
export function sectionsWithBlanks(model: DocumentModel): number {
  return model.sections.filter((s) =>
    [...blocksToText(s.blocks).matchAll(BLANK)].some(
      (m) => !NOT_A_BLANK.test(m[0]),
    ),
  ).length;
}

/**
 * The plain-words summary's review state (REQ-033 Session C FR-C1 to FR-C5;
 * D-2977 to D-2982). Pure: whether a changed section puts the state on the
 * new version, the line and the words the pages show, the change-log texts.
 * The actions and the register read these; nothing here writes.
 */
import {
  documentTypeById,
  sectionsFor,
  type DocumentTypeSpec,
} from "@/lib/generator/catalogue";
import { sectionNumbers } from "@/lib/generator/document-model";
import { formatDateAu } from "@/lib/generator/fixed-text";

export const SUMMARY_SECTION_ID = "plain-language-summary";
export const EASY_READ_SECTION_ID = "easy-read";

/** FR-C5: the state's label; no "compliant", "closed" or "resolved" anywhere here. */
export const SUMMARY_CHECK_LABEL = "Summary to check";
export const SUMMARY_CONFIRM_LABEL = "The summary is still right";
export const SUMMARY_REDRAFT_LABEL = "Redraft the summary";
/** FR-C3 (D-2980): asks; asserts nothing about the provider's own Easy Read document. */
export const EASY_READ_CHECK_LINE =
  "If you keep an Easy Read version, check it too.";
/** FR-C2: above the two buttons on the document's page. */
export const SUMMARY_CHECK_INTRO =
  "A section of this document changed. Read the plain-words summary again: redraft it with the change as context, or record that it is still right. Either is your act, with your role and the day.";

export type SummaryCheck = {
  /** The section that changed (never the summary itself). */
  sectionId: string;
  on: string;
};

/**
 * FR-C1 (D-2977): the state a new version takes when `changedSectionId` was
 * replaced or re-generated: set when the document carries the summary and
 * the changed section is another one; null for a document without the
 * summary and for the summary's own redraft.
 */
export function summaryCheckFor(
  type: DocumentTypeSpec,
  changedSectionId: string,
  today: string,
): SummaryCheck | null {
  if (changedSectionId === SUMMARY_SECTION_ID) return null;
  const sections = sectionsFor(type);
  if (!sections.some((s) => s.id === SUMMARY_SECTION_ID)) return null;
  if (!sections.some((s) => s.id === changedSectionId)) return null;
  return { sectionId: changedSectionId, on: today };
}

/** The changed section's number and heading as the document renders them; "" and the id when unknown. */
export function changedSectionLabel(
  typeId: string,
  sectionId: string,
): { number: string; heading: string } {
  const type = documentTypeById(typeId);
  if (!type) return { number: "", heading: sectionId };
  const spec = sectionsFor(type).find((s) => s.id === sectionId);
  return {
    number: sectionNumbers(type).get(sectionId) ?? "",
    heading: spec?.heading ?? sectionId,
  };
}

/** FR-C1: the line on the control row, the document page and the auditor's view. */
export function summaryCheckLine(input: {
  number: string;
  heading: string;
  on: string;
}): string {
  const where = input.number
    ? `section ${input.number} ${input.heading}`
    : input.heading;
  return `In plain words may be out of date: ${where} changed on ${formatDateAu(input.on)}`;
}

/** FR-C2: the change-log row the summary's redraft writes (bracketed for the adoption snapshot). */
export function summaryRedraftChangeText(number: string): string {
  return `In plain words redrafted after section ${number} changed; approved by [role]`;
}

/** FR-C2: the change-log row "The summary is still right" writes, with the role. */
export function summaryConfirmChangeText(number: string): string {
  return `In plain words confirmed after section ${number} changed`;
}

/** FR-C4: the clause the registers sentence and the audit-day page carry. */
export function summariesToCheckClause(n: number): string | null {
  if (!n) return null;
  return `${n} ${n === 1 ? "summary" : "summaries"} to check`;
}

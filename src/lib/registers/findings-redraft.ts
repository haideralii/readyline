/**
 * The redraft's words and small pure helpers (REQ-033 Session B FR-B1, FR-B6,
 * FR-B7; D-2936, D-2955, D-2957). No "fix", "resolve", "comply" or "close" on
 * any control; the page says what happens and that the auditor decides.
 */

export const REDRAFT_BUTTON_LABEL = "Redraft this section with the finding";
export const USE_REDRAFT_LABEL = "Use this redraft";
export const KEEP_CURRENT_LABEL = "Keep the current text";
export const DRAFT_REDRAFT_LABEL = "Show me a redraft";

/** FR-B7: the sentence above the button and on the redraft page. */
export const REDRAFT_INTRO =
  "Readyline rewrites this one section with your finding as context and shows you the result beside the current text. Nothing changes until you choose the redraft, and the new version waits for your approval like any other. Your auditor decides whether the finding is closed.";

/** FR-B2's sentence on what the model sees, for the redraft page. */
export const REDRAFT_WHAT_IS_SENT =
  "The model sees this section's current text, its brief, the standard and indicator, your finding's words and the document's section headings; nothing else from your account or your registers.";

export const REDRAFT_NEEDS_SUBSCRIPTION =
  "The redraft needs the registers subscription and a document pack on this account.";
export const REDRAFT_NO_PACK =
  "There is no document pack on this account yet, so there is nothing to redraft.";
export const REDRAFT_NO_SECTION =
  "This finding does not map to a section Readyline drafted, so there is nothing to redraft here.";
export const REDRAFT_NO_VERSION =
  "This document is not in your pack, so there is nothing to redraft.";
export const REDRAFT_LIMITED =
  "You have asked for ten redrafts this hour. Wait a while and try again.";
export const REDRAFT_NOT_FOUND = "That finding was not found.";
export const REDRAFT_UNAVAILABLE =
  "The redraft could not be drafted just now; nothing was changed. Try again in a few minutes.";

/** FR-B1: the one-sentence reason a line has no button. */
export function noRedraftReason(
  kind: "register" | "fixed" | "no-version" | "unmapped",
): string {
  switch (kind) {
    case "register":
      return "This is a register: the change goes in its rows, not in a document.";
    case "fixed":
      return "This section is fixed text Readyline does not redraft; your own words go in the sections around it.";
    case "no-version":
      return REDRAFT_NO_VERSION;
    case "unmapped":
      return REDRAFT_NO_SECTION;
  }
}

/** FR-B6: the improvement row's one action line. */
export function redraftTrailLine(
  title: string,
  sectionNumber: string,
  version: number,
): string {
  return `Section ${sectionNumber} of ${title} redrafted (version ${version}).`;
}

/** FR-B6: the finding row's state line. */
export function redraftStateLine(input: {
  title: string;
  version: number;
  adoptedOn: string | null;
}): string {
  return input.adoptedOn
    ? `Redrafted: ${input.title}, version ${input.version}, adopted ${input.adoptedOn}`
    : `Redrafted: ${input.title}, version ${input.version}, awaiting adoption`;
}

/** The sentences of a block list's text, for the side-by-side's marks. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** FR-B4: the sentences of the redraft that the current text does not carry (folded on case and spaces). */
export function changedSentences(
  current: string,
  proposed: string,
): Set<string> {
  const fold = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const have = new Set(sentencesOf(current).map(fold));
  return new Set(sentencesOf(proposed).filter((s) => !have.has(fold(s))));
}

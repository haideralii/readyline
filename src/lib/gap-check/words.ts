/**
 * REQ-035 FR-1, FR-4, FR-6 (D-2962, D-2968): the gap check's words. The
 * intro is the lawyer's, pinned; the states describe Readyline's outline,
 * never the Standards; none of the banned words appears on the page or in
 * a reason.
 */
export const GAP_CHECK_TITLE = "Check a policy you already have";

export const GAP_CHECK_INTRO =
  "Compare a policy you already have with the outline Readyline writes from the NDIS Practice Standards' quality indicators. The check tells you which sections of the outline your document covers, partly covers or leaves out. It is a comparison with Readyline's outline, not an audit, and an auditor may read your document differently.";

export const GAP_CHECK_NEVER_STORED =
  "Readyline reads your document once, compares it with its outline for this document type, and keeps only the list below. The file and its words are not stored.";

export const GAP_CHECK_REFUSED_LINE =
  "Remove the names or details it points to, then run the check again.";

export const GAP_CHECK_LIMIT_LINE = "3 checks an hour.";
export const GAP_CHECK_LIMIT_MESSAGE =
  "You have run three checks this hour. Try again in an hour.";
export const GAP_CHECK_OWNER_ONLY = "Only the owner runs a check.";
export const GAP_CHECK_BUTTON = "Run the check";
export const GAP_CHECK_TITLE_LABEL = "What your document is called";
export const GAP_CHECK_TYPE_LABEL = "Which Readyline document it stands for";
export const GAP_CHECK_NOT_IN_AUDIT = "Not in your audit type";
export const GAP_CHECK_IN_AUDIT = "In your audit type";
export const GAP_CHECK_PASTE_LABEL = "Paste the document's text";
export const GAP_CHECK_FILE_LABEL = "Or choose a PDF, Word or text file";
export const GAP_CHECK_UNAVAILABLE =
  "The check could not run this time. Try again in a few minutes.";
export const GAP_CHECK_EMPTY = "Paste the document's text or choose a file.";

export const GAP_STATES = ["covered", "partly", "missing"] as const;
export type GapState = (typeof GAP_STATES)[number];
export const GAP_STATE_LABELS: Record<GapState, string> = {
  covered: "Covered",
  partly: "Partly covered",
  missing: "Not covered",
};

/** FR-6 (D-2968): never on the page or in a reason. */
export const GAP_BANNED_WORDS: readonly RegExp[] = [
  /\bcompliant\b/i,
  /\bpass(?:ed|es)?\b/i,
  /\bapproved\b/i,
  /\bmeets the standards\b/i,
  /\baudit-ready\b/i,
];

export type GapCounts = { covered: number; partly: number; missing: number };

/** "Your <title> against Readyline's <type> outline: 6 sections covered, 2 partly, 3 not covered". */
export function gapCountsLine(
  title: string,
  typeTitle: string,
  c: GapCounts,
): string {
  const parts = [
    `${c.covered} ${c.covered === 1 ? "section" : "sections"} covered`,
    `${c.partly} partly`,
    `${c.missing} not covered`,
  ];
  return `Your ${title} against Readyline's ${typeTitle} outline: ${parts.join(", ")}`;
}

/** FR-4: where the pack answers a partly or missing section. */
export function inPackLine(
  typeTitle: string,
  number: string,
  heading: string,
): string {
  return `In the Readyline pack: ${typeTitle}, section ${number} ${heading}`;
}

/** FR-4: a section the outline keeps as a record. */
export function keptAsRecordLine(register: string): string {
  return `Kept as a record: the ${register}`;
}

/** FR-5: the checklist's and documents page's dated line. */
export function gapCheckDatedLine(date: string, missing: number): string {
  return `Gap check ${date}: ${missing} ${missing === 1 ? "section" : "sections"} not covered`;
}

/** FR-5: the audit-day card's count. */
export function gapCheckCardLine(checked: number, toClose: number): string {
  return `${checked} of your own ${checked === 1 ? "policy" : "policies"} checked, ${toClose} ${toClose === 1 ? "section" : "sections"} to close`;
}

export const GAP_CHECK_WORDS = [
  GAP_CHECK_TITLE,
  GAP_CHECK_INTRO,
  GAP_CHECK_NEVER_STORED,
  GAP_CHECK_REFUSED_LINE,
  GAP_CHECK_LIMIT_LINE,
  GAP_CHECK_LIMIT_MESSAGE,
  GAP_CHECK_OWNER_ONLY,
  GAP_CHECK_BUTTON,
  GAP_CHECK_TITLE_LABEL,
  GAP_CHECK_TYPE_LABEL,
  GAP_CHECK_NOT_IN_AUDIT,
  GAP_CHECK_IN_AUDIT,
  GAP_CHECK_PASTE_LABEL,
  GAP_CHECK_FILE_LABEL,
  GAP_CHECK_UNAVAILABLE,
  GAP_CHECK_EMPTY,
  ...Object.values(GAP_STATE_LABELS),
];

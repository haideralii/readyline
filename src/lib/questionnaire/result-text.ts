/**
 * The result's fixed words shared by the screen, the print view and the
 * result email (REQ-031 FR-1, FR-2; D-2887, D-2894, D-2895, D-2897): one
 * source, so the email and the print carry nothing the screen does not.
 * Pure; the copy lint walks it.
 */
import type { QuestionnaireResult } from "./result";

export const GROUPS_LABEL = "Registration groups in scope";
export const MODULES_HEADING = "Practice Standards modules that apply";
export const MID_TERM_HEADING = "Mid-term audit";
export const MID_TERM_APPLIES =
  "Applies: about N months after registration, against the provider governance and operational management standards. Start preparing from month N.";
export const MID_TERM_NONE = "Does not apply.";

/** D-2897: the second sentence of the registers legend, carried by the email's registers line too. */
export const REGISTERS_SAMPLED_SENTENCE =
  "An auditor samples them at the mid-term audit and at renewal.";
export const REGISTERS_LEGEND = `Your pack includes a template for every register below; the subscription keeps them for you. ${REGISTERS_SAMPLED_SENTENCE}`;

/** D-2895: under "Your audit", on the screen, the print and the email. */
export const RESULT_SCOPE_SENTENCE =
  "General information, not legal advice: this is based on the supports you told us you deliver; the Commission sets the scope of your audit when you apply.";

/** D-2895: the print block's and the email's last line before the footer. */
export function resultPreparedLine(dateWords: string): string {
  return `Prepared by Readyline from your answers on ${dateWords}; the sources named are the public instruments, read on the dates recorded at /sources.`;
}

/** D-2894: the email's first line, verbatim. */
export const RESULT_EMAIL_FIRST_LINE =
  "Someone asked Readyline to send this questionnaire result to this address. If that was not you, you can ignore this email; nothing was created and nothing else will be sent.";

/** D-2885: the subject names the audit kind. */
export function resultEmailSubject(
  pathway: QuestionnaireResult["pathway"],
): string {
  return `Readyline: your result, a ${pathway} audit`;
}

/** The mid-term line as the page prints it: the months filled in, or the exemption. */
export function midTermLine(
  r: Pick<QuestionnaireResult, "midTermAudit">,
): string {
  const mt = r.midTermAudit;
  return mt.applies
    ? MID_TERM_APPLIES.replace(
        "about N months",
        `about ${mt.monthsAfterRegistration} months`,
      ).replace("month N.", `month ${mt.prepareFromMonth}.`)
    : `${MID_TERM_NONE} ${mt.exemptReason ?? ""}`.trim();
}

/** "Your audit: certification (modified scope)" as the card's heading reads it. */
export function auditHeading(
  r: Pick<QuestionnaireResult, "pathway" | "modifiedCertification">,
): string {
  return `Your audit: ${r.pathway}${r.modifiedCertification ? " (modified scope)" : ""}`;
}

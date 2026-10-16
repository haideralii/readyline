/**
 * Plain-text confirmation emails for account events (REQ-004 FR-6). Pure
 * functions so the wording is unit-tested for the claims rules and never
 * contains anything about participants.
 */
import { BRAND } from "@/lib/brand";
import { REPORT_WINDOW_WORDS } from "@/lib/registers/worker";
import type { EmailMessage } from "./provider";

const SIGN_OFF = `${BRAND} provides general information and document templates for your own review; it is not legal advice.`;

export function formatDateAu(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(date);
}

export function accountDeletedEmail(input: {
  to: string;
  tradingName: string;
  deletedAt: Date;
  purgeAfter: Date;
}): EmailMessage {
  return {
    to: input.to,
    subject: `${BRAND}: your account was deleted`,
    text: [
      `Your ${BRAND} account for ${input.tradingName} was deleted on ${formatDateAu(input.deletedAt)}.`,
      "",
      `Sign-in is now refused and nothing in the account is visible. The data will be permanently removed on or after ${formatDateAu(input.purgeAfter)}. If you did not do this, reply to this email before that date.`,
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

/** Sent once the paid document set is generated (REQ-007 FR-5). */
export function documentsReadyEmail(input: {
  to: string;
  tradingName: string;
  documentsUrl: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: `${BRAND}: your documents are ready`,
    text: [
      `The document set for ${input.tradingName} is ready to download.`,
      "",
      `Sign in and open ${input.documentsUrl} to download the full set as a zip, the readiness summary, or each document on its own.`,
      "",
      'Every document is a first draft for your review. Sections marked "Review and complete" need your attention before use, and you adopt the documents yourself.',
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

/**
 * The register reminders (REQ-009 FR-3, SR-4): one message per account per
 * run, each line naming the register and the reference only, never the
 * summary text or anything about a participant.
 */
/** REQ-020 FR-4, SR-5: the invitation names the business and the role and carries no register content. */
export function workerInvitationEmail(input: {
  to: string;
  tradingName: string;
  workerRef: string;
  url: string;
  expiresOn: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: `${input.tradingName} has invited you to log incidents and complaints in ${BRAND}`,
    text: [
      `${input.tradingName} has invited you, as worker ${input.workerRef}, to log incidents and complaints in ${BRAND}.`,
      "",
      "You can log incidents and complaints and see what you logged. Your manager sees everything else.",
      "",
      `Open this link and sign in with this email address: ${input.url}`,
      `The invitation works until ${input.expiresOn}.`,
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

/** REQ-020 FR-5 (PO edit): the owner is told at once that a report waits, and nudged again while it does. */
export function reportToConfirmEmail(input: {
  to: string;
  tradingName: string;
  count: number;
}): EmailMessage {
  const line = `${input.count} ${input.count === 1 ? "report is" : "reports are"} waiting for you to confirm`;
  return {
    to: input.to,
    subject: `${BRAND}: ${line}`,
    text: [
      `${line} for ${input.tradingName}.`,
      "",
      // Retro finding 68: the window depends on the kind (Incident Rules ss 20 and 21), and this email has no category.
      `If a report is a reportable incident, the Commission must be told ${REPORT_WINDOW_WORDS}, so please confirm it today.`,
      "",
      "Sign in, open Registers, then Incidents, and confirm or reject each report.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

export function remindersEmail(input: {
  to: string;
  tradingName: string;
  lines: string[];
}): EmailMessage {
  return {
    to: input.to,
    subject: `${BRAND}: ${input.lines.length === 1 ? "a register reminder" : `${input.lines.length} register reminders`}`,
    text: [
      `Reminders for ${input.tradingName}:`,
      "",
      ...input.lines.map((l) => `- ${l}`),
      "",
      "Sign in and open Registers to update them.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

export function accountPurgedEmail(input: {
  to: string;
  tradingName: string;
  purgedAt: Date;
}): EmailMessage {
  return {
    to: input.to,
    subject: `${BRAND}: your data has been permanently removed`,
    text: [
      `The data held for ${input.tradingName} was permanently removed from ${BRAND} on ${formatDateAu(input.purgedAt)}.`,
      "",
      "This is the last message you will receive about this account.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

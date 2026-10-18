/**
 * Plain-text confirmation emails for account events (REQ-004 FR-6). Pure
 * functions so the wording is unit-tested for the claims rules and never
 * contains anything about participants.
 */
import { BRAND } from "@/lib/brand";
import { TIMELINE_FIXED_SENTENCE } from "@/lib/registers/timeline";
import { REPORT_WINDOW_WORDS } from "@/lib/registers/worker";
import type { EmailMessage } from "./provider";
import { glossarySentence } from "@/lib/questionnaire/content";
import { readinessCounts, summaryLines } from "@/lib/questionnaire/readiness";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import {
  GROUPS_LABEL,
  MID_TERM_HEADING,
  MODULES_HEADING,
  REGISTERS_SAMPLED_SENTENCE,
  RESULT_EMAIL_FIRST_LINE,
  RESULT_SCOPE_SENTENCE,
  auditHeading,
  midTermLine,
  resultEmailSubject,
  resultPreparedLine,
} from "@/lib/questionnaire/result-text";
import { WORKER_FIRST_STEPS } from "@/lib/registers/worker-steps";

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
    template: "account-deleted",
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
    template: "documents-ready",
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
    template: "worker-invitation",
    // REQ-024 FR-7, FR-9 (AC-8): the role's sentence and the worker's first three steps, no number but the code and the date.
    subject: `${input.tradingName} has invited you to log incidents and complaints and complete your onboarding in ${BRAND}`,
    text: [
      `${input.tradingName} has invited you, as worker ${input.workerRef}, to log incidents and complaints and complete your onboarding in ${BRAND}.`,
      "",
      "Your first three steps, once you are in:",
      ...WORKER_FIRST_STEPS.map((s) => `- ${s}`),
      "",
      "You can log incidents and complaints and complete your onboarding here, and see what you logged. Your manager sees everything else.",
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
    template: "report-to-confirm",
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
  /** REQ-023 FR-3: true when a timeline line is among them; the fixed sentence and the account-page pointer follow once (finding 56). */
  registration?: boolean;
  /** REQ-022 FR-7, SR-6: the one-click unsubscribe link for this account (the reminders alone carry it). */
  unsubscribeUrl?: string;
}): EmailMessage {
  return {
    to: input.to,
    template: "reminders",
    subject: `${BRAND}: ${input.lines.length === 1 ? "a register reminder" : `${input.lines.length} register reminders`}`,
    text: [
      `Reminders for ${input.tradingName}:`,
      "",
      ...input.lines.map((l) => `- ${l}`),
      "",
      ...(input.registration
        ? [
            TIMELINE_FIXED_SENTENCE,
            "Your registration timeline is on your account page.",
            "",
          ]
        : []),
      "Sign in and open Registers to update them.",
      "",
      ...(input.unsubscribeUrl
        ? [`To stop these reminder emails: ${input.unsubscribeUrl}`, ""]
        : []),
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
    template: "account-purged",
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

/** REQ-022 FR-6: the admin's own test send from /admin/launch; the footer line and nothing about any account. */
export function testEmail(input: { to: string }): EmailMessage {
  return {
    to: input.to,
    template: "test",
    subject: `${BRAND}: a test email from the launch page`,
    text: [
      `This is the test email from ${BRAND}'s launch page. If you are reading it, the sender, the SMTP values and the domain's records work together.`,
      "",
      "Nothing else was sent and no account is involved.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

/**
 * REQ-031 FR-1 (D-2884, D-2885, D-2893, D-2894, D-2895, D-2897): the
 * questionnaire result, sent once to the address typed on the result page.
 * The result and nothing else: no price, no offer, no follow-up; the sources
 * by short name without a URL (a template may not link off site); two
 * on-site next steps; the link back; the footer with the business and the
 * contact address. The audit kind's glossary sentence is the one glossary
 * line (question 1 (a)).
 */
export function resultEmail(input: {
  to: string;
  result: QuestionnaireResult;
  checklistTotal: number;
  signedIn: boolean;
  origin: string;
  /** Today in Sydney, for the "Prepared ... on <date>" line. */
  today: Date;
  /** CONTACT_EMAIL when set; the footer names it after the business. */
  contact: string | null;
  accountId?: string | null;
}): EmailMessage {
  const r = input.result;
  const lines = summaryLines(readinessCounts(r), input.checklistTotal);
  const nextSteps = input.signedIn
    ? [`Go to your next step: ${input.origin}/path/before-you-buy`]
    : [
        `Sign in to get ready: ${input.origin}/sign-in?next=/path/before-you-buy`,
      ];
  const back = input.signedIn
    ? `See your result: ${input.origin}/start/result`
    : `Your result is not saved on our side. To see it again, start the questionnaire: ${input.origin}/start`;
  return {
    to: input.to,
    template: "result",
    accountId: input.accountId ?? null,
    subject: resultEmailSubject(r.pathway),
    text: [
      RESULT_EMAIL_FIRST_LINE,
      "",
      auditHeading(r),
      glossarySentence(`${r.pathway}-audit`),
      RESULT_SCOPE_SENTENCE,
      "",
      `${GROUPS_LABEL}:`,
      ...r.groups.map((g) => `- ${g.name} (${g.code})`),
      "",
      lines.documents,
      `${lines.registers}. ${REGISTERS_SAMPLED_SENTENCE}`,
      lines.checklist,
      "",
      `${MODULES_HEADING}:`,
      ...r.modules.map(
        (m) =>
          `- ${m.name} (${m.standardCount} ${m.standardCount === 1 ? "standard" : "standards"})`,
      ),
      "",
      `${MID_TERM_HEADING}: ${midTermLine(r)}`,
      "",
      "Why this result:",
      ...r.reasons.map((x) => `- ${x.text} Source: ${x.source.title}.`),
      "",
      ...nextSteps,
      `Open your checklist: ${input.origin}/checklist`,
      back,
      "",
      resultPreparedLine(formatDateAu(input.today)),
      SIGN_OFF,
      ...(input.contact ? [`${BRAND}. Contact: ${input.contact}`] : [BRAND]),
    ].join("\n"),
  };
}

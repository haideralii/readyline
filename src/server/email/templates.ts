/**
 * Plain-text confirmation emails for account events (REQ-004 FR-6). Pure
 * functions so the wording is unit-tested for the claims rules and never
 * contains anything about participants.
 */
import { BRAND } from "@/lib/brand";
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

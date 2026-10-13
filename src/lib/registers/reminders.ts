/**
 * Reminder rules (REQ-009 FR-3), pure over plain rows so every rule and
 * boundary is unit-tested and the nightly job only has to read, call and
 * insert. Dates are ISO `YYYY-MM-DD`; "today" is passed in.
 *
 * A reminder is identified by (kind, subject, send_on): the day it should go
 * out. `due_on` is the date the reminder is about (the expiry, the review
 * date, the mid-term audit). The job inserts with "ignore duplicates" on
 * that key, so a second run on the same day inserts nothing (AC-4), and a
 * run that was missed sends the reminders that fell due in the last
 * CATCH_UP_DAYS rather than silently skipping them or flooding an account
 * that enters an old date.
 */
import { addBusinessDays, addDays, daysBetween } from "./status";
import type { RegistrationKind, ReminderKind } from "./types";

export const CATCH_UP_DAYS = 7;
export const CLEARANCE_OFFSETS = [90, 30, 7, 0] as const;
export const REVIEW_OFFSETS = [60, 14, 0] as const;
export const INCIDENT_OPEN_DAYS = 30;
export const COMPLAINT_ACK_BUSINESS_DAYS = 2;
export const MID_TERM_MONTHS = [12, 15, 17] as const;
export const MID_TERM_DUE_MONTHS = 18;
export const RENEWAL_MONTHS_BEFORE = [6, 3] as const;
export const REGISTRATION_TERM_MONTHS = 36;

export type ReminderInput = {
  today: string;
  account: {
    id: string;
    registration_date: string | null;
    registration_kind: RegistrationKind | null;
  };
  incidents: {
    id: string;
    status: "open" | "under-review" | "closed";
    reportable: boolean;
    notify_by: string | null;
    reportable_notified_on: string | null;
    /** The last event's date, or the incident's reported date when there is none. */
    last_activity_on: string;
  }[];
  complaints: {
    id: string;
    status: string;
    received_on: string;
    acknowledged_on: string | null;
  }[];
  workerChecks: { id: string; expires_on: string | null }[];
  policyReviews: { id: string; next_review_on: string | null }[];
};

export type ReminderDue = {
  account_id: string;
  kind: ReminderKind;
  subject_table:
    | "incidents"
    | "complaints"
    | "worker_clearances"
    | "policy_reviews"
    | "accounts";
  subject_id: string;
  due_on: string;
  send_on: string;
};

/** Calendar months added to an ISO date; a day past the month's end clamps (31 Jan + 1 month = 28 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const dt = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, lastDay)),
  );
  return dt.toISOString().slice(0, 10);
}

/** True when a reminder dated `sendOn` should go out on `today`: today or within the catch-up window. */
export function inWindow(sendOn: string, today: string): boolean {
  const behind = daysBetween(sendOn, today);
  return behind >= 0 && behind <= CATCH_UP_DAYS;
}

export function dueReminders(input: ReminderInput): ReminderDue[] {
  const out: ReminderDue[] = [];
  const today = input.today;
  const push = (
    kind: ReminderKind,
    subject_table: ReminderDue["subject_table"],
    subject_id: string,
    due_on: string,
    send_on: string,
  ) => {
    if (inWindow(send_on, today))
      out.push({
        account_id: input.account.id,
        kind,
        subject_table,
        subject_id,
        due_on,
        send_on,
      });
  };

  // Worker checks: 90, 30 and 7 days before expiry, and on the day.
  for (const c of input.workerChecks) {
    if (!c.expires_on) continue;
    for (const days of CLEARANCE_OFFSETS)
      push(
        "clearance-expiry",
        "worker_clearances",
        c.id,
        c.expires_on,
        addDays(c.expires_on, -days),
      );
  }

  // Policy reviews: 60 and 14 days before the review date, and on the day.
  for (const r of input.policyReviews) {
    if (!r.next_review_on) continue;
    for (const days of REVIEW_OFFSETS)
      push(
        "policy-review",
        "policy_reviews",
        r.id,
        r.next_review_on,
        addDays(r.next_review_on, -days),
      );
  }

  for (const i of input.incidents) {
    // Open for 30 days with no event.
    if (i.status !== "closed") {
      const quiet = addDays(i.last_activity_on, INCIDENT_OPEN_DAYS);
      push("incident-open", "incidents", i.id, quiet, quiet);
    }
    // Reportable and not notified: the morning after notify_by.
    if (i.reportable && i.notify_by && !i.reportable_notified_on)
      push(
        "reportable-not-notified",
        "incidents",
        i.id,
        i.notify_by,
        addDays(i.notify_by, 1),
      );
  }

  // Complaints: not acknowledged 2 business days after receipt.
  for (const c of input.complaints) {
    if (c.acknowledged_on) continue;
    if (c.status === "resolved" || c.status === "withdrawn") continue;
    const by = addBusinessDays(c.received_on, COMPLAINT_ACK_BUSINESS_DAYS);
    push("complaint-unacknowledged", "complaints", c.id, by, by);
  }

  // Registration: the mid-term audit (certification only) and the renewal (both kinds).
  const reg = input.account.registration_date;
  if (reg) {
    if (input.account.registration_kind === "certification") {
      const due = addMonths(reg, MID_TERM_DUE_MONTHS);
      for (const m of MID_TERM_MONTHS)
        push(
          "mid-term-audit",
          "accounts",
          input.account.id,
          due,
          addMonths(reg, m),
        );
    }
    if (input.account.registration_kind) {
      const expiry = addMonths(reg, REGISTRATION_TERM_MONTHS);
      for (const m of RENEWAL_MONTHS_BEFORE)
        push(
          "renewal",
          "accounts",
          input.account.id,
          expiry,
          addMonths(expiry, -m),
        );
    }
  }

  return out;
}

/** The sentence a reminder email and the "Due soon" list use: the register and the reference, never the content (SR-4). */
export function reminderLine(
  kind: ReminderKind,
  reference: string,
  dueOn: string,
): string {
  switch (kind) {
    case "clearance-expiry":
      return `Worker check ${reference} expires on ${dueOn}.`;
    case "policy-review":
      return `Policy ${reference} is due for review on ${dueOn}.`;
    case "incident-open":
      return `Incident ${reference} has had no update for ${INCIDENT_OPEN_DAYS} days.`;
    case "complaint-unacknowledged":
      return `Complaint ${reference} has not been acknowledged.`;
    case "reportable-not-notified":
      return `Incident ${reference} was due to the Commission by ${dueOn} and is not marked as notified.`;
    case "mid-term-audit":
      return `Your mid-term audit is due around ${dueOn}. Start preparing.`;
    case "renewal":
      return `Your registration ends on ${dueOn}. Plan the renewal audit.`;
  }
}

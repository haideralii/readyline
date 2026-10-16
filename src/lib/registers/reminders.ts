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
import { addBusinessDays, addDays, addMonths, daysBetween } from "./status";
import {
  registrationReminderLine,
  registrationReminders,
  isRegistrationReminderKind,
  type RegistrationReminderInput,
} from "./timeline";
import type { ReminderKind, ReminderSubjectTable } from "./types";
import { REPORT_WINDOW_WORDS } from "./worker";

// REQ-023 Session A: the month arithmetic moved to status.ts; kept here for its importers.
export { addMonths } from "./status";

export const CATCH_UP_DAYS = 7;
// REQ-018 Session C (FR-5, FR-8, FR-10; D-1905).
export const INSURANCE_OFFSETS = [30, 7, 0] as const;
export const SUPERVISION_EVERY_DAYS = 31;
export const APPRAISAL_EVERY_DAYS = 365;
export const SUPPORT_PLAN_OFFSETS = [30, 7, 0] as const;
export const DRILL_EVERY_MONTHS = 6;
export const REGISTER_REVIEW_OFFSETS = [14, 0] as const;
export const CLEARANCE_OFFSETS = [90, 30, 7, 0] as const;
export const REVIEW_OFFSETS = [60, 14, 0] as const;
export const INCIDENT_OPEN_DAYS = 30;
export const COMPLAINT_ACK_BUSINESS_DAYS = 2;
// REQ-023 Session A (finding 59): the registration dates and their reminders
// come from the registration period (`./timeline`), never from a three-year
// assumption; `MID_TERM_MONTHS`, `RENEWAL_MONTHS_BEFORE` and
// `REGISTRATION_TERM_MONTHS` went with the two old kinds.

export type ReminderInput = {
  today: string;
  account: {
    id: string;
  };
  /** REQ-023 FR-3: the current registration period and what the job knows about it; none means no timeline reminders. */
  period?: RegistrationReminderInput;
  incidents: {
    id: string;
    /** `rejected` only for a rejected report still marked reportable (retro finding 62): its clock runs, nothing else does. */
    status: "open" | "under-review" | "closed" | "rejected";
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
  /** REQ-018 FR-5: insurances and vehicles by expiry. */
  insuranceItems?: { id: string; expires_on: string }[];
  /** REQ-018 FR-8: each worker's last supervision and appraisal dates. */
  staff?: {
    id: string;
    last_supervision_on: string | null;
    last_appraisal_on: string | null;
  }[];
  /** REQ-018 FR-10: the support plan review date per participant. */
  participantRisks?: { id: string; support_plan_review_on: string | null }[];
  /** REQ-018 FR-10: every register row with a review date. */
  reviewRows?: {
    id: string;
    table:
      | "corporate_risks"
      | "participant_risks"
      | "conflicts_of_interest"
      | "hazards";
    review_on: string;
  }[];
  /** REQ-018 FR-10: the last emergency drill, recorded on the audit-day page. */
  lastEmergencyDrillOn?: string | null;
  /** REQ-020 FR-5: draft reports waiting for the owner, by when the provider became aware. */
  reports?: { id: string; aware_at: string }[];
  /** The moment the rules run (ISO), for the hour-based rules; defaults to the end of `today`. */
  now?: string;
};

/** A draft report nudges the owner again once this many hours have passed since it came in (PO edit to FR-5). */
export const REPORT_NUDGE_HOURS = 12;

export type ReminderDue = {
  account_id: string;
  kind: ReminderKind;
  subject_table: ReminderSubjectTable;
  subject_id: string;
  due_on: string;
  send_on: string;
};

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

  // REQ-020 FR-5: a report still unconfirmed twelve hours after it came in
  // nudges the owner once a day (the unique key keeps it to one a day).
  const nowMs = Date.parse(input.now ?? `${today}T23:59:59Z`);
  for (const r of input.reports ?? []) {
    const aware = Date.parse(r.aware_at);
    if (
      Number.isFinite(aware) &&
      aware + REPORT_NUDGE_HOURS * 3_600_000 <= nowMs
    )
      push("report-to-confirm", "incidents", r.id, today, today);
  }

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
    // Open for 30 days with no event (a rejected report is not open).
    if (i.status !== "closed" && i.status !== "rejected") {
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

  // REQ-023 FR-3: the five timeline kinds from the current period, the period row as the subject (finding 58).
  if (input.period)
    for (const r of registrationReminders(input.period))
      push(
        r.kind,
        "registration_periods",
        input.period.period.id,
        r.due_on,
        r.send_on,
      );

  // REQ-018 FR-5: insurances and vehicles, 30 and 7 days before expiry and on the day.
  for (const i of input.insuranceItems ?? [])
    for (const days of INSURANCE_OFFSETS)
      push(
        "insurance-expiry",
        "insurance_items",
        i.id,
        i.expires_on,
        addDays(i.expires_on, -days),
      );

  // REQ-018 FR-8: supervision at least monthly, appraisal at least yearly; a worker with no date is due from the day the row was made (the job passes the row's created date as the last date).
  for (const s of input.staff ?? []) {
    if (s.last_supervision_on) {
      const due = addDays(s.last_supervision_on, SUPERVISION_EVERY_DAYS);
      push("supervision-due", "staff_matrix", s.id, due, due);
    }
    if (s.last_appraisal_on) {
      const due = addDays(s.last_appraisal_on, APPRAISAL_EVERY_DAYS);
      push("appraisal-due", "staff_matrix", s.id, due, addDays(due, -30));
      push("appraisal-due", "staff_matrix", s.id, due, due);
    }
  }

  // REQ-018 FR-10: the support plan review per participant, 30 and 7 days before and on the day.
  for (const p of input.participantRisks ?? []) {
    if (!p.support_plan_review_on) continue;
    for (const days of SUPPORT_PLAN_OFFSETS)
      push(
        "support-plan-review",
        "participant_risks",
        p.id,
        p.support_plan_review_on,
        addDays(p.support_plan_review_on, -days),
      );
  }

  // REQ-018 FR-10: each register row's review date, 14 days before and on the day.
  for (const r of input.reviewRows ?? [])
    for (const days of REGISTER_REVIEW_OFFSETS)
      push(
        "register-review",
        r.table,
        r.id,
        r.review_on,
        addDays(r.review_on, -days),
      );

  // REQ-018 FR-10: an emergency drill every six months, counted from the last one.
  if (input.lastEmergencyDrillOn) {
    const due = addMonths(input.lastEmergencyDrillOn, DRILL_EVERY_MONTHS);
    push(
      "emergency-drill",
      "accounts",
      input.account.id,
      due,
      addDays(due, -14),
    );
    push("emergency-drill", "accounts", input.account.id, due, due);
  }

  return out;
}

/** The sentence a reminder email and the "Due soon" list use: the register and the reference, never the content (SR-4). */
export function reminderLine(
  kind: ReminderKind,
  reference: string,
  dueOn: string,
): string {
  if (isRegistrationReminderKind(kind))
    return registrationReminderLine(kind, dueOn);
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
    case "insurance-expiry":
      return `${reference} expires on ${dueOn}. Renew it and type the new expiry into the insurances register.`;
    case "supervision-due":
      return `Worker ${reference} is due for supervision by ${dueOn}. Hold it and type the date into the staff matrix.`;
    case "appraisal-due":
      return `Worker ${reference} is due for an appraisal by ${dueOn}. Hold it and type the date into the staff matrix.`;
    case "support-plan-review":
      return `Participant ${reference}'s support plan review is due on ${dueOn}.`;
    case "emergency-drill":
      return `Your emergency drill is due by ${dueOn}. Run it and record the date on the audit-day page.`;
    case "register-review":
      return `Register row ${reference} is due for review on ${dueOn}. Open it and tap Reviewed today.`;
    case "report-to-confirm":
      // Retro finding 68: the line has no category, so it names both windows.
      return `Report ${reference} is waiting for you to confirm. If it is reportable, the Commission must be told ${REPORT_WINDOW_WORDS}.`;
  }
}

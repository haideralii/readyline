/**
 * The renewal path (REQ-023 Session C, FR-7, FR-9; D-2316, D-2342): the ten
 * steps in the Commission's order (R-3), each with its state read from live
 * data and one action, pure over the period row and the counts the page
 * gathers, so the words of AC-5 are a unit test. The practice lines are the
 * Commission's pages as the REQ quotes them (findings 88 and 89), never a
 * figure from memory. Nothing here books, recommends or names an auditor
 * (D-2303, CLAUDE.md 4.4).
 */
import {
  applicationInsideWindow,
  renewalWindowOpens,
  type RegistrationPeriod,
} from "@/lib/registers/timeline";
import { formatLongDate } from "@/lib/registers/status";

export const RENEWAL_STEP_IDS = [
  "dates",
  "what-changed",
  "documents",
  "rehearsal",
  "answers",
  "application",
  "scope",
  "booking",
  "audit-day",
  "decision",
] as const;
export type RenewalStepId = (typeof RENEWAL_STEP_IDS)[number];

/** The steps whose screen is a small dated form on `/path/renewal/<step>` (FR-7). */
export const RENEWAL_DATED_STEPS = [
  "application",
  "scope",
  "booking",
  "decision",
] as const satisfies readonly RenewalStepId[];
export type RenewalDatedStep = (typeof RENEWAL_DATED_STEPS)[number];

export function isRenewalDatedStep(value: string): value is RenewalDatedStep {
  return (RENEWAL_DATED_STEPS as readonly string[]).includes(value);
}

export type RenewalStep = {
  id: RenewalStepId;
  title: string;
  /** The state in the customer's words, AC-5's: "done", "to read", "2 due", "not yet", "optional", "done <date>". */
  state: string;
  done: boolean;
  /** Where the one action goes. */
  href: string;
  action: string;
  /** One plain line under the step, where the REQ gives one. */
  plain?: string;
};

export type RenewalInput = {
  period: RegistrationPeriod | null;
  /** B's summary exists when a period does; its last-audit date decides the title. */
  documentsDue: number;
  /** The newest rehearsal's day in this period, or null (FR-8). */
  rehearsedOn: string | null;
  today: string;
};

/** The Commission's practice lines on the apply step (findings 88 and 89), the REQ's words. */
export const APPLY_LINES = [
  "The Commission emails your scope of audit after you apply.",
  "Lodge it under the same ABN; a new ABN is a new application (the Commission's renewal page).",
  "Finish the application within 60 days of starting it, or the portal deletes it (the Commission's apply page).",
] as const;

/** The line under a recorded application (finding 83), by whether it counts under s 73K. */
export function applicationWindowLine(p: RegistrationPeriod): string | null {
  if (!p.application_submitted_on) return null;
  return applicationInsideWindow(p)
    ? `Applied ${formatLongDate(p.application_submitted_on)}, inside the six months before your period ends (NDIS Act s 73K): your registration continues while the Commission decides.`
    : `Applied ${formatLongDate(p.application_submitted_on)}, outside the six months before your period ends: NDIS Act s 73K keeps a registration in force only for an application made inside them.`;
}

/** The decision step's line (FR-7): the new certificate's dates belong on the account page. */
export const DECISION_LINE =
  "Enter the dates from your new certificate on the account page.";

/** The booking step's helper (finding 39): a company, never a person. */
export const BOOKING_HELP =
  "The auditing company's name, not a person's. We keep no list of auditors and take no fee from any.";

const notYet = (
  id: RenewalStepId,
  title: string,
  href: string,
  action: string,
  plain?: string,
): RenewalStep => ({
  id,
  title,
  state: "not yet",
  done: false,
  href,
  action,
  plain,
});

export function renewalSteps(input: RenewalInput): RenewalStep[] {
  const p = input.period;
  const dates: RenewalStep = p
    ? {
        id: "dates",
        title: "Confirm your dates",
        state: "done",
        done: true,
        href: "/account#registration-heading",
        action: "Change them",
        plain: `Your registration period ends ${formatLongDate(p.period_ends_on)}; the renewal window ${input.today >= renewalWindowOpens(p) ? "opened" : "opens"} ${formatLongDate(renewalWindowOpens(p))}.`,
      }
    : {
        id: "dates",
        title: "Confirm your dates",
        state: "not yet",
        done: false,
        href: "/account#registration-heading",
        action: "Type the dates from your certificate",
      };
  const steps: RenewalStep[] = [
    dates,
    {
      id: "what-changed",
      title: p?.last_audit_on
        ? "Read what changed since your last audit"
        : "Read what changed in this period",
      state: "to read",
      done: false,
      href: "/path/audit-day/what-changed",
      action: "Read it",
    },
    {
      id: "documents",
      title: "Review every document due before your period ends",
      state:
        input.documentsDue === 0 ? "none due" : `${input.documentsDue} due`,
      done: input.documentsDue === 0,
      href: "/registers/policy-reviews",
      action: "Open the policy review register",
    },
    {
      id: "rehearsal",
      title: "Run Check my systems as a rehearsal",
      state: input.rehearsedOn
        ? `done ${formatLongDate(input.rehearsedOn)}`
        : "not yet",
      done: Boolean(input.rehearsedOn),
      href: "/path/audit-day/check?mode=rehearsal",
      action: input.rehearsedOn ? "Run it again" : "Start the rehearsal",
    },
    {
      id: "answers",
      title: "Update your answers if your supports or workers changed",
      state: "optional",
      done: true,
      href: "/start/business",
      action: "Open the questionnaire",
    },
    p?.application_submitted_on
      ? {
          id: "application",
          title: "Apply for renewal in the Commission's portal",
          state: `done ${formatLongDate(p.application_submitted_on)}`,
          done: true,
          href: "/path/renewal/application",
          action: "Change the date",
          plain: applicationWindowLine(p) ?? undefined,
        }
      : notYet(
          "application",
          "Apply for renewal in the Commission's portal",
          "/path/renewal/application",
          "Type the date you applied",
        ),
    p?.scope_received_on
      ? {
          id: "scope",
          title: "Scope of audit received",
          state: `done ${formatLongDate(p.scope_received_on)}`,
          done: true,
          href: "/path/renewal/scope",
          action: "Change the date",
        }
      : notYet(
          "scope",
          "Scope of audit received",
          "/path/renewal/scope",
          "Type the date it arrived",
        ),
    p?.audit_booked_on
      ? {
          id: "booking",
          title: "Book your audit",
          state: `done ${formatLongDate(p.audit_booked_on)}`,
          done: true,
          href: "/path/renewal/booking",
          action: "Change the booking",
          plain: p.auditor_business_name
            ? `With ${p.auditor_business_name}.`
            : undefined,
        }
      : notYet(
          "booking",
          "Book your audit",
          "/path/renewal/booking",
          "Type the date and the auditing company",
        ),
    notYet(
      "audit-day",
      "Audit day",
      "/path/audit-day",
      "Open your audit-day page",
    ),
    p?.decision_received_on
      ? {
          id: "decision",
          title: "Decision received",
          state: `done ${formatLongDate(p.decision_received_on)}`,
          done: true,
          href: "/account#registration-heading",
          action: "Enter the new certificate's dates",
          plain: DECISION_LINE,
        }
      : notYet(
          "decision",
          "Decision received",
          "/path/renewal/decision",
          "Type the date of the decision",
          DECISION_LINE,
        ),
  ];
  return steps;
}

/** The one primary action on the page (REQ-017 FR-5): the first step that is neither done nor optional. */
export function renewalNext(steps: readonly RenewalStep[]): RenewalStep {
  return steps.find((s) => !s.done) ?? steps[steps.length - 1];
}

/** The dated steps' form words. */
export const RENEWAL_FORMS: Record<
  RenewalDatedStep,
  { title: string; dateLabel: string; column: string; lines: readonly string[] }
> = {
  application: {
    title: "Apply for renewal in the Commission's portal",
    dateLabel: "The day you submitted the application",
    column: "application_submitted_on",
    lines: APPLY_LINES,
  },
  scope: {
    title: "Scope of audit received",
    dateLabel: "The day the Commission's scope of audit arrived",
    column: "scope_received_on",
    lines: [],
  },
  booking: {
    title: "Book your audit",
    dateLabel: "The day you booked it",
    column: "audit_booked_on",
    lines: [],
  },
  decision: {
    title: "Decision received",
    dateLabel: "The day the Commission's decision arrived",
    column: "decision_received_on",
    lines: [DECISION_LINE],
  },
};

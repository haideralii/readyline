/**
 * The registration timeline (REQ-023 Session A, FR-2, FR-3; D-2301, D-2302,
 * D-2312 to D-2315): pure over one `registration_periods` row and a
 * `today`, so every date, every source word and every sentence is a unit
 * test with a fixed clock. Two kinds of row: the legal ones, whose dates
 * come from the Rules (s 13B(4)) and the Act (s 73K), and our suggestions,
 * which say so on screen; no suggested date ever reads as a deadline.
 */
import type { MidTermAudit } from "@/lib/standards/derive";
import type { ReminderKind, RegistrationKind } from "./types";
import {
  addDays,
  addMonths,
  daysBetween,
  formatLongDate,
  monthsBetween,
} from "./status";

/** "Prepare from": the primer's advice, start plus 12 months (our suggestion, D-2302). */
export const PREPARE_FROM_MONTHS = 12;
/** "Must start by": Rules s 13B(4)(a), 18 months after the period begins, unless the Commissioner allows longer. */
export const MID_TERM_START_BY_MONTHS = 18;
/** The renewal window: NDIS Act s 73K(1)(b), "within 6 months before" the period ends. */
export const RENEWAL_WINDOW_MONTHS = 6;
/**
 * "Apply by": our suggestion, period end minus 3 months (D-2302). One reason
 * for the lead: the Commission's apply page says an application must be
 * completed within 60 days of starting it or it is deleted (read 16 Oct 2026;
 * whether that binds a renewal is UNVERIFIED), and the audit comes after.
 */
export const APPLY_BY_MONTHS = 3;
/** Lead times for the reminders (D-2302): 28 days before the two dated steps, 14 days before the end. */
export const START_BY_LEAD_DAYS = 28;
export const APPLY_BY_LEAD_DAYS = 28;
export const LAST_CALL_LEAD_DAYS = 14;

/** The five timeline reminder kinds (FR-3), in timeline order. */
export const REGISTRATION_REMINDER_KINDS = [
  "midterm-prepare",
  "midterm-start-by",
  "renewal-window",
  "renewal-apply-by",
  "renewal-last-call",
] as const satisfies readonly ReminderKind[];
export type RegistrationReminderKind =
  (typeof REGISTRATION_REMINDER_KINDS)[number];

export const MIDTERM_OVERRIDE_SOURCES = ["condition", "letter"] as const;
export type MidtermOverrideSource = (typeof MIDTERM_OVERRIDE_SOURCES)[number];

/** One `registration_periods` row as the timeline reads it. */
export type RegistrationPeriod = {
  id: string;
  period_starts_on: string;
  period_ends_on: string;
  audit_type: RegistrationKind;
  midterm_applies: boolean;
  midterm_exempt_reason: string | null;
  midterm_start_by_override: string | null;
  midterm_override_source: MidtermOverrideSource | null;
  last_audit_on: string | null;
  midterm_audit_on: string | null;
};

/** The source word beside every row (finding 31, D-2302). */
export type TimelineSource =
  | "our suggestion"
  | "Rules s 13B"
  | "your certificate's conditions"
  | "the Commissioner's letter"
  | "NDIS Act s 73K"
  | "your certificate";

export type TimelineRowId =
  | "midterm-prepare"
  | "midterm-start-by"
  | "midterm-done"
  | "renewal-window"
  | "renewal-apply-by"
  | "period-end";

export type TimelineRow = {
  id: TimelineRowId;
  label: string;
  date: string;
  source: TimelineSource;
  /** True for the rows the Rules or the Act fix; the audit-day copy shows these alone (D-2314). */
  legal: boolean;
  /** One plain line under the date, where the REQ gives one. */
  plain?: string;
};

/** The sentence under the table and in every timeline reminder (D-2308; findings 29 and 85). */
export const TIMELINE_FIXED_SENTENCE =
  "The dates on your certificate rule; these reminders are a help, not the record. We do not see your certificate or the Commission's records; if a date here is wrong, change it on this form.";

/** The line the paused-subscription notice carries beside the pack link (finding 85). */
export const PAUSED_EXPORT_SENTENCE =
  "Your registers stay readable while access is paused; export them before you close the account.";

/** D-2315: the one line that says what the product does not model. */
export const TRANSITIONED_SENTENCE =
  "If the Commission registered you as a transitioned provider, the Rules exempt you too (s 13B(7)); we do not record that.";

/**
 * Finding 78: the mid-term rule needs both the audit type the provider typed
 * from the certificate and the questionnaire's reading of the classes.
 */
export function midtermFor(
  auditType: RegistrationKind,
  midTerm: MidTermAudit,
): { applies: boolean; reason: string | null } {
  if (auditType === "verification")
    return {
      applies: false,
      reason: "a verification audit has no mid-term audit (Rules s 13B(1))",
    };
  if (!midTerm.applies)
    return {
      applies: false,
      reason: `${midTerm.exemptReason ?? "the Rules exempt you"} (Rules s 13B(7))`,
    };
  return { applies: true, reason: null };
}

/** The must-start-by date: the override when one is set, else start plus 18 months. */
export function mustStartBy(p: RegistrationPeriod): string {
  return (
    p.midterm_start_by_override ??
    addMonths(p.period_starts_on, MID_TERM_START_BY_MONTHS)
  );
}

function startBySource(p: RegistrationPeriod): TimelineSource {
  if (!p.midterm_start_by_override) return "Rules s 13B";
  return p.midterm_override_source === "letter"
    ? "the Commissioner's letter"
    : "your certificate's conditions";
}

export function renewalWindowOpens(p: RegistrationPeriod): string {
  return addMonths(p.period_ends_on, -RENEWAL_WINDOW_MONTHS);
}

export function applyBy(p: RegistrationPeriod): string {
  return addMonths(p.period_ends_on, -APPLY_BY_MONTHS);
}

/** Every row of "Your registration timeline", in order (FR-2). */
export function timelineRows(p: RegistrationPeriod): TimelineRow[] {
  const rows: TimelineRow[] = [];
  if (p.midterm_applies) {
    if (p.midterm_audit_on) {
      rows.push({
        id: "midterm-done",
        label: "Mid-term audit done on",
        date: p.midterm_audit_on,
        source: "your certificate",
        legal: true,
      });
    } else {
      rows.push({
        id: "midterm-prepare",
        label: "Prepare for your mid-term audit from",
        date: addMonths(p.period_starts_on, PREPARE_FROM_MONTHS),
        source: "our suggestion",
        legal: false,
      });
      rows.push({
        id: "midterm-start-by",
        label: "Your mid-term audit must start by",
        date: mustStartBy(p),
        source: startBySource(p),
        legal: true,
      });
    }
  }
  rows.push({
    id: "renewal-window",
    label: "Your renewal window opens",
    date: renewalWindowOpens(p),
    source: "NDIS Act s 73K",
    legal: true,
    plain:
      "The earliest day an application keeps your registration in force while the Commission decides.",
  });
  rows.push({
    id: "renewal-apply-by",
    label: "Apply for renewal by",
    date: applyBy(p),
    source: "our suggestion",
    legal: false,
  });
  rows.push({
    id: "period-end",
    label: "Your registration period ends",
    date: p.period_ends_on,
    source: "your certificate",
    legal: true,
  });
  return rows;
}

/** The audit-day copy (D-2314): the legal rows, the period end and the done dates only. */
export function legalRows(rows: readonly TimelineRow[]): TimelineRow[] {
  return rows.filter((r) => r.legal);
}

/**
 * The one position sentence (FR-2), five fixed forms, most pressing first:
 * the period has ended; the apply-by date has passed with no application;
 * the window is open; the mid-term audit should have started; else where
 * the provider is.
 */
export function positionSentence(
  p: RegistrationPeriod,
  today: string,
  opts: { applicationInsideWindow?: boolean } = {},
): string {
  const end = formatLongDate(p.period_ends_on);
  const windowOpens = renewalWindowOpens(p);
  if (daysBetween(p.period_ends_on, today) > 0)
    return `Your registration period ended on ${end}. If your application was with the Commission in the six months before then, your registration continues until the decision (NDIS Act s 73K). Enter the dates from your new certificate here when it arrives.`;
  if (daysBetween(applyBy(p), today) > 0 && !opts.applicationInsideWindow)
    return `If you have not applied between ${formatLongDate(windowOpens)} and ${end}, your registration ends on ${end} (NDIS Act s 73K); an earlier application does not keep it in force.`;
  if (daysBetween(windowOpens, today) >= 0)
    return `Your renewal window is open. Apply by ${formatLongDate(applyBy(p))} (our suggestion).`;
  const midtermPending = p.midterm_applies && !p.midterm_audit_on;
  if (midtermPending && daysBetween(mustStartBy(p), today) > 0)
    return `Your mid-term audit was due to start by ${formatLongDate(mustStartBy(p))}, unless your certificate's conditions say otherwise; record the date it started.`;
  const months = monthsBetween(p.period_starts_on, today);
  const lead = `You are ${months} month${months === 1 ? "" : "s"} in.`;
  if (midtermPending) {
    const by = formatLongDate(mustStartBy(p));
    const tail = p.midterm_start_by_override
      ? p.midterm_override_source === "letter"
        ? `it must start by ${by} (the date the Commissioner's letter set).`
        : `it must start by ${by} (the date your certificate's conditions set).`
      : `it must start by ${by}, unless your certificate's conditions say otherwise.`;
    return `${lead} Prepare for your mid-term audit from ${formatLongDate(addMonths(p.period_starts_on, PREPARE_FROM_MONTHS))}; ${tail}`;
  }
  return `${lead} Your renewal window opens ${formatLongDate(windowOpens)}.`;
}

export type RegistrationReminderInput = {
  period: RegistrationPeriod;
  /** Kinds already sent for this period: never sent again on a new date (the once rule). */
  sentKinds?: readonly ReminderKind[];
  /** D-2313: no timeline reminder after a cancellation; a pause keeps them. */
  subscriptionCancelled?: boolean;
  /** Finding 77: the last call is not sent when the period end was changed after the window opened. */
  endChangedInsideWindow?: boolean;
  /** Finding 83: an application recorded inside the s 73K window (Session C's FR-7) stops the last call. */
  applicationInsideWindow?: boolean;
};

export type RegistrationReminderCandidate = {
  kind: RegistrationReminderKind;
  due_on: string;
  send_on: string;
};

/**
 * The five kinds' dates for one period (FR-3), before the catch-up window
 * is applied by `dueReminders`. Each kind once per period: the subject is
 * the period row, so "sent" is a lookup on (kind, period).
 */
export function registrationReminders(
  input: RegistrationReminderInput,
): RegistrationReminderCandidate[] {
  const p = input.period;
  if (input.subscriptionCancelled) return [];
  const sent = new Set(input.sentKinds ?? []);
  const out: RegistrationReminderCandidate[] = [];
  const push = (
    kind: RegistrationReminderKind,
    due_on: string,
    send_on: string,
  ) => {
    if (!sent.has(kind)) out.push({ kind, due_on, send_on });
  };
  if (p.midterm_applies && !p.midterm_audit_on) {
    const by = mustStartBy(p);
    push(
      "midterm-prepare",
      by,
      addMonths(p.period_starts_on, PREPARE_FROM_MONTHS),
    );
    push("midterm-start-by", by, addDays(by, -START_BY_LEAD_DAYS));
  }
  push("renewal-window", p.period_ends_on, renewalWindowOpens(p));
  push(
    "renewal-apply-by",
    applyBy(p),
    addDays(applyBy(p), -APPLY_BY_LEAD_DAYS),
  );
  if (!input.applicationInsideWindow && !input.endChangedInsideWindow)
    push(
      "renewal-last-call",
      p.period_ends_on,
      addDays(p.period_ends_on, -LAST_CALL_LEAD_DAYS),
    );
  return out;
}

/** The plain words of what to do, one line per kind (FR-3, SR-4): the date and the source, nothing else. */
export function registrationReminderLine(
  kind: RegistrationReminderKind,
  dueOn: string,
): string {
  const date = formatLongDate(dueOn);
  switch (kind) {
    case "midterm-prepare":
      return `Start preparing for your mid-term audit; it must start by ${date} (Rules s 13B).`;
    case "midterm-start-by":
      return `Your mid-term audit must start by ${date} (Rules s 13B). Book it with your auditor if you have not.`;
    case "renewal-window":
      return `Your renewal window opens today and your registration period ends on ${date} (NDIS Act s 73K). An application made from now on keeps your registration in force while the Commission decides.`;
    case "renewal-apply-by":
      return `Apply for renewal by ${date} (our suggestion), so the Commission has your application before your registration period ends.`;
    case "renewal-last-call":
      return `If you have not applied, your registration ends on ${date} (NDIS Act s 73K). Apply in the Commission's portal now.`;
  }
}

export function isRegistrationReminderKind(
  kind: string,
): kind is RegistrationReminderKind {
  return (REGISTRATION_REMINDER_KINDS as readonly string[]).includes(kind);
}

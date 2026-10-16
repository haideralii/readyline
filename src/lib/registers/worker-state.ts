/**
 * The derived state of one worker (REQ-024 FR-3, FR-4; D-2411): a pure
 * function over the worker's rows with the request's Sydney `today`
 * (D-2242); nothing here reads the clock. The words never say "ready" or
 * that the worker may start: the state is "all before-first-shift items
 * recorded" or "items outstanding", and every page that shows it carries
 * the line "From the dates you typed; the clearance itself is what the
 * Commission's database shows". W-1 is recorded only when the owner has
 * confirmed the item and dated the database check on the clearance row
 * (finding 151). The s 14 exception's gates are Session A2's; a pending
 * clearance here reads as outstanding with the database check as the next
 * thing to do.
 */
import { formatLongDay } from "./state-facts";
import { CLEARANCE_EXPIRING_DAYS, daysBetween } from "./status";
import {
  beforeFirstShiftItems,
  type WorkerOnboardingItem,
} from "./onboarding-items";

export const FROM_THE_DATES_LINE =
  "From the dates you typed; the clearance itself is what the Commission's database shows.";

export type WorkerStateKey =
  "all-recorded" | "outstanding" | "check-expiring" | "ended";

export const WORKER_STATE_LABELS: Record<WorkerStateKey, string> = {
  "all-recorded": "All before-first-shift items recorded",
  outstanding: "Items outstanding",
  "check-expiring": "A check expiring",
  ended: "Ended",
};

export type WorkerRowInput = {
  worker_ref: string;
  states: readonly string[];
  risk_assessed: boolean;
  ended_on: string | null;
  /** The role's `assessed_on` from `risk_assessed_roles`, null when the role is unassessed or the row has no role (finding 44). */
  role_assessed_on?: string | null;
  role_ref?: string | null;
};

export type ItemStateInput = {
  item_id: string;
  done_on: string | null;
  confirmed_on: string | null;
};

export type ClearanceInput = {
  clearance_kind: string;
  issued_on: string | null;
  expires_on: string | null;
  application_number?: string | null;
  verified_in_database_on?: string | null;
  decision_code?: string | null;
  decision_on?: string | null;
};

/** REQ-024 A2 (FR-4, AC-14): the s 14 exception as the state reads it. */
export type ExceptionInput = {
  /** An open `screening_exceptions` row exists for the worker. */
  running: boolean;
  /** The gates pass and the option is on the page (AC-2's "clearance pending, supervised" before the start). */
  offered: boolean;
  /** The supervisor's own `ndis-worker-screening` rows while the exception runs (s 15(2)(f), finding 50). */
  supervisorClearances: readonly ClearanceInput[];
};

export type WorkerState = {
  key: WorkerStateKey;
  label: string;
  /** The next thing to do, in the owner's words; null when nothing is outstanding. */
  next: string | null;
  /** The before-first-shift item ids still outstanding, in list order. */
  outstanding: string[];
  /** Clearance rows expiring within 90 days or expired, by kind. */
  expiring: { clearance_kind: string; expires_on: string }[];
  /** D-2416, finding 44: a risk assessed worker whose role has no assessed date. */
  roleAssessmentToRecord: boolean;
  /** FR-1, finding 81: the row has no states yet. */
  statesMissing: boolean;
  /** REQ-024 A2: an s 14 exception is running for this worker. */
  exceptionRunning: boolean;
  /** AC-14, findings 50 and 59: the day the supervisor's own clearance expired or was decided, while the exception runs; the end date is required. */
  supervisorClearanceEndedOn: string | null;
};

export const PENDING_SUPERVISED_LABEL =
  "Items outstanding (clearance pending, supervised)";
export const SUPERVISOR_CLEARANCE_ENDED = (day: string) =>
  `supervisor's clearance expired on ${formatLongDay(day)}; record the end of the exception with that date`;

export const TYPE_THE_STATES_FIRST =
  "type the states this worker works in first";
export const ROLE_ASSESSMENT_TO_RECORD = "role assessment to record";

/** True when the item counts as done: the owner's confirmation (and the worker's own date where the item is theirs or shared). */
export function itemRecorded(
  item: WorkerOnboardingItem,
  state: ItemStateInput | undefined,
): boolean {
  if (!state || !state.confirmed_on) return false;
  if (item.who === "owner") return true;
  return Boolean(state.done_on);
}

const isExpired = (expiresOn: string | null, today: string) =>
  expiresOn !== null && daysBetween(expiresOn, today) > 0;

/** The W-1 rule (finding 151): confirmed on the item and `verified_in_database_on` dated on an `ndis-worker-screening` row that is issued, undecided and unexpired. */
export function clearanceRecorded(
  clearances: readonly ClearanceInput[],
  today: string,
): boolean {
  return clearances.some(
    (c) =>
      c.clearance_kind === "ndis-worker-screening" &&
      c.issued_on !== null &&
      Boolean(c.verified_in_database_on) &&
      !c.decision_code &&
      !isExpired(c.expires_on, today),
  );
}

export function deriveWorkerState(input: {
  worker: WorkerRowInput;
  items: readonly WorkerOnboardingItem[];
  states: readonly ItemStateInput[];
  clearances: readonly ClearanceInput[];
  today: string;
  exception?: ExceptionInput | null;
}): WorkerState {
  const { worker, items, clearances, today } = input;
  const exception = input.exception ?? null;
  const exceptionRunning = Boolean(exception?.running);
  // s 15(2)(f), finding 50: the supervisor's own clearance expiring or being decided ends the exception that day.
  const supervisorClearanceEndedOn = exceptionRunning
    ? (exception!.supervisorClearances
        .filter((c) => c.clearance_kind === "ndis-worker-screening")
        .map((c) =>
          c.decision_code && c.decision_on
            ? c.decision_on
            : isExpired(c.expires_on, today)
              ? c.expires_on
              : null,
        )
        .find((d): d is string => d !== null) ?? null)
    : null;
  const byId = new Map(input.states.map((s) => [s.item_id, s]));
  const expiring = clearances
    .filter(
      (c) =>
        c.expires_on !== null &&
        daysBetween(today, c.expires_on) <= CLEARANCE_EXPIRING_DAYS,
    )
    .map((c) => ({
      clearance_kind: c.clearance_kind,
      expires_on: c.expires_on!,
    }));
  const roleAssessmentToRecord =
    worker.risk_assessed && !worker.role_assessed_on;
  const statesMissing = worker.states.length === 0;

  if (worker.ended_on && daysBetween(worker.ended_on, today) >= 0)
    return {
      key: "ended",
      label: WORKER_STATE_LABELS.ended,
      next: null,
      outstanding: [],
      expiring,
      roleAssessmentToRecord: false,
      statesMissing,
      exceptionRunning: false,
      supervisorClearanceEndedOn: null,
    };

  const outstanding: string[] = [];
  // Finding 81: until the states are typed, that is the next thing to do, whatever else is open.
  let next: string | null = statesMissing ? TYPE_THE_STATES_FIRST : null;
  // AC-14: the supervisor's clearance ending outranks every other next step while the exception runs.
  if (supervisorClearanceEndedOn && next === null)
    next = SUPERVISOR_CLEARANCE_ENDED(supervisorClearanceEndedOn);
  for (const item of beforeFirstShiftItems(items)) {
    const state = byId.get(item.id);
    let recorded = itemRecorded(item, state);
    // FR-4: W-1 is cleared, or the W-1a exception is running (and its supervisor still cleared).
    if (item.id === "w1-clearance")
      recorded =
        (recorded && clearanceRecorded(clearances, today)) ||
        (exceptionRunning && !supervisorClearanceEndedOn);
    if (item.clearanceKind && item.counts === "expiry") {
      const row = clearances.find(
        (c) => c.clearance_kind === item.clearanceKind,
      );
      if (row && isExpired(row.expires_on, today)) recorded = false;
    }
    if (recorded) continue;
    outstanding.push(item.id);
    if (next === null) {
      if (
        item.id === "w1-clearance" &&
        state?.confirmed_on &&
        !clearanceRecorded(clearances, today)
      )
        next =
          "check the clearance in the NDIS Worker Screening Database and date it on the worker checks row";
      else next = item.ask;
    }
  }

  // AC-2 and AC-14: the pending-supervised label while the option is on the page or the exception runs.
  const pendingSupervised = exceptionRunning || Boolean(exception?.offered);
  if (outstanding.length > 0 || statesMissing)
    return {
      key: "outstanding",
      label: pendingSupervised
        ? PENDING_SUPERVISED_LABEL
        : WORKER_STATE_LABELS.outstanding,
      next,
      outstanding,
      expiring,
      roleAssessmentToRecord,
      statesMissing,
      exceptionRunning,
      supervisorClearanceEndedOn,
    };
  if (expiring.length > 0)
    return {
      key: "check-expiring",
      label: WORKER_STATE_LABELS["check-expiring"],
      next: `renew the ${expiring[0].clearance_kind.replace(/-/g, " ")} that expires on ${expiring[0].expires_on} and type the new expiry`,
      outstanding: [],
      expiring,
      roleAssessmentToRecord,
      statesMissing,
      exceptionRunning,
      supervisorClearanceEndedOn,
    };
  return {
    key: exceptionRunning ? "outstanding" : "all-recorded",
    label: exceptionRunning
      ? PENDING_SUPERVISED_LABEL
      : WORKER_STATE_LABELS["all-recorded"],
    next: roleAssessmentToRecord ? ROLE_ASSESSMENT_TO_RECORD : null,
    outstanding: [],
    expiring,
    roleAssessmentToRecord,
    statesMissing,
    exceptionRunning,
    supervisorClearanceEndedOn,
  };
}

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
};

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
}): WorkerState {
  const { worker, items, clearances, today } = input;
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
    };

  const outstanding: string[] = [];
  // Finding 81: until the states are typed, that is the next thing to do, whatever else is open.
  let next: string | null = statesMissing ? TYPE_THE_STATES_FIRST : null;
  for (const item of beforeFirstShiftItems(items)) {
    const state = byId.get(item.id);
    let recorded = itemRecorded(item, state);
    if (item.id === "w1-clearance")
      recorded = recorded && clearanceRecorded(clearances, today);
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

  if (outstanding.length > 0 || statesMissing)
    return {
      key: "outstanding",
      label: WORKER_STATE_LABELS.outstanding,
      next,
      outstanding,
      expiring,
      roleAssessmentToRecord,
      statesMissing,
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
    };
  return {
    key: "all-recorded",
    label: WORKER_STATE_LABELS["all-recorded"],
    next: roleAssessmentToRecord ? ROLE_ASSESSMENT_TO_RECORD : null,
    outstanding: [],
    expiring,
    roleAssessmentToRecord,
    statesMissing,
  };
}

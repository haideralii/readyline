/**
 * REQ-024 Session C (FR-10; D-2411, D-2831): one sentence over every
 * current worker's derived state, for the audit-day page's worker group,
 * the checklist's two people items and the quarterly self-check's
 * staff-matrix question: "3 workers with every item recorded, 1 with items
 * outstanding (clearance pending, supervised), 1 check expiring in 20
 * days". Pure over the states and the request's Sydney day (D-2242); the
 * words never say "ready" or that a worker may start.
 */
import { daysBetween } from "./status";
import type { WorkerState } from "./worker-state";

/** D-2831: the line under a checklist item's title says where its status came from. */
export const FROM_YOUR_STAFF_LIST = "From your staff list";

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The current workers' states (an ended worker is on the past list and counts for nothing here). */
export function currentStates<T extends WorkerState>(states: Iterable<T>): T[] {
  return [...states].filter((s) => s.key !== "ended");
}

/**
 * The sentence, or null with no current worker. Each clause appears only
 * when its count is above zero; the expiring clause names the soonest
 * expiry in days ("today" at zero) and counts the checks, not the workers.
 */
export function workerStatesLine(
  states: Iterable<WorkerState>,
  today: string,
): string | null {
  const current = currentStates(states);
  if (current.length === 0) return null;
  const recorded = current.filter((s) => s.key === "all-recorded").length;
  const outstanding = current.filter((s) => s.outstanding.length > 0);
  const supervised = outstanding.filter((s) => s.exceptionRunning).length;
  const expiries = current
    .flatMap((s) => s.expiring)
    .filter((e) => daysBetween(today, e.expires_on) >= 0)
    .map((e) => daysBetween(today, e.expires_on));
  const expired = current
    .flatMap((s) => s.expiring)
    .filter((e) => daysBetween(today, e.expires_on) < 0).length;
  const parts: string[] = [];
  if (recorded > 0)
    parts.push(
      `${plural(recorded, "worker", "workers")} with every item recorded`,
    );
  if (outstanding.length > 0) {
    const tail =
      supervised === 0
        ? ""
        : supervised === outstanding.length
          ? " (clearance pending, supervised)"
          : ` (${supervised} clearance pending, supervised)`;
    parts.push(
      `${parts.length ? outstanding.length : plural(outstanding.length, "worker", "workers")} with items outstanding${tail}`,
    );
  }
  if (expiries.length > 0) {
    const soonest = Math.min(...expiries);
    parts.push(
      `${plural(expiries.length, "check", "checks")} expiring ${soonest === 0 ? "today" : `in ${plural(soonest, "day", "days")}`}`,
    );
  }
  if (expired > 0) parts.push(`${plural(expired, "check", "checks")} expired`);
  return parts.join(", ");
}

/** The two checklist statuses FR-10 derives (D-2831): "have" when every current worker in scope is clear, "in-progress" when some are, else null (the stored or questionnaire status stands). */
export function derivedPeopleStatus<T extends WorkerState>(
  states: Iterable<T>,
  clear: (s: T) => boolean,
  inScope: (s: T) => boolean = () => true,
): "have" | "in-progress" | null {
  const current = currentStates(states).filter(inScope);
  if (current.length === 0) return null;
  const n = current.filter(clear).length;
  if (n === current.length) return "have";
  return n > 0 ? "in-progress" : null;
}

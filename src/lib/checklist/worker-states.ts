/**
 * REQ-024 Session C (FR-10; D-2831): the checklist's two people items read
 * the staff list's derived states while the account has matrix rows. The
 * screening item is "have" when every current risk-assessed worker's state
 * is all-recorded and "in-progress" when some are; the orientation item
 * the same over W-4; otherwise the stored or questionnaire status stands.
 * Each overridden item carries a line saying where its status came from.
 * Pure over the merged checklist and the states.
 */
import type { WorkerState } from "@/lib/registers/worker-state";
import {
  derivedPeopleStatus,
  FROM_YOUR_STAFF_LIST,
  workerStatesLine,
} from "@/lib/registers/worker-states-line";
import type { ShownChecklist, ShownItem, ShownStatus } from "./state";

export const SCREENING_ITEM_ID = "people:worker-screening-clearances";
export const ORIENTATION_ITEM_ID = "people:worker-orientation-module";
const W4 = "w4-orientation-module";

/** The states keyed by code with the row's risk flag, as the server reads them. */
export type WorkerStateWithRow = WorkerState & { riskAssessed: boolean };

function recompute(shown: ShownChecklist, items: ShownItem[]): ShownChecklist {
  const byId = new Map(items.map((i) => [i.id, i]));
  const groups = shown.groups.map((g) => {
    const groupItems = g.items.map((i) => byId.get(i.id) ?? i);
    return {
      ...g,
      items: groupItems,
      ready: groupItems.filter((i) => i.status === "have").length,
    };
  });
  return {
    ...shown,
    groups,
    items,
    ready: items.filter((i) => i.status === "have").length,
  };
}

/**
 * The merged checklist with the two people items derived (D-2831). With no
 * current worker the checklist comes back as it was.
 */
export function applyWorkerStates(
  shown: ShownChecklist,
  states: readonly WorkerStateWithRow[],
  today: string,
): ShownChecklist {
  const line = workerStatesLine(states, today);
  if (!line) return shown;
  const screening = derivedPeopleStatus(
    states,
    (s) => s.key === "all-recorded",
    (s) => s.riskAssessed,
  );
  const orientation = derivedPeopleStatus(
    states,
    (s) => !s.outstanding.includes(W4),
  );
  const derived: Record<string, ShownStatus | null> = {
    [SCREENING_ITEM_ID]: screening,
    [ORIENTATION_ITEM_ID]: orientation,
  };
  const items = shown.items.map((i) => {
    if (!(i.id in derived)) return i;
    const status = derived[i.id];
    return {
      ...i,
      status: status ?? i.status,
      derived: `${FROM_YOUR_STAFF_LIST}: ${line}.`,
    };
  });
  return recompute(shown, items);
}

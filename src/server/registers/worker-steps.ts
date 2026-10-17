import "server-only";
/**
 * REQ-024 Session B (FR-7; SR-2; D-2417, D-2429): the worker's own file,
 * read through the worker's own policies and views and nothing else: the
 * matrix row and the clearances through `staff_matrix_worker` and
 * `worker_clearances_worker` (no `note`), the checklist and the item rows
 * by `is_worker`, the acknowledgements by their own policy, the adopted
 * documents' names and versions through `document_versions_worker`. The
 * derived list is A1's function over the row; the modules are not the
 * worker's to read, so a W-7 item the owner's list carries is named from
 * its row and the training table rather than derived again.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OnboardingChecklistRow,
  OnboardingItemRow,
  OnboardingTickRow,
  StaffMatrixRow,
} from "@/lib/registers/audit-day-types";
import type { WorkerClearanceRow } from "@/lib/registers/types";
import {
  TRAINING_BY_MODULE,
  workerOnboardingItems,
  type WorkerOnboardingItem,
} from "@/lib/registers/onboarding-items";
import {
  ACKNOWLEDGEMENT_DOCUMENTS,
  latestAdopted,
  type AcknowledgementRow,
  type AdoptedDocument,
} from "@/lib/registers/worker-steps";
import type { WorkerMembership } from "@/server/accounts/worker-membership";
import { contextFor, todaySydney } from "./worker-onboarding";

export type WorkerSteps = {
  today: string;
  /** The worker's matrix row without the owner's note; null when the owner has no row for the code yet. */
  row: Omit<StaffMatrixRow, "note"> | null;
  checklist: OnboardingChecklistRow | null;
  items: WorkerOnboardingItem[];
  states: OnboardingItemRow[];
  ticks: OnboardingTickRow[];
  clearances: Omit<WorkerClearanceRow, "note">[];
  /** The worker's own NDIS Worker Screening Check row, the one the three fields write (W-1). */
  screening: Omit<WorkerClearanceRow, "note"> | null;
  acknowledgements: (AcknowledgementRow & { id: string })[];
  adopted: Map<string, AdoptedDocument>;
};

const ACK_TYPE_IDS = [
  ...new Set(Object.values(ACKNOWLEDGEMENT_DOCUMENTS).flat()),
];

export async function loadWorkerSteps(
  supabase: SupabaseClient,
  worker: WorkerMembership,
): Promise<WorkerSteps> {
  const today = todaySydney();
  const ref = worker.worker_ref;
  if (!ref)
    return {
      today,
      row: null,
      checklist: null,
      items: [],
      states: [],
      ticks: [],
      clearances: [],
      screening: null,
      acknowledgements: [],
      adopted: new Map(),
    };
  const [rowRes, checklistRes, clearancesRes, acksRes, docsRes] =
    await Promise.all([
      supabase
        .from("staff_matrix_worker")
        .select("*")
        .eq("account_id", worker.id)
        .eq("worker_ref", ref)
        .maybeSingle(),
      supabase
        .from("onboarding_checklists")
        .select("*")
        .eq("account_id", worker.id)
        .eq("kind", "worker")
        .eq("subject_ref", ref)
        .maybeSingle(),
      supabase
        .from("worker_clearances_worker")
        .select("*")
        .eq("account_id", worker.id)
        .eq("worker_ref", ref)
        .order("created_at", { ascending: true }),
      supabase
        .from("policy_acknowledgements")
        .select("id, document_type_id, version, acknowledged_on")
        .eq("account_id", worker.id)
        .eq("worker_ref", ref),
      supabase
        .from("document_versions_worker")
        .select("id, document_type_id, version, adopted_on")
        .eq("account_id", worker.id)
        .in("document_type_id", ACK_TYPE_IDS),
    ]);
  const row = (rowRes.data as Omit<StaffMatrixRow, "note"> | null) ?? null;
  let checklist = (checklistRes.data as OnboardingChecklistRow | null) ?? null;
  // The derived list over the row (no modules: W-7 items the owner's list carries are named from their rows).
  const derived = row
    ? workerOnboardingItems(contextFor(row as StaffMatrixRow, [], null, today))
    : [];
  // #102's run at f190a70 (D-2282 (8)): a worker whose owner has not opened their page has no checklist and no
  // item rows, and the controls render on the rows; the function makes them under the worker's own code.
  if (row && derived.length > 0) {
    const existing = checklist
      ? (((
          await supabase
            .from("onboarding_items")
            .select("item_id")
            .eq("checklist_id", checklist.id)
        ).data as { item_id: string }[] | null) ?? [])
      : [];
    const have = new Set(existing.map((s) => s.item_id));
    if (!checklist || derived.some((i) => !have.has(i.id))) {
      const made = await supabase.rpc("worker_ensure_items", {
        p_account: worker.id,
        p_items: derived.map((i) => ({ id: i.id, owner_role: i.who })),
      });
      if (!made.error) {
        const again = await supabase
          .from("onboarding_checklists")
          .select("*")
          .eq("account_id", worker.id)
          .eq("kind", "worker")
          .eq("subject_ref", ref)
          .maybeSingle();
        checklist = (again.data as OnboardingChecklistRow | null) ?? checklist;
      }
    }
  }
  const [statesRes, ticksRes] = checklist
    ? await Promise.all([
        supabase
          .from("onboarding_items")
          .select("*")
          .eq("checklist_id", checklist.id),
        supabase
          .from("onboarding_ticks")
          .select("*")
          .eq("checklist_id", checklist.id)
          .order("ticked_on", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];
  const states = (statesRes.data as OnboardingItemRow[] | null) ?? [];
  const ticks = (ticksRes.data as OnboardingTickRow[] | null) ?? [];
  const clearances =
    (clearancesRes.data as Omit<WorkerClearanceRow, "note">[] | null) ?? [];
  const known = new Set(derived.map((i) => i.id));
  const extra: WorkerOnboardingItem[] = [];
  for (const s of states) {
    if (known.has(s.item_id)) continue;
    const training = TRAINING_BY_MODULE.find((t) => t.id === s.item_id);
    if (!training) continue;
    known.add(s.item_id);
    extra.push({
      id: training.id,
      text: training.text,
      who: "owner",
      counts: "expiry",
      beforeFirstShift: false,
      ask: training.ask,
      source: training.source,
      yourCall: training.yourCall,
      clearanceKind: training.clearanceKind,
    });
  }
  return {
    today,
    row,
    checklist,
    items: [...derived, ...extra],
    states,
    ticks,
    clearances,
    screening:
      clearances.find((c) => c.clearance_kind === "ndis-worker-screening") ??
      null,
    acknowledgements:
      (acksRes.data as (AcknowledgementRow & { id: string })[] | null) ?? [],
    adopted: latestAdopted((docsRes.data as AdoptedDocument[] | null) ?? []),
  };
}

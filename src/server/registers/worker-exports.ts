import "server-only";
/**
 * REQ-024 Session A3 (FR-6, FR-6a, FR-6c): one read of everything the worker
 * exports need, for the owner's pack, the auditor link's pack (the admin
 * client, after the link's own checks) and the account export. The rows
 * come back as the tables hold them; the derived state and items are the
 * same functions the staff list and the worker's page use, so the file
 * says what the screen says.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OnboardingChecklistRow,
  OnboardingItemRow,
  ScreeningExceptionRow,
  StaffMatrixRow,
  SupervisionEntryRow,
} from "@/lib/registers/audit-day-types";
import {
  workerOnboardingItems,
  type WorkerOnboardingItem,
} from "@/lib/registers/onboarding-items";
import { inPeriod, type Period } from "@/lib/registers/period";
import { STATE_FILE } from "@/lib/registers/state-facts";
import type { WorkerClearanceRow } from "@/lib/registers/types";
import type { WorkerExportSnapshot } from "@/lib/registers/worker-exports";
import { listAccountRegisterEvents } from "./audit-day-queries";
import {
  accountModuleIds,
  contextFor,
  listRoles,
  listWorkerStates,
} from "./worker-onboarding";

/** The owner's own worker code, from the owner membership that linked a row (FR-1), for the admin client's reads too. */
export async function ownerRefForAccount(
  supabase: SupabaseClient,
  accountId: string,
): Promise<string | null> {
  const m = await supabase
    .from("memberships")
    .select("worker_ref")
    .eq("account_id", accountId)
    .eq("role", "owner")
    .not("worker_ref", "is", null)
    .limit(1)
    .maybeSingle();
  return ((m.data?.worker_ref as string | null | undefined) ?? null) || null;
}

/** The Part 4 section a state's row relied on, for the screening list's exception column (D-2439). */
export function part4SectionFor(state: string): string | null {
  return STATE_FILE.national.acceptableChecks?.byState[state]?.section ?? null;
}

export async function loadWorkerExportSnapshot(
  supabase: SupabaseClient,
  accountId: string,
  input: {
    today: string;
    asAt?: string;
    /** REQ-024 Session C (D-2832): the pack's period filters the supervision entries; items, ticks and states stay the whole register's. */
    period?: Period;
  },
): Promise<WorkerExportSnapshot> {
  const [
    rows,
    checklists,
    items,
    clearances,
    roles,
    exceptions,
    entries,
    events,
    moduleIds,
    ownerRef,
  ] = await Promise.all([
    supabase
      .from("staff_matrix")
      .select("*")
      .eq("account_id", accountId)
      .order("worker_ref", { ascending: true }),
    supabase
      .from("onboarding_checklists")
      .select("*")
      .eq("account_id", accountId)
      .eq("kind", "worker"),
    supabase.from("onboarding_items").select("*").eq("account_id", accountId),
    supabase.from("worker_clearances").select("*").eq("account_id", accountId),
    listRoles(supabase, accountId),
    supabase
      .from("screening_exceptions")
      .select("*")
      .eq("account_id", accountId)
      .order("started_on", { ascending: true }),
    supabase
      .from("supervision_entries")
      .select("*")
      .eq("account_id", accountId)
      .order("held_on", { ascending: true }),
    listAccountRegisterEvents(supabase, accountId),
    accountModuleIds(supabase, accountId),
    ownerRefForAccount(supabase, accountId),
  ]);
  const staff = (rows.data as StaffMatrixRow[] | null) ?? [];
  const states = await listWorkerStates(supabase, accountId, staff, {
    moduleIds,
    ownerRef,
    today: input.today,
  });
  const itemsByRef = new Map<string, readonly WorkerOnboardingItem[]>();
  for (const r of staff)
    itemsByRef.set(
      r.worker_ref,
      workerOnboardingItems(contextFor(r, moduleIds, ownerRef, input.today)),
    );
  return {
    asAt: input.asAt ?? input.today,
    rows: staff,
    checklists: (checklists.data as OnboardingChecklistRow[] | null) ?? [],
    items: (items.data as OnboardingItemRow[] | null) ?? [],
    clearances: (clearances.data as WorkerClearanceRow[] | null) ?? [],
    roles,
    exceptions: (exceptions.data as ScreeningExceptionRow[] | null) ?? [],
    entries: ((entries.data as SupervisionEntryRow[] | null) ?? []).filter(
      (e) => !input.period || inPeriod(e.held_on, input.period),
    ),
    events,
    states,
    itemsByRef,
  };
}

import "server-only";
/**
 * REQ-024 Session A1: the worker file the owner's pages read and the writes
 * that keep it whole (FR-1, FR-2, FR-3; D-2402, D-2411, D-2416, D-2431).
 * Everything here runs with the caller's session so RLS applies; the
 * derived list and state are the pure functions in `src/lib/registers`,
 * called with the request's Sydney day (D-2242). Workers are codes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";
import type {
  OnboardingChecklistRow,
  OnboardingItemRow,
  RiskAssessedRoleRow,
  StaffMatrixRow,
} from "@/lib/registers/audit-day-types";
import {
  WORKER_ROLE_LABELS,
  WORKER_ROLES,
  workerOnboardingItems,
  type WorkerItemContext,
  type WorkerOnboardingItem,
  type WorkerRole,
} from "@/lib/registers/onboarding-items";
import type { WorkerClearanceRow } from "@/lib/registers/types";
import {
  deriveWorkerState,
  type WorkerState,
} from "@/lib/registers/worker-state";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import {
  exceptionContext,
  listOpenExceptions,
  type ExceptionContext,
} from "./exception-queries";

/** The request's Sydney day (D-2242). */
export function todaySydney(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * The account's Practice Standards module ids: the newest ready set's stored
 * result (D-2726), else the questionnaire draft's result the caller passes,
 * else none (a verification-only list, W-7 absent).
 */
export async function accountModuleIds(
  supabase: SupabaseClient,
  accountId: string,
  draftResult?: QuestionnaireResult | null,
): Promise<string[]> {
  const set = await supabase
    .from("version_sets")
    .select("derived_result")
    .eq("account_id", accountId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const stored = set.data?.derived_result as QuestionnaireResult | undefined;
  const result = stored ?? draftResult ?? null;
  // A set seeded without `modules` (a test fixture, an older row) is no modules, not a throw (#85's run 38950408510).
  return result?.modules?.map((m) => m.id) ?? [];
}

/** D-2416: the six closed roles, seeded once per account, unassessed; idempotent on `(account_id, seed_code)`. */
export async function seedRiskAssessedRoles(
  supabase: SupabaseClient,
  accountId: string,
): Promise<void> {
  const existing = await supabase
    .from("risk_assessed_roles")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if ((existing.count ?? 0) > 0) return;
  const rows = WORKER_ROLES.map((code) => ({
    account_id: accountId,
    title: WORKER_ROLE_LABELS[code],
    paragraphs: code === "key-personnel" ? ["a"] : [],
    description: "",
    seed_code: code,
  }));
  const ins = await supabase
    .from("risk_assessed_roles")
    .upsert(rows, {
      onConflict: "account_id,seed_code",
      ignoreDuplicates: true,
    })
    .select("id");
  if (ins.error) {
    log.warn("registers.roles.seed.failed", {
      accountId,
      code: ins.error.code,
    });
    return;
  }
  for (const r of (ins.data as { id: string }[] | null) ?? [])
    await supabase.from("register_events").insert({
      account_id: accountId,
      register: "risk_assessed_roles",
      row_id: r.id,
      kind: "created",
      note: "seeded",
    });
}

export async function listRoles(
  supabase: SupabaseClient,
  accountId: string,
): Promise<RiskAssessedRoleRow[]> {
  const r = await supabase
    .from("risk_assessed_roles")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });
  return (r.data as RiskAssessedRoleRow[] | null) ?? [];
}

/** The owner's own membership's `worker_ref` (FR-1), null when the owner has not linked a row. */
export async function ownerWorkerRef(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
): Promise<{ workerRef: string | null } | null> {
  // `memberships` is keyed `(user_id, account_id)`; it has no id of its own.
  const m = await supabase
    .from("memberships")
    .select("worker_ref")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!m.data) return null;
  return { workerRef: (m.data.worker_ref as string | null) ?? null };
}

/** FR-2: the worker's item context from the matrix row, the account's modules and whether the row is the owner's own. */
export function contextFor(
  row: Pick<
    StaffMatrixRow,
    | "role"
    | "states"
    | "works_with_children"
    | "may_use_restrictive_practice"
    | "risk_assessed"
    | "worker_ref"
  >,
  moduleIds: readonly string[],
  ownerRef: string | null,
  today: string,
): WorkerItemContext {
  return {
    role: (row.role as WorkerRole | null) ?? null,
    states: row.states ?? [],
    worksWithChildren: row.works_with_children,
    mayUseRestrictivePractice: row.may_use_restrictive_practice,
    ownerRow: ownerRef !== null && ownerRef === row.worker_ref,
    riskAssessed: row.risk_assessed,
    moduleIds,
    today,
  };
}

/** FR-2 (Dev answer 1): the worker's checklist exists (started today when it does not) and every derived item has its row; idempotent. */
export async function ensureWorkerChecklist(
  supabase: SupabaseClient,
  accountId: string,
  workerRef: string,
  items: readonly WorkerOnboardingItem[],
  today: string,
): Promise<OnboardingChecklistRow | null> {
  let list = await supabase
    .from("onboarding_checklists")
    .select("*")
    .eq("account_id", accountId)
    .eq("kind", "worker")
    .eq("subject_ref", workerRef)
    .maybeSingle();
  if (!list.data) {
    const ins = await supabase
      .from("onboarding_checklists")
      .insert({
        account_id: accountId,
        kind: "worker",
        subject_ref: workerRef,
        started_on: today,
      })
      .select("*")
      .single();
    if (ins.error) {
      // Another request made it first, or the subscription has lapsed: read what is there.
      list = await supabase
        .from("onboarding_checklists")
        .select("*")
        .eq("account_id", accountId)
        .eq("kind", "worker")
        .eq("subject_ref", workerRef)
        .maybeSingle();
      if (!list.data) return null;
    } else list = ins;
  }
  const checklist = list.data as OnboardingChecklistRow;
  await ensureItems(supabase, accountId, checklist.id, items);
  return checklist;
}

/** One `onboarding_items` row per derived item, `on conflict do nothing` through `ignoreDuplicates` (the seedCorporateRisks pattern). */
export async function ensureItems(
  supabase: SupabaseClient,
  accountId: string,
  checklistId: string,
  items: readonly WorkerOnboardingItem[],
): Promise<void> {
  if (items.length === 0) return;
  const ins = await supabase.from("onboarding_items").upsert(
    items.map((i) => ({
      account_id: accountId,
      checklist_id: checklistId,
      item_id: i.id,
      owner_role: i.who,
    })),
    { onConflict: "checklist_id,item_id", ignoreDuplicates: true },
  );
  if (ins.error)
    log.warn("registers.onboarding-items.fill.failed", {
      accountId,
      code: ins.error.code,
    });
}

export async function listItems(
  supabase: SupabaseClient,
  accountId: string,
  checklistId: string,
): Promise<OnboardingItemRow[]> {
  const r = await supabase
    .from("onboarding_items")
    .select("*")
    .eq("account_id", accountId)
    .eq("checklist_id", checklistId);
  return (r.data as OnboardingItemRow[] | null) ?? [];
}

export async function listWorkerClearances(
  supabase: SupabaseClient,
  accountId: string,
  workerRef: string,
): Promise<WorkerClearanceRow[]> {
  const r = await supabase
    .from("worker_clearances")
    .select("*")
    .eq("account_id", accountId)
    .eq("worker_ref", workerRef)
    .order("created_at", { ascending: true });
  return (r.data as WorkerClearanceRow[] | null) ?? [];
}

export type WorkerFile = {
  row: StaffMatrixRow;
  checklist: OnboardingChecklistRow | null;
  items: WorkerOnboardingItem[];
  states: OnboardingItemRow[];
  clearances: WorkerClearanceRow[];
  derived: WorkerState;
  role: RiskAssessedRoleRow | null;
  ownerRow: boolean;
  /** REQ-024 A2 (FR-4): the s 14 exception's gates, the open row and its history; null for a worker who is not risk assessed. */
  exception: ExceptionContext | null;
};

/** FR-3: one worker's file for the owner's page: the row, the derived list and state, the items' state rows and the clearances. */
export async function loadWorkerFile(
  supabase: SupabaseClient,
  accountId: string,
  row: StaffMatrixRow,
  input: {
    moduleIds: readonly string[];
    ownerRef: string | null;
    today: string;
    canWrite: boolean;
  },
): Promise<WorkerFile> {
  const ctx = contextFor(row, input.moduleIds, input.ownerRef, input.today);
  const items = workerOnboardingItems(ctx);
  const checklist = input.canWrite
    ? await ensureWorkerChecklist(
        supabase,
        accountId,
        row.worker_ref,
        items,
        input.today,
      )
    : ((
        await supabase
          .from("onboarding_checklists")
          .select("*")
          .eq("account_id", accountId)
          .eq("kind", "worker")
          .eq("subject_ref", row.worker_ref)
          .maybeSingle()
      ).data as OnboardingChecklistRow | null);
  const [states, clearances, role] = await Promise.all([
    checklist
      ? listItems(supabase, accountId, checklist.id)
      : Promise.resolve([]),
    listWorkerClearances(supabase, accountId, row.worker_ref),
    row.role_ref
      ? supabase
          .from("risk_assessed_roles")
          .select("*")
          .eq("id", row.role_ref)
          .maybeSingle()
          .then((r) => (r.data as RiskAssessedRoleRow | null) ?? null)
      : Promise.resolve(null),
  ]);
  // REQ-024 A2 (FR-4): the exception is a risk-assessed worker's; the gates
  // read with the declaration taken as ticked, the start form holding the tick.
  const exception = row.risk_assessed
    ? await exceptionContext(supabase, accountId, row, {
        clearances,
        ownerRow: ctx.ownerRow,
        today: input.today,
      })
    : null;
  const derived = deriveWorkerState({
    worker: {
      worker_ref: row.worker_ref,
      states: row.states ?? [],
      risk_assessed: row.risk_assessed,
      ended_on: row.ended_on,
      role_assessed_on: role?.assessed_on ?? null,
      role_ref: row.role_ref,
    },
    items,
    states,
    clearances,
    today: input.today,
    exception: exception
      ? {
          running: exception.exception !== null,
          offered: exception.exception === null && exception.gate.offered,
          supervisorClearances: exception.supervisorClearances,
        }
      : null,
  });
  return {
    row,
    checklist,
    items,
    states,
    clearances,
    derived,
    role,
    ownerRow: ctx.ownerRow,
    exception,
  };
}

/** FR-3: the derived state of every worker for the staff list, keyed by code; reads, never writes. */
export async function listWorkerStates(
  supabase: SupabaseClient,
  accountId: string,
  rows: readonly StaffMatrixRow[],
  input: {
    moduleIds: readonly string[];
    ownerRef: string | null;
    today: string;
  },
): Promise<Map<string, WorkerState>> {
  const [lists, items, clearances, roles, open] = await Promise.all([
    supabase
      .from("onboarding_checklists")
      .select("id, subject_ref")
      .eq("account_id", accountId)
      .eq("kind", "worker"),
    supabase.from("onboarding_items").select("*").eq("account_id", accountId),
    supabase.from("worker_clearances").select("*").eq("account_id", accountId),
    listRoles(supabase, accountId),
    listOpenExceptions(supabase, accountId),
  ]);
  const listByRef = new Map(
    ((lists.data as { id: string; subject_ref: string }[] | null) ?? []).map(
      (l) => [l.subject_ref, l.id],
    ),
  );
  const itemRows = (items.data as OnboardingItemRow[] | null) ?? [];
  const clearanceRows = (clearances.data as WorkerClearanceRow[] | null) ?? [];
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const out = new Map<string, WorkerState>();
  for (const row of rows) {
    const ctx = contextFor(row, input.moduleIds, input.ownerRef, input.today);
    const listId = listByRef.get(row.worker_ref);
    out.set(
      row.worker_ref,
      deriveWorkerState({
        worker: {
          worker_ref: row.worker_ref,
          states: row.states ?? [],
          risk_assessed: row.risk_assessed,
          ended_on: row.ended_on,
          role_assessed_on: row.role_ref
            ? (roleById.get(row.role_ref)?.assessed_on ?? null)
            : null,
          role_ref: row.role_ref,
        },
        items: workerOnboardingItems(ctx),
        states: listId ? itemRows.filter((i) => i.checklist_id === listId) : [],
        clearances: clearanceRows.filter(
          (c) => c.worker_ref === row.worker_ref,
        ),
        today: input.today,
        // REQ-024 A2 (FR-4, AC-14): a running exception on the list reads its
        // label and the supervisor's own screening rows for s 15(2)(f).
        exception: (() => {
          const running = open.get(row.worker_ref);
          return running
            ? {
                running: true,
                offered: false,
                supervisorClearances: clearanceRows.filter(
                  (c) =>
                    c.clearance_kind === "ndis-worker-screening" &&
                    c.worker_ref === running.supervisor_ref,
                ),
              }
            : null;
        })(),
      }),
    );
  }
  return out;
}

/**
 * FR-1 after a staff row is saved: the six roles seeded, `role_ref` set from
 * the closed role, `first_held_on` on the role the first time a current
 * worker holds it, the forced flag for key personnel and the owner's own
 * row, `risk_assessed_from` set when the flag turns true and, when it turns
 * false, a `role-changed` event with the fixed note first (findings 58 and
 * 107), the owner's membership linked through `set_owner_worker_ref` when
 * "this row is me" was ticked (D-2431), and the worker's checklist with its
 * derived items. Returns a plain message when the link was refused.
 */
export async function afterStaffMatrixSave(
  supabase: SupabaseClient,
  input: {
    accountId: string;
    userId: string;
    rowId: string;
    before: Pick<
      StaffMatrixRow,
      "risk_assessed" | "role" | "risk_assessed_from" | "role_ref"
    > | null;
    isMe: boolean;
    effectiveOn: string;
    moduleIds: readonly string[];
    today: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fresh = await supabase
    .from("staff_matrix")
    .select("*")
    .eq("id", input.rowId)
    .eq("account_id", input.accountId)
    .maybeSingle();
  if (!fresh.data) return { ok: false, message: "That worker was not found." };
  const row = fresh.data as StaffMatrixRow;
  await seedRiskAssessedRoles(supabase, input.accountId);
  const roles = await listRoles(supabase, input.accountId);
  const owner = await ownerWorkerRef(supabase, input.accountId, input.userId);
  let ownerRef = owner?.workerRef ?? null;

  // The owner's own row (FR-1, finding 64): link once; a refusal is a plain message, the row stays saved.
  if (input.isMe && owner && owner.workerRef !== row.worker_ref) {
    const link = await supabase.rpc("set_owner_worker_ref", {
      p_account: input.accountId,
      p_ref: row.worker_ref,
    });
    if (link.error)
      return {
        ok: false,
        message:
          owner.workerRef === null
            ? "This code could not be linked to you: another row or another member already holds it."
            : `Your own row is ${owner.workerRef} and cannot be re-pointed.`,
      };
    ownerRef = row.worker_ref;
  }

  const patch: Record<string, unknown> = {};
  // The forced flag: key personnel and the owner's own row are risk assessed by definition (W-1).
  const forced = row.role === "key-personnel" || ownerRef === row.worker_ref;
  const riskAssessed = forced ? true : row.risk_assessed;
  if (riskAssessed !== row.risk_assessed) patch.risk_assessed = riskAssessed;
  if (forced && !row.risk_paragraph) patch.risk_paragraph = "a";
  // The s 17 role (D-2416): the seeded row for the closed role.
  const role = row.role
    ? (roles.find((r) => r.seed_code === row.role) ?? null)
    : null;
  if ((role?.id ?? null) !== row.role_ref) patch.role_ref = role?.id ?? null;
  // The s 20 dates (findings 58 and 107).
  const wasAssessed = input.before?.risk_assessed ?? false;
  if (riskAssessed && !row.risk_assessed_from)
    patch.risk_assessed_from = input.effectiveOn;
  if (!riskAssessed && wasAssessed) {
    await supabase.from("register_events").insert({
      account_id: input.accountId,
      register: "staff_matrix",
      row_id: row.id,
      kind: "role-changed",
      note: `from=${input.before?.role ?? "unknown"} to=${row.role ?? "unknown"} on=${input.effectiveOn}`,
    });
    patch.risk_assessed_from = null;
  }
  if (Object.keys(patch).length > 0) {
    const upd = await supabase
      .from("staff_matrix")
      .update(patch)
      .eq("id", row.id)
      .eq("account_id", input.accountId);
    if (upd.error)
      log.warn("registers.staff.after-save.failed", {
        accountId: input.accountId,
        code: upd.error.code,
      });
  }
  // The role's reminder clock starts the first time a current worker holds it (D-2416).
  if (role && !role.first_held_on && !row.ended_on)
    await supabase
      .from("risk_assessed_roles")
      .update({ first_held_on: input.effectiveOn })
      .eq("id", role.id)
      .eq("account_id", input.accountId)
      .is("first_held_on", null);
  // A worker who has ended: the event (FR-12; the membership's revocation is Session C's).
  if (row.ended_on && !input.before)
    await supabase.from("register_events").insert({
      account_id: input.accountId,
      register: "staff_matrix",
      row_id: row.id,
      kind: "ended",
      note: `ended on ${row.ended_on}`,
    });
  // The worker's checklist and its derived items (FR-2).
  const ctx = contextFor(
    { ...row, risk_assessed: riskAssessed },
    input.moduleIds,
    ownerRef,
    input.today,
  );
  await ensureWorkerChecklist(
    supabase,
    input.accountId,
    row.worker_ref,
    workerOnboardingItems(ctx),
    input.today,
  );
  return { ok: true };
}

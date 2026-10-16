import "server-only";
/**
 * REQ-024 A2: the reads behind the s 14 exception (FR-4, FR-4a; D-2403,
 * D-2421, D-2427, D-2428, D-2434). Everything runs with the caller's session
 * so RLS applies; the gates themselves are the pure function in
 * `src/lib/registers/exception-gates.ts`, called with the request's Sydney
 * day (D-2242).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasDivision3Plan,
  WORKER_SCREENING_PROCEDURE_ID,
} from "@/lib/generator/division3";
import type { DocumentModel } from "@/lib/generator/document-model";
import type {
  ScreeningExceptionRow,
  StaffMatrixRow,
} from "@/lib/registers/audit-day-types";
import {
  exceptionGate,
  type ExceptionGate,
  type SupervisorCandidate,
} from "@/lib/registers/exception-gates";
import type { WorkerClearanceRow } from "@/lib/registers/types";
import { participantRiskSnapshot } from "./participant-risk-snapshot";

/** The open exception for one worker, or null. */
export async function openException(
  supabase: SupabaseClient,
  accountId: string,
  workerRef: string,
): Promise<ScreeningExceptionRow | null> {
  const r = await supabase
    .from("screening_exceptions")
    .select("*")
    .eq("account_id", accountId)
    .eq("worker_ref", workerRef)
    .is("ended_on", null)
    .maybeSingle();
  return (r.data as ScreeningExceptionRow | null) ?? null;
}

/** Every open exception in the account, by worker code (the staff list). */
export async function listOpenExceptions(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Map<string, ScreeningExceptionRow>> {
  const r = await supabase
    .from("screening_exceptions")
    .select("*")
    .eq("account_id", accountId)
    .is("ended_on", null);
  return new Map(
    ((r.data as ScreeningExceptionRow[] | null) ?? []).map((x) => [
      x.worker_ref,
      x,
    ]),
  );
}

/** Every exception of one worker, newest first (the worker's page and the s 20 trail). */
export async function listWorkerExceptions(
  supabase: SupabaseClient,
  accountId: string,
  workerRef: string,
): Promise<ScreeningExceptionRow[]> {
  const r = await supabase
    .from("screening_exceptions")
    .select("*")
    .eq("account_id", accountId)
    .eq("worker_ref", workerRef)
    .order("started_on", { ascending: false });
  return (r.data as ScreeningExceptionRow[] | null) ?? [];
}

export type PlanVersion = {
  id: string;
  version: number;
  adopted_on: string;
  versionSetId: string;
};

/**
 * FR-4's third line (D-2421, D-2427, D-2428): the newest version of the worker
 * screening and recruitment procedure with `adopted_on` set that carries the
 * Division 3 section, in any set; null until one exists.
 */
export async function adoptedPlanVersion(
  supabase: SupabaseClient,
  accountId: string,
): Promise<PlanVersion | null> {
  const r = await supabase
    .from("document_versions")
    .select("id, version, adopted_on, version_set_id, model")
    .eq("account_id", accountId)
    .eq("document_type_id", WORKER_SCREENING_PROCEDURE_ID)
    .not("adopted_on", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  for (const row of (r.data as
    | {
        id: string;
        version: number;
        adopted_on: string;
        version_set_id: string;
        model: DocumentModel;
      }[]
    | null) ?? []) {
    if (hasDivision3Plan(row.model))
      return {
        id: row.id,
        version: row.version,
        adopted_on: row.adopted_on,
        versionSetId: row.version_set_id,
      };
  }
  return null;
}

/** The account's `ndis-worker-screening` rows, the candidates to supervise (gate i). */
export async function screeningRows(
  supabase: SupabaseClient,
  accountId: string,
): Promise<WorkerClearanceRow[]> {
  const r = await supabase
    .from("worker_clearances")
    .select("*")
    .eq("account_id", accountId)
    .eq("clearance_kind", "ndis-worker-screening");
  return (r.data as WorkerClearanceRow[] | null) ?? [];
}

export function asCandidate(c: WorkerClearanceRow): SupervisorCandidate {
  return {
    worker_ref: c.worker_ref,
    issued_on: c.issued_on,
    expires_on: c.expires_on,
    verified_in_database_on: c.verified_in_database_on,
    decision_code: c.decision_code ?? null,
  };
}

export type ExceptionContext = {
  /** The gates read with the declaration taken as ticked; the start form holds the tick itself (gate iv). */
  gate: ExceptionGate;
  exception: ScreeningExceptionRow | null;
  history: ScreeningExceptionRow[];
  /** The worker's pending `ndis-worker-screening` row, if one exists. */
  application: WorkerClearanceRow | null;
  plan: PlanVersion | null;
  registerRowCount: number;
  registerDate: string | null;
  /** The supervisor's own `ndis-worker-screening` rows while an exception runs (s 15(2)(f)). */
  supervisorClearances: WorkerClearanceRow[];
};

/** Everything the worker's page and the start action need to judge the exception, read once. */
export async function exceptionContext(
  supabase: SupabaseClient,
  accountId: string,
  row: StaffMatrixRow,
  input: {
    clearances: readonly WorkerClearanceRow[];
    ownerRow: boolean;
    today: string;
    declarationTicked?: boolean;
  },
): Promise<ExceptionContext> {
  const [exception, history, plan, candidates, snapshot] = await Promise.all([
    openException(supabase, accountId, row.worker_ref),
    listWorkerExceptions(supabase, accountId, row.worker_ref),
    adoptedPlanVersion(supabase, accountId),
    screeningRows(supabase, accountId),
    participantRiskSnapshot(supabase, accountId, input.today),
  ]);
  const application =
    input.clearances.find(
      (c) => c.clearance_kind === "ndis-worker-screening" && !c.issued_on,
    ) ?? null;
  const gate = exceptionGate({
    workerRef: row.worker_ref,
    states: row.states ?? [],
    ownRow: input.ownerRow,
    application: application
      ? {
          state: application.state,
          application_number: application.application_number || null,
        }
      : null,
    candidates: candidates.map(asCandidate),
    declarationTicked: input.declarationTicked ?? true,
    plan: plan
      ? { versionNumber: plan.version, adoptedOn: plan.adopted_on }
      : null,
    registerRowCount: snapshot.rows.length,
    registerDate: snapshot.lastReviewedOn,
    today: input.today,
  });
  const supervisorClearances = exception?.supervisor_ref
    ? candidates.filter((c) => c.worker_ref === exception.supervisor_ref)
    : [];
  return {
    gate,
    exception,
    history,
    application,
    plan,
    registerRowCount: snapshot.rows.length,
    registerDate: snapshot.lastReviewedOn,
    supervisorClearances,
  };
}

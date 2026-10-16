"use server";
/**
 * REQ-024 A2: the writes behind the s 14 exception (FR-4, FR-4a, FR-5;
 * D-2403, D-2413, D-2424, D-2428, D-2434 as amended, D-2439 as amended).
 * Every boundary parses a strict object; every write runs with the owner's
 * session so RLS and the subscription gate apply in the database, except
 * the procedure's new version, which the admin client writes the way the
 * generation job does after the set is proven to be the owner's. Refusals
 * are plain words; the trail's notes carry words and never a uuid.
 */
import {
  insertDivision3Plan,
  WORKER_SCREENING_PROCEDURE_ID,
} from "@/lib/generator/division3";
import { renderDocx } from "@/lib/generator/render-docx";
import { log } from "@/lib/logging/logger";
import type {
  ScreeningExceptionRow,
  StaffMatrixRow,
} from "@/lib/registers/audit-day-types";
import {
  EndExceptionForm,
  RecordApplicationForm,
  RecordDecisionForm,
  RecordOwnCallForm,
  StartExceptionForm,
  UpdateProcedureForm,
} from "@/lib/registers/exception-forms";
import {
  DECLARATION_LINE,
  exceptionEndedNote,
  exceptionStartedNote,
  PART4_AFTER_MESSAGE,
  PART4_CODES,
} from "@/lib/registers/exception-gates";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import { formatLongDay } from "@/lib/registers/state-facts";
import { parseInput } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";
import {
  getVersionSet,
  listLatestDocuments,
} from "@/server/generation/queries";
import { refreshSetSummary } from "@/server/generation/rerender";
import { DOCX_TYPE } from "@/server/generation/run";
import { objectPath } from "@/server/generation/storage";
import { SupabaseGenerationStore } from "@/server/generation/store";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { exceptionContext } from "./exception-queries";
import { participantRiskSnapshot } from "./participant-risk-snapshot";
import {
  listWorkerClearances,
  ownerWorkerRef,
  todaySydney,
} from "./worker-onboarding";

export type ExceptionActionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };

const SIGN_IN: ExceptionActionResult = {
  ok: false,
  message: "Sign in to use the registers.",
};
const LIMITED: ExceptionActionResult = {
  ok: false,
  message: "Too many changes in a minute. Wait a moment and try again.",
};

async function context() {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return null;
  if (!(await checkRegisterWriteAllowed(viewer.user.id))) return "limited";
  return {
    viewer,
    account: viewer.account,
    supabase: await createSupabaseServerClient(),
  };
}
type Ctx = Exclude<Awaited<ReturnType<typeof context>>, null | "limited">;

function failed(parsed: {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}): ExceptionActionResult {
  return {
    ok: false,
    message: "Check the form.",
    fieldErrors: parsed.fieldErrors,
    formErrors: parsed.formErrors,
  };
}

async function trail(
  ctx: Ctx,
  register: string,
  rowId: string,
  kind: string,
  note: string,
) {
  const r = await ctx.supabase.from("register_events").insert({
    account_id: ctx.account.id,
    register,
    row_id: rowId,
    kind,
    note,
  });
  if (r.error)
    log.warn("registers.trail.failed", {
      accountId: ctx.account.id,
      table: register,
      code: r.error.code,
    });
}

async function audit(ctx: Ctx, action: string, target: string) {
  await ctx.supabase.from("audit_log").insert({
    account_id: ctx.account.id,
    actor_user_id: ctx.viewer.user.id,
    action,
    target,
  });
}

async function matrixRow(
  ctx: Ctx,
  workerRef: string,
): Promise<StaffMatrixRow | null> {
  const r = await ctx.supabase
    .from("staff_matrix")
    .select("*")
    .eq("account_id", ctx.account.id)
    .eq("worker_ref", workerRef)
    .maybeSingle();
  return (r.data as StaffMatrixRow | null) ?? null;
}

/**
 * The "record the application" item (FR-4, FR-5; findings 109 and 157): the
 * pending `ndis-worker-screening` row with the application number, the state
 * it was submitted in, the day the owner confirmed it in the database, the
 * matrix row's role label copied in, and no issue date.
 */
export async function recordApplicationAction(
  input: unknown,
): Promise<ExceptionActionResult> {
  const parsed = parseInput(RecordApplicationForm, input);
  if (!parsed.ok) return failed(parsed);
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const v = parsed.data;
  const row = await matrixRow(ctx, v.workerRef);
  if (!row) return { ok: false, message: "That worker was not found." };
  const existing = (
    await listWorkerClearances(ctx.supabase, ctx.account.id, v.workerRef)
  ).find((c) => c.clearance_kind === "ndis-worker-screening" && !c.issued_on);
  if (existing)
    return {
      ok: false,
      message:
        "This worker already has a pending application recorded. Type the clearance's details on that row when the unit decides.",
    };
  const ins = await ctx.supabase
    .from("worker_clearances")
    .insert({
      account_id: ctx.account.id,
      worker_ref: v.workerRef,
      role_label: row.role_label,
      clearance_kind: "ndis-worker-screening",
      clearance_number: "",
      application_number: v.applicationNumber,
      issued_on: null,
      expires_on: null,
      verified_in_database_on: v.verifiedOn,
      state: v.state,
      note: "",
    })
    .select("id")
    .single();
  if (ins.error) return { ok: false, message: plainDatabaseMessage(ins.error) };
  const id = ins.data.id as string;
  await trail(
    ctx,
    "worker_clearances",
    id,
    "created",
    `application recorded; confirmed in the database on ${formatLongDay(v.verifiedOn)}`,
  );
  await audit(ctx, "register.worker-check.created", id);
  return { ok: true, id };
}

/**
 * Starting the gated exception (FR-4; D-2403, D-2434): the gates are read
 * again on the server with the tick the form sent; a refusal lists the lines
 * the page showed; one row with the five dates, the supervisor, the pinned
 * procedure version and the register's date; the `exception-started` event
 * in words.
 */
export async function startExceptionAction(
  input: unknown,
): Promise<ExceptionActionResult> {
  const parsed = parseInput(StartExceptionForm, input);
  if (!parsed.ok) return failed(parsed);
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const v = parsed.data;
  const row = await matrixRow(ctx, v.workerRef);
  if (!row) return { ok: false, message: "That worker was not found." };
  const today = todaySydney();
  const owner = await ownerWorkerRef(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
  );
  const ownerRow = owner?.workerRef === row.worker_ref;
  const clearances = await listWorkerClearances(
    ctx.supabase,
    ctx.account.id,
    row.worker_ref,
  );
  const ex = await exceptionContext(ctx.supabase, ctx.account.id, row, {
    clearances,
    ownerRow,
    today,
    declarationTicked: v.declaration,
  });
  if (ex.exception)
    return {
      ok: false,
      message: `An exception is already running for ${row.worker_ref}; record how it ended first.`,
    };
  if (!ex.gate.offered)
    return {
      ok: false,
      message: `The exception cannot start: ${ex.gate.reasons.join("; ")}.`,
      formErrors: ex.gate.reasons,
    };
  if (!ex.gate.supervisors.includes(v.supervisorRef))
    return {
      ok: false,
      message: `${v.supervisorRef} does not hold a current clearance verified in the database; choose one of ${ex.gate.supervisors.join(", ")}.`,
      fieldErrors: { supervisorRef: ["Choose a cleared supervisor"] },
    };
  if (!v.declaration) return { ok: false, message: DECLARATION_LINE };
  const plan = ex.plan!;
  const ins = await ctx.supabase
    .from("screening_exceptions")
    .insert({
      account_id: ctx.account.id,
      worker_ref: row.worker_ref,
      clearance_id: ex.application!.id,
      code: ownerRow ? "s14-2a" : "s14-1a",
      started_on: v.startedOn,
      verified_on: v.verifiedOn,
      notice_seen_on: v.noticeSeenOn,
      supervisor_ref: v.supervisorRef,
      declaration_on: v.declarationOn,
      plan_version_id: plan.id,
      plan_register_date: ex.registerDate ?? today,
    })
    .select("id")
    .single();
  if (ins.error) return { ok: false, message: plainDatabaseMessage(ins.error) };
  const id = ins.data.id as string;
  // The clearance row carries the database check's day too (s 15(4)).
  if (!ex.application!.verified_in_database_on)
    await ctx.supabase
      .from("worker_clearances")
      .update({ verified_in_database_on: v.verifiedOn })
      .eq("id", ex.application!.id)
      .eq("account_id", ctx.account.id);
  await trail(
    ctx,
    "screening_exceptions",
    id,
    "exception-started",
    exceptionStartedNote({
      versionNumber: plan.version,
      adoptedOn: plan.adopted_on,
      registerDate: ex.registerDate ?? today,
    }),
  );
  await audit(ctx, "register.exception.started", id);
  return { ok: true, id };
}

async function loadException(
  ctx: Ctx,
  id: string,
): Promise<ScreeningExceptionRow | null> {
  const r = await ctx.supabase
    .from("screening_exceptions")
    .select("*")
    .eq("id", id)
    .eq("account_id", ctx.account.id)
    .maybeSingle();
  return (r.data as ScreeningExceptionRow | null) ?? null;
}

/**
 * Ending an exception (FR-4; D-2413, D-2434; finding 168): one of the eight
 * codes with its date; `clearance-issued` writes the clearance row's
 * `issued_on`, `excluded` writes its decision code and date; the
 * `exception-ended` event in words.
 */
export async function endExceptionAction(
  input: unknown,
): Promise<ExceptionActionResult> {
  const parsed = parseInput(EndExceptionForm, input);
  if (!parsed.ok) return failed(parsed);
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const v = parsed.data;
  const row = await loadException(ctx, v.exceptionId);
  if (!row) return { ok: false, message: "That exception was not found." };
  if (row.ended_on)
    return {
      ok: false,
      message: `This exception ended on ${formatLongDay(row.ended_on)}; it is not changed.`,
    };
  const upd = await ctx.supabase
    .from("screening_exceptions")
    .update({ ended_on: v.endedOn, end_code: v.endCode })
    .eq("id", row.id)
    .eq("account_id", ctx.account.id);
  if (upd.error) return { ok: false, message: plainDatabaseMessage(upd.error) };
  if (row.clearance_id && v.endCode === "clearance-issued") {
    const c = await ctx.supabase
      .from("worker_clearances")
      .update({ issued_on: v.endedOn })
      .eq("id", row.clearance_id)
      .eq("account_id", ctx.account.id);
    if (c.error) return { ok: false, message: plainDatabaseMessage(c.error) };
  }
  if (row.clearance_id && v.endCode === "excluded") {
    const c = await ctx.supabase
      .from("worker_clearances")
      .update({ decision_code: "excluded", decision_on: v.endedOn })
      .eq("id", row.clearance_id)
      .eq("account_id", ctx.account.id);
    if (c.error) return { ok: false, message: plainDatabaseMessage(c.error) };
  }
  await trail(
    ctx,
    "screening_exceptions",
    row.id,
    "exception-ended",
    exceptionEndedNote(v.endCode, v.endedOn),
  );
  await audit(ctx, "register.exception.ended", row.id);
  return { ok: true, id: row.id };
}

/**
 * The three own-call codes (W-1a, FR-6a; D-2439 as amended): a code and
 * dates, the Part 4 codes with their state; the database refuses a Part 4
 * start after 31 January 2026 and the owner reads why.
 */
export async function recordOwnCallAction(
  input: unknown,
): Promise<ExceptionActionResult> {
  const parsed = parseInput(RecordOwnCallForm, input);
  if (!parsed.ok) return failed(parsed);
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const v = parsed.data;
  const row = await matrixRow(ctx, v.workerRef);
  if (!row) return { ok: false, message: "That worker was not found." };
  const ins = await ctx.supabase
    .from("screening_exceptions")
    .insert({
      account_id: ctx.account.id,
      worker_ref: v.workerRef,
      code: v.code,
      part4_state: v.part4State,
      started_on: v.startedOn,
      ended_on: v.endedOn,
      end_code: v.endCode,
    })
    .select("id")
    .single();
  if (ins.error) {
    if (
      ins.error.code === "23514" &&
      (PART4_CODES as readonly string[]).includes(v.code) &&
      /part4_start/.test(ins.error.message ?? "")
    )
      return {
        ok: false,
        message: PART4_AFTER_MESSAGE,
        fieldErrors: { startedOn: [PART4_AFTER_MESSAGE] },
      };
    return { ok: false, message: plainDatabaseMessage(ins.error) };
  }
  const id = ins.data.id as string;
  await trail(
    ctx,
    "screening_exceptions",
    id,
    "created",
    `${v.code} recorded, started ${formatLongDay(v.startedOn)}${v.endedOn ? `, ended ${formatLongDay(v.endedOn)}` : ""}`,
  );
  await audit(ctx, "register.exception.recorded", id);
  return { ok: true, id };
}

/** A unit's decision typed on the clearance row (D-2413): the closed code and its date; the row reads as not cleared from then on. */
export async function recordDecisionAction(
  input: unknown,
): Promise<ExceptionActionResult> {
  const parsed = parseInput(RecordDecisionForm, input);
  if (!parsed.ok) return failed(parsed);
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const v = parsed.data;
  const upd = await ctx.supabase
    .from("worker_clearances")
    .update({ decision_code: v.decisionCode, decision_on: v.decisionOn })
    .eq("id", v.clearanceId)
    .eq("account_id", ctx.account.id)
    .select("id")
    .maybeSingle();
  if (upd.error) return { ok: false, message: plainDatabaseMessage(upd.error) };
  if (!upd.data) return { ok: false, message: "That row was not found." };
  await trail(
    ctx,
    "worker_clearances",
    v.clearanceId,
    "updated",
    `unit decision ${v.decisionCode.replace(/-/g, " ")} on ${formatLongDay(v.decisionOn)}`,
  );
  await audit(ctx, "register.worker-check.updated", v.clearanceId);
  return { ok: true, id: v.clearanceId };
}

/**
 * "Update the procedure" (FR-4a; D-2424, D-2428; finding 192): the worker
 * screening and recruitment procedure's latest version in the owner's set
 * takes the participant risk register's rows, by code, as a new version the
 * owner adopts; the snapshot is retaken here and nowhere else. The admin
 * client writes the version and refreshes the zip, as the job does, after
 * the set is proven to be the owner's.
 */
export async function updateProcedureAction(
  input: unknown,
): Promise<ExceptionActionResult> {
  const parsed = parseInput(UpdateProcedureForm, input);
  if (!parsed.ok) return failed(parsed);
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const set = await getVersionSet(ctx.supabase, parsed.data.setId);
  if (!set || set.account_id !== ctx.account.id || set.status !== "ready")
    return { ok: false, message: "That set was not found." };
  const admin = createSupabaseAdminClient();
  const latest = (await listLatestDocuments(admin, set.id)).find(
    (d) => d.document_type_id === WORKER_SCREENING_PROCEDURE_ID,
  );
  if (!latest)
    return {
      ok: false,
      message: "This set has no worker screening and recruitment procedure.",
    };
  const snapshot = await participantRiskSnapshot(
    admin,
    ctx.account.id,
    todaySydney(),
  );
  const model = insertDivision3Plan(latest.model, snapshot);
  if (JSON.stringify(model) === JSON.stringify(latest.model))
    return { ok: true, id: latest.id };
  const store = new SupabaseGenerationStore(admin);
  const version = latest.version + 1;
  const path = objectPath(
    set.account_id,
    set.id,
    `${latest.document_type_id}.v${version}.docx`,
  );
  const docx = await renderDocx(model);
  await store.putObject(path, new Uint8Array(docx), DOCX_TYPE);
  const row = await store.insertDocumentVersion({
    version_set_id: set.id,
    account_id: set.account_id,
    document_type_id: latest.document_type_id,
    version,
    status: latest.status,
    storage_path: path,
    model,
  });
  await refreshSetSummary(admin, set.id);
  await audit(ctx, "documents.procedure.updated", row.id);
  log.info("registers.procedure.updated", {
    accountId: ctx.account.id,
    versionSetId: set.id,
    version,
    rows: snapshot.rows.length,
  });
  return { ok: true, id: row.id };
}

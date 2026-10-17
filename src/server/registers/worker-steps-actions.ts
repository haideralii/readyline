"use server";
/**
 * REQ-024 Session B (FR-7, FR-8; SR-2; D-2417 as amended, D-2419, D-2828):
 * the worker's three writes, each behind the worker session and the A1
 * functions, which are the only path to an item's dates and to the
 * screening row's numbers; the acknowledgement is a row the worker's own
 * insert policy admits for their code alone (D-2828), and once every
 * document an item names is acknowledged for its adopted version the item
 * takes the worker's date through `worker_update_item`, so the owner's
 * confirmation stays the date an auditor reads. Every refusal is the
 * database's 42501 as one plain message.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  ACKNOWLEDGEMENT_DOCUMENTS,
  acknowledgementsComplete,
} from "@/lib/registers/worker-steps";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";
import { loadWorkerSteps } from "@/server/registers/worker-steps";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type WorkerStepResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

const NOT_ALLOWED: WorkerStepResult = {
  ok: false,
  message: "Not allowed. Sign in again, or ask your manager.",
};
const LIMITED: WorkerStepResult = {
  ok: false,
  message: "Too many changes in a short time; try again in a minute.",
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date");
const optionalIsoDate = z
  .union([z.literal(""), isoDate])
  .transform((v) => (v === "" ? null : v));
const number40 = z
  .string()
  .trim()
  .max(40, "40 characters at most")
  .regex(/^[A-Za-z0-9 /-]*$/, "Letters, digits, spaces, / and - only");

const ClearanceForm = strictObject({
  /** Empty when the owner has not recorded the application yet (D-2834): the function makes the pending row. */
  clearance_id: z.union([z.literal(""), z.string().uuid()]),
  application_number: number40.default(""),
  clearance_number: number40.default(""),
  expires_on: optionalIsoDate.default(""),
});

const ItemForm = strictObject({
  item_id: z.string().uuid(),
  done_on: isoDate,
});

const AcknowledgeForm = strictObject({
  document_type_id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  version: z.number().int().min(1),
});

async function workerContext() {
  const viewer = await getViewer();
  if (!viewer?.worker || viewer.account || viewer.deleted) return null;
  if (!viewer.worker.worker_ref) return null;
  if (!(await checkRegisterWriteAllowed(viewer.user.id))) return "limited";
  return {
    viewer,
    worker: viewer.worker,
    ref: viewer.worker.worker_ref,
    supabase: await createSupabaseServerClient(),
  };
}

function refused(code: string | undefined, action: string): WorkerStepResult {
  log.warn("worker.step.refused", { action, code: code ?? "unknown" });
  return NOT_ALLOWED;
}

/** W-1: the application number, the check number and the expiry on the worker's own screening row. */
export async function workerSaveClearanceAction(
  input: unknown,
): Promise<WorkerStepResult> {
  const parsed = parseInput(ClearanceForm, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.fieldErrors,
    };
  const ctx = await workerContext();
  if (!ctx) return NOT_ALLOWED;
  if (ctx === "limited") return LIMITED;
  const d = parsed.data;
  if (!d.application_number && !d.clearance_number && !d.expires_on)
    return { ok: false, message: "Enter at least one of the three." };
  if (!d.clearance_id && !d.application_number)
    return {
      ok: false,
      message:
        "Enter the application number from the unit's notice first; the check number and the expiry can follow.",
      fieldErrors: { application_number: ["Enter the application number"] },
    };
  const r = d.clearance_id
    ? await ctx.supabase.rpc("worker_update_clearance", {
        p_clearance: d.clearance_id,
        p_application_number: d.application_number || null,
        p_clearance_number: d.clearance_number || null,
        p_expires_on: d.expires_on,
      })
    : // D-2834: no row yet; the function finds or makes the worker's own pending row.
      await ctx.supabase.rpc("worker_record_clearance", {
        p_account: ctx.worker.id,
        p_application_number: d.application_number || null,
        p_clearance_number: d.clearance_number || null,
        p_expires_on: d.expires_on,
      });
  if (r.error) return refused(r.error.code, "clearance");
  log.info("worker.step.clearance", { accountId: ctx.worker.id });
  return { ok: true };
}

/** W-4, W-5 and any other item the worker shares: the worker's date on the item (the owner confirms). */
export async function workerDateItemAction(
  input: unknown,
): Promise<WorkerStepResult> {
  const parsed = parseInput(ItemForm, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.fieldErrors,
    };
  const ctx = await workerContext();
  if (!ctx) return NOT_ALLOWED;
  if (ctx === "limited") return LIMITED;
  const r = await ctx.supabase.rpc("worker_update_item", {
    p_item: parsed.data.item_id,
    p_done_on: parsed.data.done_on,
  });
  if (r.error) return refused(r.error.code, "item");
  log.info("worker.step.item", { accountId: ctx.worker.id });
  return { ok: true };
}

/**
 * W-3 and W-6: one acknowledgement row for a document's adopted version;
 * when every document an item names is acknowledged, the item takes the
 * worker's date through the function.
 */
export async function workerAcknowledgeAction(
  input: unknown,
): Promise<WorkerStepResult> {
  const parsed = parseInput(AcknowledgeForm, input);
  if (!parsed.ok)
    return { ok: false, message: "That document was not recognised." };
  const ctx = await workerContext();
  if (!ctx) return NOT_ALLOWED;
  if (ctx === "limited") return LIMITED;
  const steps = await loadWorkerSteps(ctx.supabase, ctx.worker);
  const adopted = steps.adopted.get(parsed.data.document_type_id);
  if (!adopted || adopted.version !== parsed.data.version)
    return {
      ok: false,
      message:
        "That version is not the one your manager adopted; reload and try again.",
    };
  const ins = await ctx.supabase.from("policy_acknowledgements").insert({
    account_id: ctx.worker.id,
    worker_ref: ctx.ref,
    document_type_id: parsed.data.document_type_id,
    version: parsed.data.version,
  });
  // 23505 is the key: already acknowledged, which is the same outcome.
  if (ins.error && ins.error.code !== "23505")
    return refused(ins.error.code, "acknowledge");
  const acks = [
    ...steps.acknowledgements,
    {
      id: "new",
      document_type_id: parsed.data.document_type_id,
      version: parsed.data.version,
      acknowledged_on: steps.today,
    },
  ];
  for (const itemId of Object.keys(ACKNOWLEDGEMENT_DOCUMENTS) as Array<
    keyof typeof ACKNOWLEDGEMENT_DOCUMENTS
  >) {
    const state = steps.states.find((s) => s.item_id === itemId);
    if (!state || state.done_on) continue;
    if (!acknowledgementsComplete(itemId, steps.adopted, acks)) continue;
    const r = await ctx.supabase.rpc("worker_update_item", {
      p_item: state.id,
      p_done_on: steps.today,
    });
    if (r.error) return refused(r.error.code, "acknowledge-item");
  }
  log.info("worker.step.acknowledged", { accountId: ctx.worker.id });
  return { ok: true };
}

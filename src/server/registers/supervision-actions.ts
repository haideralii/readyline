"use server";
/**
 * REQ-024 Session C (FR-11; D-2829, D-2833): the owner's one write for a
 * worker's supervision history. The form is a strict object; the row is
 * inserted with the owner's session so RLS and the subscription gate apply
 * in the database; the table's trigger sets the staff row's
 * `last_supervision_on`; the trail takes a line of words and a date, never
 * the note's text; nothing here reaches a model. Entries are added, never
 * edited or removed through the screen: a record, as every register row.
 */
import { log } from "@/lib/logging/logger";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import {
  heldOnAfterToday,
  SUPERVISION_FUTURE_MESSAGE,
  SupervisionEntryForm,
  supervisionTrailNote,
} from "@/lib/registers/supervision";
import { parseInput } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { todaySydney } from "./worker-onboarding";

export type SupervisionActionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };

const SIGN_IN: SupervisionActionResult = {
  ok: false,
  message: "Sign in to use the registers.",
};
const LIMITED: SupervisionActionResult = {
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

/** One supervision entry on a worker of the account (FR-11, AC-9). */
export async function addSupervisionEntryAction(
  input: unknown,
): Promise<SupervisionActionResult> {
  const parsed = parseInput(SupervisionEntryForm, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: "Check the form.",
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };
  const v = parsed.data;
  const today = todaySydney();
  if (heldOnAfterToday(v.heldOn, today))
    return {
      ok: false,
      message: "Check the form.",
      fieldErrors: { heldOn: [SUPERVISION_FUTURE_MESSAGE] },
    };
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  // The worker is a row of this account; a code nobody holds is a plain message, never a row.
  const row = await ctx.supabase
    .from("staff_matrix")
    .select("id")
    .eq("account_id", ctx.account.id)
    .eq("worker_ref", v.workerRef)
    .maybeSingle();
  if (!row.data)
    return {
      ok: false,
      message: "That worker is not on your staff list; add their row first.",
    };
  const ins = await ctx.supabase
    .from("supervision_entries")
    .insert({
      account_id: ctx.account.id,
      worker_ref: v.workerRef,
      kind: v.kind,
      held_on: v.heldOn,
      by_ref: v.byRef,
      note: v.note,
      outcome: v.outcome,
    })
    .select("id")
    .single();
  if (ins.error) return { ok: false, message: plainDatabaseMessage(ins.error) };
  const id = ins.data.id as string;
  const trail = await ctx.supabase.from("register_events").insert({
    account_id: ctx.account.id,
    register: "supervision_entries",
    row_id: id,
    kind: "created",
    note: supervisionTrailNote({
      kind: v.kind,
      held_on: v.heldOn,
      by_ref: v.byRef,
    }),
  });
  if (trail.error)
    log.warn("registers.trail.failed", {
      accountId: ctx.account.id,
      table: "supervision_entries",
      code: trail.error.code,
    });
  await ctx.supabase.from("audit_log").insert({
    account_id: ctx.account.id,
    actor_user_id: ctx.viewer.user.id,
    action: "register.supervision_entries.created",
    target: id,
  });
  return { ok: true, id };
}

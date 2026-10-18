"use server";
/**
 * The finding's trail (REQ-033 FR-5, SR-3; D-2935, D-2936): the provider
 * marks a finding addressed with the day and the role, and records the
 * auditor's verification with its date. Both are the provider's own record;
 * neither closes anything with the Commission, and the words say so (FR-7).
 * Each writes the trail and an audit line.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";
import { createSupabaseServerClient } from "@/server/supabase/server";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = z.string().uuid();

const AddressInput = strictObject({
  id: UUID,
  addressedOn: z.string().regex(ISO, "Enter the date it was addressed"),
  role: text(80, 1, "Say who addressed it, by role"),
});
const VerifyInput = strictObject({
  id: UUID,
  verifiedOn: z.string().regex(ISO, "Enter the date the auditor verified it"),
});

export type FindingTrailResult = { ok: true } | { ok: false; message: string };

const SIGN_IN = "Sign in to use the registers.";
const LIMITED = "Too many changes in a minute. Wait a moment and try again.";

async function context() {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return null;
  if (!(await checkRegisterWriteAllowed(viewer.user.id))) return "limited";
  return {
    viewer,
    accountId: viewer.account.id,
    supabase: await createSupabaseServerClient(),
  };
}

async function record(
  ctx: NonNullable<Exclude<Awaited<ReturnType<typeof context>>, "limited">>,
  id: string,
  kind: "addressed" | "verified",
  note: string,
) {
  await ctx.supabase.from("register_events").insert({
    account_id: ctx.accountId,
    register: "findings",
    row_id: id,
    kind: "updated",
    note,
  });
  await ctx.supabase.from("audit_log").insert({
    account_id: ctx.accountId,
    actor_user_id: ctx.viewer.user.id,
    action: `register.findings.${kind}`,
    target: id,
  });
  log.info(`findings.${kind}`, { accountId: ctx.accountId });
}

/** FR-5: "Mark as addressed": the day and the role; the improvement row's closing says the same when it comes first. */
export async function addressFindingAction(
  input: unknown,
): Promise<FindingTrailResult> {
  const parsed = parseInput(AddressInput, input);
  if (!parsed.ok)
    return {
      ok: false,
      message:
        Object.values(parsed.fieldErrors).flat()[0] ?? "Check the fields.",
    };
  const ctx = await context();
  if (!ctx) return { ok: false, message: SIGN_IN };
  if (ctx === "limited") return { ok: false, message: LIMITED };
  const r = await ctx.supabase
    .from("findings")
    .update({
      status: "addressed",
      addressed_on: parsed.data.addressedOn,
      addressed_by_role: parsed.data.role,
    })
    .eq("id", parsed.data.id)
    .eq("account_id", ctx.accountId)
    .eq("status", "open")
    .select("id, improvement_id");
  if (r.error) return { ok: false, message: plainDatabaseMessage(r.error) };
  if (!r.data?.length)
    return { ok: false, message: "This finding is not open, or is not yours." };
  // The improvement row closes with it, when it is still open.
  const improvementId = (r.data[0] as { improvement_id: string | null })
    .improvement_id;
  if (improvementId)
    await ctx.supabase
      .from("improvements")
      .update({ done_on: parsed.data.addressedOn })
      .eq("id", improvementId)
      .eq("account_id", ctx.accountId)
      .is("done_on", null);
  await record(
    ctx,
    parsed.data.id,
    "addressed",
    `Addressed ${parsed.data.addressedOn} by ${parsed.data.role}.`,
  );
  return { ok: true };
}

/** FR-5 (D-2935): "Record the auditor's verification": the provider's own record of what the auditor said, with its date. */
export async function verifyFindingAction(
  input: unknown,
): Promise<FindingTrailResult> {
  const parsed = parseInput(VerifyInput, input);
  if (!parsed.ok)
    return {
      ok: false,
      message:
        Object.values(parsed.fieldErrors).flat()[0] ?? "Check the fields.",
    };
  const ctx = await context();
  if (!ctx) return { ok: false, message: SIGN_IN };
  if (ctx === "limited") return { ok: false, message: LIMITED };
  const r = await ctx.supabase
    .from("findings")
    .update({ status: "verified", verified_on: parsed.data.verifiedOn })
    .eq("id", parsed.data.id)
    .eq("account_id", ctx.accountId)
    .eq("status", "addressed")
    .select("id");
  if (r.error) return { ok: false, message: plainDatabaseMessage(r.error) };
  if (!r.data?.length)
    return {
      ok: false,
      message:
        "Mark the finding as addressed first; the auditor verifies a change you have made.",
    };
  await record(
    ctx,
    parsed.data.id,
    "verified",
    `The auditor's verification recorded for ${parsed.data.verifiedOn}.`,
  );
  return { ok: true };
}

"use server";
/**
 * Finishing a self-check walk (REQ-020 FR-9, SR-4): one `self_checks` row
 * with the answers, one improvement row per "no" (source `self-check`,
 * due in 30 days, with its trail line), and one audit line with the count.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import {
  findingsFrom,
  selfCheckRecordIds,
  type SelfCheckAnswers,
} from "@/lib/registers/self-check";
import { NDIS_NUMBER_SHAPE } from "@/lib/registers/types";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";
import { createSupabaseServerClient } from "@/server/supabase/server";

const Answer = strictObject({
  answer: z.enum(["yes", "no"]),
  note: text(300).refine(
    (s) => !NDIS_NUMBER_SHAPE.test(s),
    "This looks like an NDIS participant number. Use a reference code instead.",
  ),
});

const Input = strictObject({
  walkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  walkedByRef: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^(OWNER|(W|KP)-?[0-9]{1,6})$/,
      "Use your worker code, or leave it as the owner",
    )
    .transform((v) => (v === "OWNER" ? "owner" : v)),
  answers: z.record(z.string(), Answer),
});

export type SelfCheckResult =
  { ok: true; findings: number; id: string } | { ok: false; message: string };

export async function finishSelfCheckAction(
  input: unknown,
): Promise<SelfCheckResult> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok)
    return { ok: false, message: "Answer every question with yes or no." };
  const ids = selfCheckRecordIds();
  const answers = parsed.data.answers as SelfCheckAnswers;
  if (ids.some((id) => !answers[id]))
    return { ok: false, message: "Answer every question with yes or no." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to check your systems." };
  if (!(await checkRegisterWriteAllowed(viewer.user.id)))
    return {
      ok: false,
      message: "Too many changes in a minute. Wait a moment and try again.",
    };
  const supabase = await createSupabaseServerClient();
  const findings = findingsFrom(answers, parsed.data.walkedOn);
  const walk = await supabase
    .from("self_checks")
    .insert({
      account_id: viewer.account.id,
      walked_on: parsed.data.walkedOn,
      walked_by_ref: parsed.data.walkedByRef,
      findings: findings.length,
      answers: Object.fromEntries(ids.map((id) => [id, answers[id]])),
      created_by: viewer.user.id,
    })
    .select("id")
    .single();
  if (walk.error)
    return { ok: false, message: plainDatabaseMessage(walk.error) };
  if (findings.length > 0) {
    const ins = await supabase
      .from("improvements")
      .insert(findings.map((f) => ({ account_id: viewer.account!.id, ...f })))
      .select("id");
    if (ins.error) {
      log.warn("registers.self-check.findings-failed", {
        accountId: viewer.account.id,
        code: ins.error.code,
      });
      return { ok: false, message: plainDatabaseMessage(ins.error) };
    }
    const trail = await supabase.from("register_events").insert(
      ((ins.data as { id: string }[] | null) ?? []).map((r) => ({
        account_id: viewer.account!.id,
        register: "improvements",
        row_id: r.id,
        kind: "created",
        note: `From the self-check of ${parsed.data.walkedOn}`,
      })),
    );
    if (trail.error)
      log.warn("registers.self-check.trail-failed", {
        accountId: viewer.account.id,
        code: trail.error.code,
      });
  }
  await supabase.from("audit_log").insert({
    account_id: viewer.account.id,
    actor_user_id: viewer.user.id,
    action: "self_check.completed",
    target: `${walk.data.id as string} ${findings.length}`,
  });
  return { ok: true, findings: findings.length, id: walk.data.id as string };
}

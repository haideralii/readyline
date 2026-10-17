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
  SELF_CHECK_MODES,
  findingsFrom,
  rehearsalRecordIds,
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

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const Input = strictObject({
  walkedOn: z.string().regex(ISO),
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
  // REQ-023 FR-8 (Session C): a rehearsal reads a period, writes no improvement row and never resets the quarter.
  mode: z.enum(SELF_CHECK_MODES).default("walk"),
  periodFrom: z.string().regex(ISO).optional(),
  periodTo: z.string().regex(ISO).optional(),
  variant: z.enum(["renewal", "mid-term"]).default("renewal"),
});

export type SelfCheckResult =
  { ok: true; findings: number; id: string } | { ok: false; message: string };

export async function finishSelfCheckAction(
  input: unknown,
): Promise<SelfCheckResult> {
  // #105 run 4: every refusal names its gate in the server log (the gate word and the mode only,
  // never an answer or a note), so a refused save in CI says which gate without the browser.
  const refused = (
    reason: string,
    message: string,
    mode?: string,
  ): SelfCheckResult => {
    log.warn("registers.self-check.refused", { reason, mode });
    return { ok: false, message };
  };
  const sentMode =
    typeof input === "object" && input !== null && "mode" in input
      ? String((input as { mode?: unknown }).mode)
      : undefined;
  const parsed = parseInput(Input, input);
  if (!parsed.ok)
    return refused("input", "Answer every question with yes or no.", sentMode);
  const rehearsal = parsed.data.mode === "rehearsal";
  const ids = rehearsal
    ? rehearsalRecordIds(parsed.data.variant)
    : selfCheckRecordIds();
  const answers = parsed.data.answers as SelfCheckAnswers;
  if (ids.some((id) => !answers[id]))
    return refused(
      "answers",
      "Answer every question with yes or no.",
      parsed.data.mode,
    );
  if (
    rehearsal &&
    (!parsed.data.periodFrom ||
      !parsed.data.periodTo ||
      parsed.data.periodFrom > parsed.data.periodTo)
  )
    return refused(
      "period",
      "A rehearsal needs the period it reads.",
      parsed.data.mode,
    );
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return refused(
      "viewer",
      "Sign in to check your systems.",
      parsed.data.mode,
    );
  if (!(await checkRegisterWriteAllowed(viewer.user.id)))
    return refused(
      "rate-limit",
      "Too many changes in a minute. Wait a moment and try again.",
      parsed.data.mode,
    );
  const supabase = await createSupabaseServerClient();
  const stored = Object.fromEntries(ids.map((id) => [id, answers[id]]));
  // #105 run 3: the rehearsal's save was seen busy past five seconds in CI with no error line; the
  // save's own timing is logged (no answer, no note) so a slow or stalled save names itself.
  const startedAt = Date.now();
  if (rehearsal) {
    // FR-8, D-2309: one dated sheet of what is missing; nothing in the improvement register, nothing on the trail.
    const missing = ids.filter((id) => answers[id].answer === "no").length;
    const row = await supabase
      .from("self_checks")
      .insert({
        account_id: viewer.account.id,
        walked_on: parsed.data.walkedOn,
        walked_by_ref: parsed.data.walkedByRef,
        findings: missing,
        answers: stored,
        created_by: viewer.user.id,
        mode: "rehearsal",
        period_from: parsed.data.periodFrom,
        period_to: parsed.data.periodTo,
      })
      .select("id")
      .single();
    if (row.error) {
      log.warn("registers.self-check.refused", {
        reason: "database",
        mode: "rehearsal",
        code: row.error.code,
        accountId: viewer.account.id,
      });
      return { ok: false, message: plainDatabaseMessage(row.error) };
    }
    await supabase.from("audit_log").insert({
      account_id: viewer.account.id,
      actor_user_id: viewer.user.id,
      action: "self_check.rehearsed",
      target: `${row.data.id as string} ${missing}`,
    });
    log.info("registers.self-check.saved", {
      accountId: viewer.account.id,
      mode: "rehearsal",
      ms: Date.now() - startedAt,
    });
    return { ok: true, findings: missing, id: row.data.id as string };
  }
  const findings = findingsFrom(answers, parsed.data.walkedOn);
  const walk = await supabase
    .from("self_checks")
    .insert({
      account_id: viewer.account.id,
      walked_on: parsed.data.walkedOn,
      walked_by_ref: parsed.data.walkedByRef,
      findings: findings.length,
      answers: stored,
      created_by: viewer.user.id,
    })
    .select("id")
    .single();
  if (walk.error) {
    log.warn("registers.self-check.refused", {
      reason: "database",
      mode: "walk",
      code: walk.error.code,
      accountId: viewer.account.id,
    });
    return { ok: false, message: plainDatabaseMessage(walk.error) };
  }
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
  log.info("registers.self-check.saved", {
    accountId: viewer.account.id,
    mode: "walk",
    ms: Date.now() - startedAt,
  });
  return { ok: true, findings: findings.length, id: walk.data.id as string };
}

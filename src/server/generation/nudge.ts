"use server";
/**
 * The documents page's own recovery (batch 23 item 4, D-1005): when a
 * signed-in owner's job has shown no progress for a while, the page calls
 * this action and the job is run from here, behind the same claim lock the
 * job route uses, so a customer never waits for the daily cron. Only the
 * owner of a stalled job can trigger it; it answers at once and the work
 * carries on after the response.
 */
import { isJobStalled } from "@/lib/payments/documents-state";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { listGenerationJobs } from "@/server/payments/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { continueGeneration, keepAlive } from "./kick";

/** Fits a 60-second function with room for the hand-on. */
const NUDGE_BUDGET_MS = 35_000;

export type NudgeResult = { ok: true; nudged: boolean };

// The action takes no fields; anything sent is rejected like every boundary (REQ-002 FR-3).
const Input = strictObject({});

export async function nudgeGenerationAction(
  input?: unknown,
): Promise<NudgeResult> {
  if (!parseInput(Input, input ?? {}).ok) return { ok: true, nudged: false };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return { ok: true, nudged: false };
  const supabase = await createSupabaseServerClient();
  const jobs = await listGenerationJobs(supabase, viewer.account.id);
  const stalled = jobs.find((j) => isJobStalled(j, new Date()));
  if (!stalled) return { ok: true, nudged: false };
  log.info("payments.generation.nudged", {
    accountId: viewer.account.id,
    documentsDone: stalled.nextDocumentIndex,
  });
  keepAlive(() => continueGeneration(NUDGE_BUDGET_MS, "page"));
  return { ok: true, nudged: true };
}

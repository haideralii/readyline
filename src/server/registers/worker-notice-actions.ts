"use server";
/**
 * REQ-024 Session A3 (SR-1; AC-11; D-2414): the worker's collection notice
 * is one screen with one button on the first sign-in. The button records
 * the day through `worker_notice_seen()`, which writes the worker's own
 * membership and nothing else (A1's migration), then the home renders.
 */
import { redirect } from "next/navigation";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

const NoInput = strictObject({});

export async function workerNoticeSeenAction(input: unknown): Promise<void> {
  const parsed = parseInput(NoInput, input ?? {});
  if (!parsed.ok) return;
  const viewer = await getViewer();
  if (!viewer?.worker || viewer.account) return;
  const supabase = await createSupabaseServerClient();
  const r = await supabase.rpc("worker_notice_seen");
  if (r.error) {
    log.warn("worker.notice.failed", {
      userId: viewer.user.id,
      code: r.error.code,
    });
    return;
  }
  log.info("worker.notice.seen", { accountId: viewer.worker.id });
  redirect("/worker");
}

import "server-only";
/**
 * One audit_log row per scheduled-job run (REQ-022 FR-1, D-2208), so "the
 * job ran within its schedule" is a database read on the launch page rather
 * than a search through logs. No actor, no account; the target carries the
 * run's counts as `name=value` pairs, never content.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";

/** REQ-030 FR-3 and FR-2 (D-2867, D-2866): the uptime check and the backup record their runs the same way. */
export type JobName = "purge" | "generate" | "reminders" | "uptime" | "backup";

export function jobRunAction(job: JobName): string {
  return `jobs.${job}.ran`;
}

export async function recordJobRun(
  admin: SupabaseClient,
  job: JobName,
  summary: Record<string, number | boolean | string>,
): Promise<void> {
  const target = Object.entries(summary)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ")
    .slice(0, 200);
  const r = await admin.from("audit_log").insert({
    account_id: null,
    actor_user_id: null,
    action: jobRunAction(job),
    target,
  });
  if (r.error) log.warn("jobs.record-run.failed", { job, code: r.error.code });
}

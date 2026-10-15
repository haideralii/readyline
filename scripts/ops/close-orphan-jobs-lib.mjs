/**
 * The pure part of `close-orphan-jobs.mjs` (batch 45, PO decision): which
 * generation jobs count as orphaned, and the rows that close them.
 *
 * An orphaned job is one still `queued` or `running` whose lease
 * (`next_run_at`) passed more than `staleHours` ago: nothing claimed it again
 * because no kicker existed when it was made (before D-057 and D-059), so it
 * can never finish by itself. A job whose lease is still in the future, or
 * passed only minutes ago, may be mid-tick and is left alone.
 */

/** @param {{ id: string, status: string, next_run_at: string | null, created_at: string }[]} jobs */
export function selectOrphans(jobs, now, staleHours = 24) {
  const cutoff = now.getTime() - staleHours * 3_600_000;
  return jobs.filter((j) => {
    if (j.status !== "queued" && j.status !== "running") return false;
    const lease = j.next_run_at
      ? Date.parse(j.next_run_at)
      : Date.parse(j.created_at);
    return Number.isFinite(lease) && lease < cutoff;
  });
}

export const ORPHAN_REASON = "orphaned before D-057";
export const AUDIT_ACTION = "generation.job.orphaned";

/** The update applied to one orphaned job and the audit row written beside it. */
export function closingRows(job, now) {
  return {
    update: {
      status: "failed",
      last_error: ORPHAN_REASON,
      next_run_at: now.toISOString(),
    },
    audit: {
      account_id: job.account_id,
      actor_user_id: null,
      action: AUDIT_ACTION,
      target: job.id,
    },
  };
}

/** One line per job for the status, with no free text from the row. */
export function describe(job) {
  return `${job.id} ${job.status} attempts=${job.attempts ?? 0} created=${(job.created_at ?? "").slice(0, 19)} lease=${(job.next_run_at ?? "").slice(0, 19)} account=${job.account_id}`;
}

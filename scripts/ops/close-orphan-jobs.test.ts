// @vitest-environment node
/**
 * The orphan rule and the closing rows (batch 45, PO decision): only a
 * queued or running job whose lease passed more than the stale window ago
 * is closed; a live lease, a recent lease, a ready job and a failed job are
 * left alone; the closing update carries the agreed reason and the audit
 * row names the job and its account.
 */
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION,
  ORPHAN_REASON,
  closingRows,
  describe as describeJob,
  selectOrphans,
} from "./close-orphan-jobs-lib.mjs";

const now = new Date("2026-10-15T12:00:00Z");
const hoursAgo = (h: number) =>
  new Date(now.getTime() - h * 3_600_000).toISOString();

const job = (over: Record<string, unknown>) => ({
  id: "job-1",
  account_id: "acc-1",
  status: "queued",
  attempts: 0,
  created_at: hoursAgo(72),
  next_run_at: hoursAgo(72),
  ...over,
});

describe("selectOrphans", () => {
  it("takes a queued or running job whose lease passed more than 24 hours ago", () => {
    const jobs = [
      job({ id: "old-queued" }),
      job({ id: "old-running", status: "running", next_run_at: hoursAgo(30) }),
      job({ id: "recent", next_run_at: hoursAgo(2) }),
      job({
        id: "live",
        next_run_at: new Date(now.getTime() + 60_000).toISOString(),
      }),
      job({ id: "ready", status: "ready" }),
      job({ id: "failed", status: "failed" }),
      job({ id: "no-lease", next_run_at: null, created_at: hoursAgo(48) }),
    ];
    expect(selectOrphans(jobs, now).map((j) => j.id)).toEqual([
      "old-queued",
      "old-running",
      "no-lease",
    ]);
  });

  it("the stale window is adjustable", () => {
    expect(
      selectOrphans([job({ next_run_at: hoursAgo(2) })], now, 1).length,
    ).toBe(1);
    expect(
      selectOrphans([job({ next_run_at: hoursAgo(2) })], now, 3).length,
    ).toBe(0);
  });
});

describe("closingRows and describe", () => {
  it("marks the job failed with the agreed reason and writes an audit row for the account", () => {
    const rows = closingRows(job({}), now);
    expect(rows.update).toEqual({
      status: "failed",
      last_error: ORPHAN_REASON,
      next_run_at: now.toISOString(),
    });
    expect(rows.audit).toEqual({
      account_id: "acc-1",
      actor_user_id: null,
      action: AUDIT_ACTION,
      target: "job-1",
    });
    expect(ORPHAN_REASON).toBe("orphaned before D-057");
  });

  it("describes a job without free text", () => {
    const line = describeJob(job({ attempts: 3 }));
    expect(line).toMatch(
      /^job-1 queued attempts=3 created=2026-10-12T12:00:00 lease=2026-10-12T12:00:00 account=acc-1$/,
    );
  });
});

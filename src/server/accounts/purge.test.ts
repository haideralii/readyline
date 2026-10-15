/**
 * Retro review of REQ-004 (15 Oct 2026, finding 34): `audit_log` rows older
 * than two years go with the purge, except the `jobs.*` rows the launch page
 * reads. A fake admin client records the query; the real-stack case is
 * `tests/integration/session-c.test.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_LOG_RETENTION_DAYS,
  JOB_RUN_ACTION_PREFIX,
  purgeOldAuditLog,
} from "./purge";

vi.mock("server-only", () => ({}));

type Call = [string, ...unknown[]];

function fakeAdmin(rows: { id: number }[], calls: Call[]) {
  const builder = {
    select(cols: string) {
      calls.push(["select", cols]);
      return builder;
    },
    delete() {
      calls.push(["delete"]);
      return builder;
    },
    lt(col: string, value: unknown) {
      calls.push(["lt", col, value]);
      return builder;
    },
    not(col: string, op: string, value: unknown) {
      calls.push(["not", col, op, value]);
      return builder;
    },
    then(resolve: (v: { data: { id: number }[]; error: null }) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return {
    from(table: string) {
      calls.push(["from", table]);
      return builder;
    },
  } as unknown as SupabaseClient;
}

const now = new Date("2026-10-15T00:00:00Z");
const cutoff = new Date(
  now.getTime() - AUDIT_LOG_RETENTION_DAYS * 86_400_000,
).toISOString();

describe("purgeOldAuditLog (finding 34)", () => {
  it("keeps the audit log two years and never touches the job-run rows the launch page reads", async () => {
    const { jobRunAction } = await import("@/server/jobs/record-run");
    expect(AUDIT_LOG_RETENTION_DAYS).toBe(730);
    for (const job of ["purge", "generate", "reminders"] as const)
      expect(jobRunAction(job).startsWith(JOB_RUN_ACTION_PREFIX)).toBe(true);
  });

  it("a dry run counts the old rows and does not delete", async () => {
    const calls: Call[] = [];
    const n = await purgeOldAuditLog({
      admin: fakeAdmin([{ id: 1 }, { id: 2 }], calls),
      now,
      dryRun: true,
    });
    expect(n).toBe(2);
    expect(calls).toEqual([
      ["from", "audit_log"],
      ["select", "id"],
      ["lt", "at", cutoff],
      ["not", "action", "like", "jobs.%"],
    ]);
  });

  it("a real run deletes with the same bounds and reports the count", async () => {
    const calls: Call[] = [];
    const n = await purgeOldAuditLog({
      admin: fakeAdmin([{ id: 1 }], calls),
      now,
    });
    expect(n).toBe(1);
    expect(calls).toEqual([
      ["from", "audit_log"],
      ["delete"],
      ["lt", "at", cutoff],
      ["not", "action", "like", "jobs.%"],
      ["select", "id"],
    ]);
  });
});

// @vitest-environment node
/**
 * REQ-024 Session C (FR-12; AC-10; D-2284) on the Supabase stack: ending a
 * worker through the save's after-step revokes their membership the way the
 * team page does, writes the `ended` event once, keeps every row, and the
 * export snapshot lists the worker under past workers with the end date on
 * the screening list. Needs the Supabase variables (CI's Supabase job);
 * never against the hosted project.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";
import type { StaffMatrixRow } from "@/lib/registers/audit-day-types";
import {
  screeningListRows,
  workersIndexRows,
} from "@/lib/registers/worker-exports";

vi.mock("server-only", () => ({}));

const enabled = hasSupabaseEnv();
const REF = "W-41";
const ENDED_ON = "2026-10-10";

type Person = { userId: string; client: SupabaseClient; accountId: string };

async function signUp(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
  withAccount: boolean,
): Promise<Person> {
  const email = `ending-c-${label}-${randomUUID()}@example.test`;
  const password = `Pw-${randomUUID()}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw created.error ?? new Error("createUser failed");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  let accountId = "";
  if (withAccount) {
    const rpc = await client.rpc("create_account", {
      p_trading_name: `Ending ${label}`,
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
  }
  return { userId: created.data.user.id, client, accountId };
}

describe.skipIf(!enabled)("REQ-024 C: ending a worker (AC-10)", () => {
  let admin: SupabaseClient;
  let owner: Person;
  let worker: Person;
  let rowId: string;

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    owner = await signUp(admin, env.url, env.publishableKey, "owner", true);
    const ent = await admin
      .from("entitlements")
      .insert({ account_id: owner.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    worker = await signUp(admin, env.url, env.publishableKey, "worker", false);
    const m = await admin.from("memberships").insert({
      user_id: worker.userId,
      account_id: owner.accountId,
      role: "worker",
      worker_ref: REF,
    });
    if (m.error) throw m.error;
    const row = await owner.client
      .from("staff_matrix")
      .insert({
        account_id: owner.accountId,
        worker_ref: REF,
        role_label: "support worker",
        role: "support-worker",
        states: ["NSW"],
        risk_assessed: true,
        risk_paragraph: "a",
        started_on: "2025-02-01",
        risk_assessed_from: "2025-02-01",
      })
      .select("id")
      .single();
    if (row.error) throw row.error;
    rowId = row.data.id as string;
  });

  afterAll(async () => {
    for (const p of [owner, worker])
      if (p?.userId)
        await admin.auth.admin.deleteUser(p.userId).catch(() => undefined);
  });

  it("the save that sets ended_on writes the ended event once and revokes the membership; the rows stay; the exports list the worker under past workers", async () => {
    const { afterStaffMatrixSave } =
      await import("@/server/registers/worker-onboarding");
    const before = (
      await owner.client
        .from("staff_matrix")
        .select("risk_assessed, role, risk_assessed_from, role_ref, ended_on")
        .eq("id", rowId)
        .single()
    ).data as Pick<
      StaffMatrixRow,
      "risk_assessed" | "role" | "risk_assessed_from" | "role_ref" | "ended_on"
    >;
    const upd = await owner.client
      .from("staff_matrix")
      .update({ ended_on: ENDED_ON })
      .eq("id", rowId)
      .select("id");
    expect(upd.error).toBeNull();
    const first = await afterStaffMatrixSave(owner.client, {
      accountId: owner.accountId,
      userId: owner.userId,
      rowId,
      before,
      isMe: false,
      effectiveOn: ENDED_ON,
      moduleIds: [],
      today: "2026-10-18",
    });
    expect(first.ok).toBe(true);

    const membership = await admin
      .from("memberships")
      .select("user_id")
      .eq("account_id", owner.accountId)
      .eq("user_id", worker.userId);
    expect(membership.data ?? []).toEqual([]);
    const audit = await admin
      .from("audit_log")
      .select("action, target")
      .eq("account_id", owner.accountId)
      .eq("action", "worker.removed");
    expect(audit.data?.map((a) => a.target)).toEqual([worker.userId]);

    // A second save of the ended row writes no second event and touches nothing.
    const again = await afterStaffMatrixSave(owner.client, {
      accountId: owner.accountId,
      userId: owner.userId,
      rowId,
      before: { ...before, ended_on: ENDED_ON },
      isMe: false,
      effectiveOn: "2026-10-18",
      moduleIds: [],
      today: "2026-10-18",
    });
    expect(again.ok).toBe(true);
    const events = await admin
      .from("register_events")
      .select("kind, note")
      .eq("account_id", owner.accountId)
      .eq("register", "staff_matrix")
      .eq("row_id", rowId)
      .eq("kind", "ended");
    expect(events.data).toEqual([
      { kind: "ended", note: `ended on ${ENDED_ON}` },
    ]);

    // The worker's rows stay; the worker's own session reads nothing of the account now.
    const row = await admin
      .from("staff_matrix")
      .select("worker_ref, ended_on")
      .eq("id", rowId)
      .single();
    expect(row.data).toEqual({ worker_ref: REF, ended_on: ENDED_ON });
    const theirs = await worker.client
      .from("staff_matrix_worker")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(theirs.data ?? []).toEqual([]);

    // The export snapshot: past workers in the index, the end date on the s 18 list as at today.
    const { loadWorkerExportSnapshot } =
      await import("@/server/registers/worker-exports");
    const snapshot = await loadWorkerExportSnapshot(
      owner.client,
      owner.accountId,
      { today: "2026-10-18" },
    );
    const index = workersIndexRows(snapshot).find((r) => r.worker_ref === REF);
    expect(index).toMatchObject({ section: "past", ended_on: ENDED_ON });
    const listed = screeningListRows({ ...snapshot, asAt: "2026-10-18" }).find(
      (r) => r.worker_ref === REF,
    );
    expect(listed).toMatchObject({ ended_on: ENDED_ON });
    const beforeEnd = screeningListRows({
      ...snapshot,
      asAt: "2026-06-01",
    }).find((r) => r.worker_ref === REF);
    expect(beforeEnd).toBeTruthy();
  });
});

describe.skipIf(enabled)("REQ-024 C: ending a worker (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

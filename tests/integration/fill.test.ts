/**
 * REQ-024 SR-7 (AC-12) against a real Supabase stack: after a filled
 * download nothing in any table and no `audit_log` row holds the marked
 * value; the audit line is the count-only action. Skips without the
 * Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WORKER_EXPORT_TABLES } from "@/server/accounts/export";
import { performFill } from "@/server/registers/fill";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();
const MARK = `Zq Marked ${randomUUID().slice(0, 8)} Xy`;

describe.skipIf(!enabled)("the one-time fill keeps nothing (SR-7)", () => {
  let admin: SupabaseClient;
  let client: SupabaseClient;
  let userId = "";
  let accountId = "";

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `fill-${randomUUID()}@example.test`;
    const password = `Pw-${randomUUID()}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("createUser failed");
    userId = created.data.user.id;
    client = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    const rpc = await client.rpc("create_account", {
      p_trading_name: "Fill Tenant",
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
    const seeded = await admin.from("staff_matrix").insert({
      account_id: accountId,
      worker_ref: "W-11",
      role_label: "Support worker",
      role: "support-worker",
      states: ["NSW"],
      risk_assessed: true,
      started_on: "2026-01-05",
      risk_assessed_from: "2026-01-05",
    });
    if (seeded.error) throw seeded.error;
  });

  afterAll(async () => {
    if (userId)
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  });

  it("a filled screening list carries the value; no table and no audit row does afterwards", async () => {
    const { file } = await performFill({
      supabase: client,
      accountId,
      userId,
      submission: {
        kind: "screening-list",
        fill: true,
        asAt: null,
        values: {
          workers: {
            "W-11": {
              full_name: MARK,
              date_of_birth: "1990-01-02",
              address: "1 Example Street",
            },
          },
          supervisors: {},
        },
      },
    });
    const text = Buffer.from(file.body).toString("utf8");
    expect(text).toContain(MARK);
    expect(text).toContain("W-11");

    const audit = await admin
      .from("audit_log")
      .select("action, target")
      .eq("account_id", accountId);
    expect(audit.error).toBeNull();
    const actions = (audit.data ?? []).map((r) => r.action);
    expect(actions).toContain("exports.screening-list.filled");
    expect(JSON.stringify(audit.data)).not.toContain(MARK);

    for (const table of WORKER_EXPORT_TABLES) {
      const rows = await admin
        .from(table)
        .select("*")
        .eq("account_id", accountId);
      expect(rows.error, table).toBeNull();
      expect(JSON.stringify(rows.data), table).not.toContain(MARK);
    }
    const facts = await admin
      .from("account_facts")
      .select("*")
      .eq("account_id", accountId);
    expect(JSON.stringify(facts.data)).not.toContain(MARK);
  });
});

describe.skipIf(enabled)("the one-time fill (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

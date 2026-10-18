/**
 * REQ-031 Session B against a real Supabase stack (FR-5, SR-6, AC-10): the
 * owner's session writes `what_changed_read_at` on the period row, a member's
 * session reads it and cannot write it, and the newest register change is
 * read from the rows' own timestamps. Skips without the variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { latestRegisterChangeAt } from "@/server/registers/what-changed-queries";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

vi.mock("server-only", () => ({}));

const enabled = hasSupabaseEnv();

type Session = { userId: string; client: SupabaseClient };

async function signUp(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Session> {
  const email = `req-031-b-${label}-${randomUUID()}@example.test`;
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
  return { userId: created.data.user.id, client };
}

describe.skipIf(!enabled)(
  "the what-changed reading mark (REQ-031 FR-5)",
  () => {
    let admin: SupabaseClient;
    let owner: Session;
    let member: Session;
    let accountId = "";
    let periodId = "";

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      owner = await signUp(admin, env.url, env.publishableKey, "owner");
      const rpc = await owner.client.rpc("create_account", {
        p_trading_name: "Reading Mark Supports",
        p_business_structure: "sole-trader",
        p_states: ["NSW"],
        p_abn: null,
      });
      if (rpc.error) throw rpc.error;
      accountId = rpc.data as string;
      member = await signUp(admin, env.url, env.publishableKey, "member");
      const m = await admin
        .from("memberships")
        .insert({
          user_id: member.userId,
          account_id: accountId,
          role: "member",
        });
      if (m.error) throw m.error;
      const ent = await admin
        .from("entitlements")
        .insert({ account_id: accountId, kind: "subscription" });
      if (ent.error) throw ent.error;
      const period = await admin
        .from("registration_periods")
        .insert({
          account_id: accountId,
          period_starts_on: "2026-03-01",
          period_ends_on: "2029-03-01",
          audit_type: "certification",
          midterm_applies: true,
          last_audit_on: "2026-03-01",
        })
        .select("id")
        .single();
      if (period.error) throw period.error;
      periodId = period.data.id as string;
    });

    afterAll(async () => {
      if (!admin) return;
      if (accountId) await admin.from("accounts").delete().eq("id", accountId);
      for (const s of [owner, member])
        if (s) await admin.auth.admin.deleteUser(s.userId);
    });

    it("is null on a new period, the owner's session sets it, and a member reads the same value", async () => {
      const before = await owner.client
        .from("registration_periods")
        .select("what_changed_read_at")
        .eq("id", periodId)
        .single();
      expect(before.error).toBeNull();
      expect(before.data?.what_changed_read_at).toBeNull();
      const readAt = new Date().toISOString();
      const up = await owner.client
        .from("registration_periods")
        .update({ what_changed_read_at: readAt })
        .eq("id", periodId)
        .select("id");
      expect(up.error).toBeNull();
      expect(up.data).toHaveLength(1);
      const asMember = await member.client
        .from("registration_periods")
        .select("what_changed_read_at")
        .eq("id", periodId)
        .single();
      expect(asMember.error).toBeNull();
      expect(Date.parse(asMember.data!.what_changed_read_at as string)).toBe(
        Date.parse(readAt),
      );
    });

    it("a member's session updates no row and the column is unchanged (SR-6)", async () => {
      const was = await admin
        .from("registration_periods")
        .select("what_changed_read_at")
        .eq("id", periodId)
        .single();
      const up = await member.client
        .from("registration_periods")
        .update({ what_changed_read_at: "2030-01-01T00:00:00Z" })
        .eq("id", periodId)
        .select("id");
      expect(up.error).toBeNull();
      expect(up.data).toEqual([]);
      const now = await admin
        .from("registration_periods")
        .select("what_changed_read_at")
        .eq("id", periodId)
        .single();
      expect(now.data?.what_changed_read_at).toBe(
        was.data?.what_changed_read_at,
      );
    });

    it("the newest register change is the newest row's own timestamp, null with no row", async () => {
      expect(await latestRegisterChangeAt(owner.client, accountId)).toBeNull();
      const ins = await owner.client
        .from("incidents")
        .insert({
          account_id: accountId,
          occurred_on: "2026-03-02",
          reported_on: "2026-03-02",
          category: "near-miss",
          severity: "low",
          participant_ref: "P-001",
          summary: "A slip on the back step.",
          actions_taken: "",
          reportable: false,
          status: "open",
        })
        .select("updated_at")
        .single();
      expect(ins.error).toBeNull();
      // Dated for a day before any reading; the row itself is newer than the reading, so the step is "to read".
      expect(await latestRegisterChangeAt(owner.client, accountId)).toBe(
        ins.data!.updated_at,
      );
    });
  },
);

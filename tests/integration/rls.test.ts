/**
 * REQ-004 SR-1 / AC-2: one provider must never see another's data.
 *
 * Two users are created with the admin client, each creates an account through
 * `create_account()`, writes a questionnaire draft, and then tries to read,
 * update and delete the other's rows through the normal (publishable key)
 * client. Every cross-tenant attempt must return nothing and write nothing.
 *
 * Runs against the Supabase CLI local stack in CI. Skips itself when the
 * three Supabase variables are absent so `npm test` stays offline.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Tenant = {
  email: string;
  password: string;
  userId: string;
  client: SupabaseClient;
  accountId: string;
};

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Tenant> {
  const email = `rls-${label}-${randomUUID()}@example.test`;
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
  const rpc = await client.rpc("create_account", {
    p_trading_name: `Tenant ${label}`,
    p_business_structure: "sole-trader",
    p_states: ["NSW"],
    p_abn: null,
  });
  if (rpc.error) throw rpc.error;
  const accountId = rpc.data as string;
  const draft = await client.from("questionnaire_drafts").insert({
    account_id: accountId,
    answers: { owner: label },
    answers_version: 1,
    current_step: "business",
  });
  if (draft.error) throw draft.error;
  return { email, password, userId: created.data.user.id, client, accountId };
}

describe.skipIf(!enabled)(
  "row-level security: cross-tenant isolation (AC-2)",
  () => {
    let admin: SupabaseClient;
    let a: Tenant;
    let b: Tenant;

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      a = await signUpTenant(admin, env.url, env.publishableKey, "a");
      b = await signUpTenant(admin, env.url, env.publishableKey, "b");
    });

    afterAll(async () => {
      for (const t of [a, b]) {
        if (t?.userId) await admin.auth.admin.deleteUser(t.userId);
      }
    });

    it("each tenant sees only its own account, membership and draft", async () => {
      const accounts = await a.client.from("accounts").select("id");
      expect(accounts.error).toBeNull();
      expect(accounts.data?.map((r) => r.id)).toEqual([a.accountId]);

      const memberships = await a.client
        .from("memberships")
        .select("account_id, role");
      expect(memberships.data).toEqual([
        { account_id: a.accountId, role: "owner" },
      ]);

      const drafts = await b.client
        .from("questionnaire_drafts")
        .select("account_id");
      expect(drafts.data?.map((r) => r.account_id)).toEqual([b.accountId]);
    });

    it("reading another tenant's rows by id returns nothing", async () => {
      const account = await b.client
        .from("accounts")
        .select("*")
        .eq("id", a.accountId);
      expect(account.error).toBeNull();
      expect(account.data).toEqual([]);

      const draft = await b.client
        .from("questionnaire_drafts")
        .select("*")
        .eq("account_id", a.accountId);
      expect(draft.data).toEqual([]);

      const audit = await b.client
        .from("audit_log")
        .select("*")
        .eq("account_id", a.accountId);
      expect(audit.data).toEqual([]);
    });

    it("updating or deleting another tenant's rows writes nothing", async () => {
      const update = await b.client
        .from("questionnaire_drafts")
        .update({ answers: { tampered: true } })
        .eq("account_id", a.accountId)
        .select();
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);

      const rename = await b.client
        .from("accounts")
        .update({ trading_name: "Hijacked" })
        .eq("id", a.accountId)
        .select();
      expect(rename.data).toEqual([]);

      const del = await b.client
        .from("questionnaire_drafts")
        .delete()
        .eq("account_id", a.accountId)
        .select();
      expect(del.data).toEqual([]);

      const still = await a.client
        .from("questionnaire_drafts")
        .select("answers")
        .eq("account_id", a.accountId)
        .single();
      expect(still.data?.answers).toEqual({ owner: "a" });
      const name = await a.client
        .from("accounts")
        .select("trading_name")
        .eq("id", a.accountId)
        .single();
      expect(name.data?.trading_name).toBe("Tenant a");
    });

    it("clients cannot create memberships or accounts directly", async () => {
      const membership = await b.client
        .from("memberships")
        .insert({ user_id: b.userId, account_id: a.accountId, role: "member" });
      expect(membership.error).not.toBeNull();

      const account = await b.client
        .from("accounts")
        .insert({ trading_name: "Direct", business_structure: "company" })
        .select();
      expect(account.error).not.toBeNull();
    });

    it("clients cannot grant themselves platform_admin", async () => {
      const attempt = await a.client
        .from("users")
        .update({ platform_admin: true })
        .eq("id", a.userId)
        .select();
      expect(attempt.error).not.toBeNull();
      const check = await admin
        .from("users")
        .select("platform_admin")
        .eq("id", a.userId)
        .single();
      expect(check.data?.platform_admin).toBe(false);
    });

    it("the limiter table is not reachable with the publishable key", async () => {
      const attempt = await a.client.from("auth_rate_limits").select("*");
      expect(attempt.error).not.toBeNull();
    });

    it("a soft-deleted account disappears from its own members", async () => {
      const soft = await admin
        .from("accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", b.accountId);
      expect(soft.error).toBeNull();
      const after = await b.client.from("accounts").select("id");
      expect(after.data).toEqual([]);
      const draft = await b.client
        .from("questionnaire_drafts")
        .select("account_id");
      expect(draft.data).toEqual([]);
    });
  },
);

describe.skipIf(enabled)("row-level security (skipped)", () => {
  it("needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY", () => {
    expect(enabled).toBe(false);
  });
});

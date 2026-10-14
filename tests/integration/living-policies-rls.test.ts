/**
 * Backlog 8 (D-551) against a real Supabase stack: the owner records a
 * check against a rule change on one document; a second record for the
 * same change is a duplicate (23505); the row cannot be updated (42501);
 * another account reads nothing and cannot forge one; the anonymous key
 * sees nothing. Skips without the variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Tenant = { userId: string; client: SupabaseClient; accountId: string };

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Tenant> {
  const email = `living-${label}-${randomUUID()}@example.test`;
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
    p_trading_name: `Living ${label}`,
    p_business_structure: "sole-trader",
    p_states: ["NSW"],
    p_abn: null,
  });
  if (rpc.error) throw rpc.error;
  return {
    userId: created.data.user.id,
    client,
    accountId: rpc.data as string,
  };
}

describe.skipIf(!enabled)("document change reviews (backlog 8, D-551)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    a = await signUpTenant(admin, env.url, env.publishableKey, "a");
    b = await signUpTenant(admin, env.url, env.publishableKey, "b");
  });

  afterAll(async () => {
    for (const t of [a, b])
      if (t?.userId)
        await admin.auth.admin.deleteUser(t.userId).catch(() => undefined);
  });

  it("the owner records a check once; it is append-only and tenant-scoped", async () => {
    const row = {
      account_id: a.accountId,
      document_type_id: "governance-policy",
      change_id: "wc-2026-10-14-01",
      note: "Read it; the s 13A line is there.",
    };
    const ins = await a.client
      .from("document_change_reviews")
      .insert(row)
      .select("id, created_by, reviewed_on")
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data?.created_by).toBe(a.userId);
    expect(ins.data?.reviewed_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dup = await a.client.from("document_change_reviews").insert(row);
    expect(dup.error?.code).toBe("23505");
    const edit = await a.client
      .from("document_change_reviews")
      .update({ note: "changed" })
      .eq("id", ins.data!.id)
      .select("id");
    expect(edit.error?.code).toBe("42501");
    const theirs = await b.client
      .from("document_change_reviews")
      .select("id")
      .eq("account_id", a.accountId);
    expect(theirs.data ?? []).toEqual([]);
    const forged = await b.client
      .from("document_change_reviews")
      .insert({ ...row, change_id: "wc-2026-10-14-02" });
    expect(forged.error).not.toBeNull();
    const none = await anon.from("document_change_reviews").select("id");
    expect(none.data ?? []).toEqual([]);
    const badId = await a.client
      .from("document_change_reviews")
      .insert({ ...row, change_id: "not-a-change" });
    expect(badId.error).not.toBeNull();
    const mine = await a.client
      .from("document_change_reviews")
      .delete()
      .eq("id", ins.data!.id)
      .select("id");
    expect(mine.data?.length).toBe(1);
  });
});

describe.skipIf(enabled)("document change reviews (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

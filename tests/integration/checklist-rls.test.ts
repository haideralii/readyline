/**
 * REQ-006 SR-2 / AC-3 against a real Supabase stack: a member reads and
 * writes only their own account's checklist rows; another account and an
 * anonymous client see nothing and change nothing; the note cap and the
 * status check hold in the database. Skips without the Supabase variables.
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
  const email = `checklist-${label}-${randomUUID()}@example.test`;
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
  return {
    userId: created.data.user.id,
    client,
    accountId: rpc.data as string,
  };
}

describe.skipIf(!enabled)("checklist_items row-level security (AC-3)", () => {
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
    const seed = await a.client.from("checklist_items").upsert({
      account_id: a.accountId,
      item_id: "business:abn",
      status: "have",
      note: "Confirmed",
    });
    if (seed.error) throw seed.error;
  });

  afterAll(async () => {
    for (const t of [a, b])
      if (t?.userId)
        await admin.auth.admin.deleteUser(t.userId).catch(() => undefined);
  });

  it("the member reads and updates their own rows", async () => {
    const mine = await a.client
      .from("checklist_items")
      .select("item_id, status, note")
      .eq("account_id", a.accountId);
    expect(mine.error).toBeNull();
    expect(mine.data).toEqual([
      { item_id: "business:abn", status: "have", note: "Confirmed" },
    ]);
    const up = await a.client
      .from("checklist_items")
      .update({ status: "in-progress" })
      .eq("account_id", a.accountId)
      .eq("item_id", "business:abn")
      .select("status");
    expect(up.error).toBeNull();
    expect(up.data).toEqual([{ status: "in-progress" }]);
  });

  it("another account and an anonymous client see nothing and change nothing", async () => {
    const theirs = await b.client
      .from("checklist_items")
      .select("item_id")
      .eq("account_id", a.accountId);
    expect(theirs.data).toEqual([]);
    const none = await anon.from("checklist_items").select("item_id");
    expect(none.data ?? []).toEqual([]);
    const insert = await b.client.from("checklist_items").insert({
      account_id: a.accountId,
      item_id: "business:abn-forged",
      status: "have",
      note: "",
    });
    expect(insert.error).not.toBeNull();
    const update = await b.client
      .from("checklist_items")
      .update({ note: "tampered" })
      .eq("account_id", a.accountId)
      .select("note");
    expect(update.data ?? []).toEqual([]);
    const del = await b.client
      .from("checklist_items")
      .delete()
      .eq("account_id", a.accountId)
      .select("item_id");
    expect(del.data ?? []).toEqual([]);
    const still = await admin
      .from("checklist_items")
      .select("note")
      .eq("account_id", a.accountId);
    expect(still.data).toEqual([{ note: "Confirmed" }]);
  });

  it("the database refuses a note over 500 characters, an unknown status and a malformed item id", async () => {
    const long = await a.client.from("checklist_items").upsert({
      account_id: a.accountId,
      item_id: "documents:governance-policy",
      status: "need",
      note: "x".repeat(501),
    });
    expect(long.error).not.toBeNull();
    const status = await a.client.from("checklist_items").upsert({
      account_id: a.accountId,
      item_id: "documents:governance-policy",
      status: "done",
      note: "",
    });
    expect(status.error).not.toBeNull();
    const id = await a.client.from("checklist_items").upsert({
      account_id: a.accountId,
      item_id: "Documents/Governance",
      status: "need",
      note: "",
    });
    expect(id.error).not.toBeNull();
  });
});

describe.skipIf(enabled)("checklist_items (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

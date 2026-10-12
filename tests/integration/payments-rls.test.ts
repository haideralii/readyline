/**
 * REQ-007 AC-5 / FR-4 against a real Supabase stack: an owner reads their
 * own purchases and entitlements, another account reads nothing, anonymous
 * reads nothing, and no client can write to the payment tables or read the
 * Stripe event ledger. Rows are written with the secret key, as the webhook
 * will. Skips without the Supabase variables.
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
  const email = `pay-${label}-${randomUUID()}@example.test`;
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

describe.skipIf(!enabled)("payments tables RLS (REQ-007 AC-5)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let a: Tenant;
  let b: Tenant;
  let purchaseId: string;
  const sessionId = `cs_test_${randomUUID()}`;
  const eventId = `evt_test_${randomUUID()}`;

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
    const purchase = await admin
      .from("purchases")
      .insert({
        account_id: a.accountId,
        stripe_checkout_session_id: sessionId,
        stripe_payment_intent_id: `pi_test_${randomUUID()}`,
        amount_cents: 39900,
        currency: "aud",
        status: "paid",
      })
      .select("id")
      .single();
    if (purchase.error) throw purchase.error;
    purchaseId = purchase.data.id as string;
    const ent = await admin.from("entitlements").insert({
      account_id: a.accountId,
      kind: "pack",
      assessment_id: "answers-v1-test",
      source_purchase_id: purchaseId,
    });
    if (ent.error) throw ent.error;
    const evt = await admin
      .from("stripe_events")
      .insert({ id: eventId, type: "checkout.session.completed" });
    if (evt.error) throw evt.error;
    const job = await admin.from("generation_jobs").insert({
      account_id: a.accountId,
      purchase_id: purchaseId,
      assessment_id: "answers-v1-test",
    });
    if (job.error) throw job.error;
  });

  afterAll(async () => {
    for (const t of [a, b])
      if (t?.userId) await admin.auth.admin.deleteUser(t.userId);
    await admin.from("stripe_events").delete().eq("id", eventId);
  });

  it("the owner reads their purchase, entitlement and job", async () => {
    const p = await a.client
      .from("purchases")
      .select("id, status, amount_cents");
    expect(p.error).toBeNull();
    expect(p.data).toEqual([
      { id: purchaseId, status: "paid", amount_cents: 39900 },
    ]);
    const e = await a.client.from("entitlements").select("kind, revoked_at");
    expect(e.data).toEqual([{ kind: "pack", revoked_at: null }]);
    const j = await a.client.from("generation_jobs").select("status");
    expect(j.data).toEqual([{ status: "queued" }]);
  });

  it("another account and an anonymous client read nothing", async () => {
    for (const table of ["purchases", "entitlements", "generation_jobs"]) {
      const other = await b.client.from(table).select("id");
      expect(other.error, table).toBeNull();
      expect(other.data, table).toEqual([]);
      const none = await anon.from(table).select("id");
      expect(none.data ?? [], table).toEqual([]);
    }
  });

  it("no client can read the Stripe event ledger", async () => {
    for (const client of [a.client, b.client, anon]) {
      const r = await client
        .from("stripe_events")
        .select("id")
        .eq("id", eventId);
      expect(r.data ?? []).toEqual([]);
    }
  });

  it("no client can write to the payment tables, even the owner", async () => {
    const ins = await a.client.from("purchases").insert({
      account_id: a.accountId,
      stripe_checkout_session_id: `cs_forged_${randomUUID()}`,
      amount_cents: 1,
      currency: "aud",
      status: "paid",
    });
    expect(ins.error).not.toBeNull();
    const grant = await a.client.from("entitlements").insert({
      account_id: a.accountId,
      kind: "pack",
    });
    expect(grant.error).not.toBeNull();
    await a.client
      .from("purchases")
      .update({ status: "refunded" })
      .eq("id", purchaseId);
    await a.client
      .from("entitlements")
      .update({ revoked_at: null })
      .eq("account_id", a.accountId);
    const check = await admin
      .from("purchases")
      .select("status")
      .eq("id", purchaseId)
      .single();
    expect(check.data?.status).toBe("paid");
    const del = await a.client
      .from("entitlements")
      .delete()
      .eq("account_id", a.accountId);
    expect(del.error ?? null).toBeNull();
    const still = await admin
      .from("entitlements")
      .select("id")
      .eq("account_id", a.accountId);
    expect(still.data).toHaveLength(1);
  });
});

describe.skipIf(enabled)("payments tables RLS (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

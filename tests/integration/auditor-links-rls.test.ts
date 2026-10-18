/**
 * REQ-020 SR-1, SR-2 against a real Supabase stack: the owner creates and
 * revokes an auditor link and reads its row; another account and an
 * anonymous client see nothing and change nothing; nobody deletes through
 * the API; the lookup function answers only a live hash, only to the
 * service key, and never says why a hash failed. Skips without the
 * Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashAuditorToken } from "@/lib/registers/auditor-link";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Tenant = { userId: string; client: SupabaseClient; accountId: string };

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Tenant> {
  const email = `auditor-links-${label}-${randomUUID()}@example.test`;
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

const inHours = (h: number) =>
  new Date(Date.now() + h * 3_600_000).toISOString();

describe.skipIf(!enabled)("auditor links (REQ-020 SR-1, SR-2)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let a: Tenant;
  let b: Tenant;
  const token = `tok-${randomUUID()}`;
  let linkId: string;

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

  it("the owner creates a link (hash only) and reads its row; the hash must be 64 hex", async () => {
    const bad = await a.client.from("auditor_links").insert({
      account_id: a.accountId,
      token_hash: "not-a-hash",
      expires_at: inHours(72),
    });
    expect(bad.error?.code).toBe("23514");
    const ins = await a.client
      .from("auditor_links")
      .insert({
        account_id: a.accountId,
        token_hash: hashAuditorToken(token),
        expires_at: inHours(72),
      })
      .select("id, opened_count, revoked_at")
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data?.opened_count).toBe(0);
    linkId = ins.data!.id as string;
  });

  it("another account and an anonymous client see nothing, insert nothing and change nothing", async () => {
    const other = await b.client
      .from("auditor_links")
      .select("id")
      .eq("account_id", a.accountId);
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);
    const forge = await b.client.from("auditor_links").insert({
      account_id: a.accountId,
      token_hash: hashAuditorToken("forged"),
      expires_at: inHours(24),
    });
    expect(forge.error?.code).toBe("42501");
    const revokeByOther = await b.client
      .from("auditor_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId)
      .select("id");
    expect(revokeByOther.data ?? []).toEqual([]);
    const none = await anon.from("auditor_links").select("id");
    expect(none.data ?? []).toEqual([]);
    const anonLookup = await anon.rpc("auditor_link_lookup", {
      p_token_hash: hashAuditorToken(token),
    });
    expect(anonLookup.error?.code).toBe("42501");
    const ownerLookup = await a.client.rpc("auditor_link_lookup", {
      p_token_hash: hashAuditorToken(token),
    });
    expect(ownerLookup.error?.code).toBe("42501");
  });

  it("the lookup answers the live link to the service key and nothing for an unknown, revoked or expired hash", async () => {
    const live = await admin.rpc("auditor_link_lookup", {
      p_token_hash: hashAuditorToken(token),
    });
    expect(live.error).toBeNull();
    expect(live.data).toHaveLength(1);
    expect(live.data?.[0]).toMatchObject({
      link_id: linkId,
      account_id: a.accountId,
      trading_name: "Tenant a",
    });
    const unknown = await admin.rpc("auditor_link_lookup", {
      p_token_hash: hashAuditorToken("never"),
    });
    expect(unknown.error).toBeNull();
    expect(unknown.data).toEqual([]);
    // Per run, not fixed: a fixed token left its hash on the stack, and the
    // restore rehearsal brought it back into the unique column (#115 at 8f06a44).
    const expiredToken = `old-${randomUUID()}`;
    const expired = await admin
      .from("auditor_links")
      .insert({
        account_id: a.accountId,
        token_hash: hashAuditorToken(expiredToken),
        expires_at: inHours(-1),
      })
      .select("id")
      .single();
    expect(expired.error).toBeNull();
    const gone = await admin.rpc("auditor_link_lookup", {
      p_token_hash: hashAuditorToken(expiredToken),
    });
    expect(gone.data).toEqual([]);
  });

  it("the owner revokes; after that the lookup is empty; nobody deletes through the API", async () => {
    const rev = await a.client
      .from("auditor_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId)
      .select("id");
    expect(rev.error).toBeNull();
    expect(rev.data).toHaveLength(1);
    const after = await admin.rpc("auditor_link_lookup", {
      p_token_hash: hashAuditorToken(token),
    });
    expect(after.data).toEqual([]);
    const del = await a.client
      .from("auditor_links")
      .delete()
      .eq("id", linkId)
      .select("id");
    expect(del.error?.code ?? (del.data?.length === 0 ? "42501" : "")).toBe(
      "42501",
    );
  });
});

/**
 * REQ-005 Session C against a real Supabase stack: the documents bucket is
 * private and account-scoped (SR-4, AC-7), version rows are member-only, and
 * the daily quota counts in one statement (FR-9, AC-8). Skips without the
 * Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";
import { DOCUMENTS_BUCKET } from "@/server/generation/storage";

const enabled = hasSupabaseEnv();

type Tenant = { userId: string; client: SupabaseClient; accountId: string };

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Tenant> {
  const email = `gen-${label}-${randomUUID()}@example.test`;
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

describe.skipIf(!enabled)(
  "generation storage, rows and quota (AC-7, AC-8)",
  () => {
    let admin: SupabaseClient;
    let a: Tenant;
    let b: Tenant;
    let setId: string;
    let objectPathA: string;

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      a = await signUpTenant(admin, env.url, env.publishableKey, "a");
      b = await signUpTenant(admin, env.url, env.publishableKey, "b");
      const set = await admin
        .from("version_sets")
        .insert({
          account_id: a.accountId,
          created_by: a.userId,
          answers_snapshot_hash: "x",
          derived_result: {},
          status: "ready",
          storage_prefix: "",
        })
        .select("id")
        .single();
      if (set.error) throw set.error;
      setId = set.data.id as string;
      objectPathA = `${a.accountId}/${setId}/set.zip`;
      const up = await admin.storage
        .from(DOCUMENTS_BUCKET)
        .upload(objectPathA, new Uint8Array([80, 75, 3, 4]), {
          contentType: "application/zip",
        });
      if (up.error) throw up.error;
      const doc = await admin.from("document_versions").insert({
        version_set_id: setId,
        account_id: a.accountId,
        document_type_id: "governance-policy",
        version: 1,
        status: "ready",
        storage_path: objectPathA,
        model: { title: "Governance policy", sections: [] },
      });
      if (doc.error) throw doc.error;
    });

    afterAll(async () => {
      await admin.storage
        .from(DOCUMENTS_BUCKET)
        .remove([objectPathA])
        .catch(() => undefined);
      for (const t of [a, b])
        if (t?.userId)
          await admin.auth.admin.deleteUser(t.userId).catch(() => undefined);
    });

    it("the owner can sign and download its own object; another account cannot (AC-7)", async () => {
      const mine = await a.client.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(objectPathA, 60);
      expect(mine.error).toBeNull();
      expect(mine.data?.signedUrl).toContain("token=");
      const theirs = await b.client.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(objectPathA, 60);
      expect(theirs.error).not.toBeNull();
      const download = await b.client.storage
        .from(DOCUMENTS_BUCKET)
        .download(objectPathA);
      expect(download.error).not.toBeNull();
      const anon = await admin.storage
        .from(DOCUMENTS_BUCKET)
        .getPublicUrl(objectPathA);
      const res = await fetch(anon.data.publicUrl);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("clients cannot write to the bucket", async () => {
      const r = await a.client.storage
        .from(DOCUMENTS_BUCKET)
        .upload(`${a.accountId}/${setId}/evil.zip`, new Uint8Array([1]));
      expect(r.error).not.toBeNull();
    });

    it("version sets and document versions are visible only to their members", async () => {
      const mine = await a.client
        .from("version_sets")
        .select("id")
        .eq("id", setId);
      expect(mine.data?.length).toBe(1);
      const theirs = await b.client
        .from("version_sets")
        .select("id")
        .eq("id", setId);
      expect(theirs.data).toEqual([]);
      const docs = await b.client
        .from("document_versions")
        .select("id")
        .eq("version_set_id", setId);
      expect(docs.data).toEqual([]);
      const insert = await b.client.from("version_sets").insert({
        account_id: b.accountId,
        answers_snapshot_hash: "x",
        derived_result: {},
        status: "ready",
        storage_prefix: "",
      });
      expect(insert.error).not.toBeNull();
    });

    it("the daily quota allows the default five and refuses the sixth; a raised limit allows more (AC-8)", async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await admin.rpc("generation_quota_hit", {
          p_account: b.accountId,
        });
        expect(r.error).toBeNull();
        results.push(r.data as boolean);
      }
      expect(results).toEqual([true, true, true, true, true, false]);
      const raise = await admin
        .from("accounts")
        .update({ generation_daily_limit: 7 })
        .eq("id", b.accountId);
      expect(raise.error).toBeNull();
      const seventh = await admin.rpc("generation_quota_hit", {
        p_account: b.accountId,
      });
      expect(seventh.data).toBe(true);
      const viaClient = await b.client.rpc("generation_quota_hit", {
        p_account: b.accountId,
      });
      expect(viaClient.error).not.toBeNull();
    });
  },
);

describe.skipIf(enabled)("generation (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

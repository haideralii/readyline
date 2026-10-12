/**
 * REQ-004 FR-10 against a real Supabase stack: an account created through
 * `create_account` as an authenticated user reads back through the same
 * query the callback and every page use (`getOwnedAccount`), and a user
 * with no account gets null rather than an error. Skips without the
 * Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getOwnedAccount } from "@/server/accounts/owned-account";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

describe.skipIf(!enabled)("account read-back (REQ-004 FR-10)", () => {
  let admin: SupabaseClient;
  let client: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `readback-${randomUUID()}@example.test`;
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
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("returns null before an account exists and the account right after create_account", async () => {
    expect(await getOwnedAccount(client, userId)).toBeNull();
    const rpc = await client.rpc("create_account", {
      p_trading_name: "Readback Supports",
      p_business_structure: "sole-trader",
      p_states: ["NSW", "VIC"],
      p_abn: null,
    });
    expect(rpc.error).toBeNull();
    const account = await getOwnedAccount(client, userId);
    expect(account).toEqual({
      id: rpc.data,
      trading_name: "Readback Supports",
      business_structure: "sole-trader",
      states: ["NSW", "VIC"],
      abn: null,
    });
  });
});

describe.skipIf(enabled)("account read-back (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

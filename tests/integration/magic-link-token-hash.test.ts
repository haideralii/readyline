/**
 * REQ-004 FR-9a against a real Supabase stack: the token hash the email
 * template carries can be verified by a client that never requested the
 * link, which is what "works on any device" means at the API level; and a
 * hash cannot be used twice. Skips without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

describe.skipIf(!enabled)("magic link token hash (REQ-004 FR-9a)", () => {
  let admin: SupabaseClient;
  let userId: string;
  let email: string;

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    email = `token-hash-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (created.error || !created.data.user)
      throw created.error ?? new Error("createUser failed");
    userId = created.data.user.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("a fresh client verifies the hash into a session, and the hash is single use", async () => {
    const env = readSupabaseAdminEnv();
    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    expect(link.error).toBeNull();
    const tokenHash = link.data.properties?.hashed_token;
    expect(tokenHash).toBeTruthy();

    const fresh = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const verified = await fresh.auth.verifyOtp({
      token_hash: tokenHash!,
      type: "magiclink",
    });
    expect(verified.error).toBeNull();
    expect(verified.data.user?.id).toBe(userId);
    expect(verified.data.session?.access_token).toBeTruthy();

    const again = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const reused = await again.auth.verifyOtp({
      token_hash: tokenHash!,
      type: "magiclink",
    });
    expect(reused.error).not.toBeNull();
  });
});

describe.skipIf(enabled)("magic link token hash (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

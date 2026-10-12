/**
 * REQ-005 R-11 / D-538 against a real Supabase stack: every function the
 * server calls with the secret key is executable by service_role, through a
 * client built with that key (not the database owner), and stays closed to
 * the publishable key. Skips without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

/** Every secret-key function, with arguments that are safe to call repeatedly. */
const SECRET_KEY_FUNCTIONS: ReadonlyArray<{
  name: string;
  args: () => Record<string, unknown>;
}> = [
  {
    name: "auth_rate_limit_hit",
    args: () => ({
      p_key: `grant-check:${randomUUID()}`,
      p_limit: 5,
      p_window_seconds: 60,
    }),
  },
  {
    name: "generation_quota_hit",
    args: () => ({ p_account: "00000000-0000-4000-8000-000000000000" }),
  },
  {
    // REQ-007 Session C: returns a set of rows (empty when nothing is queued).
    name: "claim_generation_job",
    args: () => ({ p_lease_seconds: 60 }),
  },
];

describe.skipIf(!enabled)("service_role execute grants (R-11, D-538)", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  const userIds: string[] = [];

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    service = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterAll(async () => {
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  });

  for (const fn of SECRET_KEY_FUNCTIONS) {
    it(`${fn.name} runs through a service-role client`, async () => {
      const r = await service.rpc(fn.name, fn.args());
      expect(
        r.error,
        `${fn.name}: ${r.error?.code} ${r.error?.message}`,
      ).toBeNull();
      expect(["boolean", "object"]).toContain(typeof r.data);
    });

    it(`${fn.name} is refused for the publishable key, signed out and signed in`, async () => {
      const out = await anon.rpc(fn.name, fn.args());
      expect(out.error?.code, `${fn.name} signed out`).toBe("42501");
      const email = `grants-${randomUUID()}@example.test`;
      const password = `Pw-${randomUUID()}`;
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw created.error ?? new Error("createUser failed");
      userIds.push(created.data.user.id);
      const env = readSupabaseAdminEnv();
      const signedIn = createClient(env.url, env.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await signedIn.auth.signInWithPassword({
        email,
        password,
      });
      if (signed.error) throw signed.error;
      const inn = await signedIn.rpc(fn.name, fn.args());
      expect(inn.error?.code, `${fn.name} signed in`).toBe("42501");
    });
  }
});

/** Every table the server touches with the secret key (D-711); a read is enough to prove the grant. */
const SECRET_KEY_TABLES = [
  "accounts",
  "memberships",
  "questionnaire_drafts",
  "version_sets",
  "document_versions",
  "generation_log",
  "audit_log",
  "auth_rate_limits",
  "purchases",
  "entitlements",
  "generation_jobs",
  "stripe_events",
] as const;

describe.skipIf(!enabled)("service_role table grants (D-711)", () => {
  let service: SupabaseClient;

  beforeAll(() => {
    const env = readSupabaseAdminEnv();
    service = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  for (const table of SECRET_KEY_TABLES) {
    it(`${table} is readable through a service-role client`, async () => {
      const r = await service.from(table).select("*").limit(1);
      expect(r.error, `${table}: ${r.error?.code} ${r.error?.message}`).toBe(
        null,
      );
    });
  }
});

describe.skipIf(enabled)("service_role execute grants (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

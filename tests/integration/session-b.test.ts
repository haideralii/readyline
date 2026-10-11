/**
 * REQ-004 Session B integration tests against a real Supabase stack:
 * the magic-link limiter function, the one-owner-account cap, the database
 * constraints that mirror the zod schema, and the server draft round trip.
 * Skips itself without the three Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

describe.skipIf(!enabled)(
  "session B: limiter, account cap, constraints",
  () => {
    let admin: SupabaseClient;
    let user: SupabaseClient;
    let userId: string;

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const email = `sb-${randomUUID()}@example.test`;
      const password = `Pw-${randomUUID()}`;
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw created.error ?? new Error("createUser failed");
      userId = created.data.user.id;
      user = createClient(env.url, env.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await user.auth.signInWithPassword({ email, password });
      if (signed.error) throw signed.error;
    });

    afterAll(async () => {
      if (userId) await admin.auth.admin.deleteUser(userId);
    });

    it("auth_rate_limit_hit allows the first N calls per key within the window and refuses the next (AC-6)", async () => {
      const key = `email:test-${randomUUID()}`;
      const results: boolean[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await admin.rpc("auth_rate_limit_hit", {
          p_key: key,
          p_limit: 5,
          p_window_seconds: 3600,
        });
        expect(r.error).toBeNull();
        results.push(r.data as boolean);
      }
      expect(results).toEqual([true, true, true, true, true, false]);
      const other = await admin.rpc("auth_rate_limit_hit", {
        p_key: `ip:203.0.113.9-${randomUUID()}`,
        p_limit: 20,
        p_window_seconds: 3600,
      });
      expect(other.data).toBe(true);
    });

    it("the limiter function cannot be called with the publishable key", async () => {
      const r = await user.rpc("auth_rate_limit_hit", {
        p_key: "x",
        p_limit: 5,
        p_window_seconds: 60,
      });
      expect(r.error).not.toBeNull();
    });

    it("create_account works once per user and refuses a second owner account", async () => {
      const first = await user.rpc("create_account", {
        p_trading_name: "First",
        p_business_structure: "company",
        p_states: ["VIC"],
        p_abn: null,
      });
      expect(first.error).toBeNull();
      const second = await user.rpc("create_account", {
        p_trading_name: "Second",
        p_business_structure: "company",
        p_states: ["VIC"],
        p_abn: null,
      });
      expect(second.error).not.toBeNull();
      expect(second.error?.message).toMatch(/already owns an account/);
    });

    it("database constraints reject values the zod schema would reject", async () => {
      const bad = await user.rpc("create_account", {
        p_trading_name: "",
        p_business_structure: "company",
        p_states: ["VIC"],
        p_abn: null,
      });
      expect(bad.error).not.toBeNull(); // empty trading name (and the user already owns one)

      const accounts = await user
        .from("accounts")
        .select("id")
        .limit(1)
        .single();
      const states = await user
        .from("accounts")
        .update({ states: ["XX"] })
        .eq("id", accounts.data!.id)
        .select();
      expect(states.error).not.toBeNull();
      const abn = await user
        .from("accounts")
        .update({ abn: "123" })
        .eq("id", accounts.data!.id)
        .select();
      expect(abn.error).not.toBeNull();
      const structure = await user
        .from("accounts")
        .update({ business_structure: "cartel" })
        .eq("id", accounts.data!.id)
        .select();
      expect(structure.error).not.toBeNull();
      const long = await user
        .from("accounts")
        .update({ trading_name: "x".repeat(121) })
        .eq("id", accounts.data!.id)
        .select();
      expect(long.error).not.toBeNull();
    });

    it("the owner's draft round-trips through questionnaire_drafts", async () => {
      const accounts = await user
        .from("accounts")
        .select("id")
        .limit(1)
        .single();
      const id = accounts.data!.id;
      const up = await user.from("questionnaire_drafts").upsert(
        {
          account_id: id,
          answers: { business: { tradingName: "First" } },
          answers_version: 1,
          current_step: "supports",
        },
        { onConflict: "account_id" },
      );
      expect(up.error).toBeNull();
      const back = await user
        .from("questionnaire_drafts")
        .select("answers, current_step")
        .eq("account_id", id)
        .single();
      expect(back.data?.current_step).toBe("supports");
      expect(back.data?.answers).toEqual({
        business: { tradingName: "First" },
      });
    });
  },
);

describe.skipIf(enabled)("session B (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

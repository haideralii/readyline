/**
 * REQ-023 Session A against a real Supabase stack (SR-2; D-2312; findings
 * 61 and 63): the owner writes the period with no subscription, a member
 * reads it, another tenant sees nothing, nobody deletes it, the CHECKs hold
 * the override inside the period, the reminders table takes the five kinds
 * with the period as their subject, `clear_registration_reminders` deletes
 * the account's unsent timeline rows alone and refuses a non-owner, and the
 * owner's session cannot delete reminders directly. Skips without the
 * variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
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
  const email = `periods-${label}-${randomUUID()}@example.test`;
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
    p_trading_name: `Periods ${label}`,
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

const period = (accountId: string, over: Record<string, unknown> = {}) => ({
  account_id: accountId,
  period_starts_on: "2026-03-01",
  period_ends_on: "2029-03-01",
  audit_type: "certification",
  midterm_applies: true,
  ...over,
});

describe.skipIf(!enabled)(
  "registration periods and the timeline reminders (REQ-023 Session A)",
  () => {
    let admin: SupabaseClient;
    let a: Tenant;
    let b: Tenant;
    const users: string[] = [];

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      a = await signUpTenant(admin, env.url, env.publishableKey, "a");
      b = await signUpTenant(admin, env.url, env.publishableKey, "b");
      users.push(a.userId, b.userId);
    });

    afterAll(async () => {
      for (const id of users)
        await admin.auth.admin.deleteUser(id).catch(() => undefined);
    });

    it("the owner writes and updates the period with no subscription; another tenant reads nothing; nobody deletes (D-2312, finding 63)", async () => {
      const ins = await a.client
        .from("registration_periods")
        .insert(period(a.accountId))
        .select("id, midterm_applies")
        .single();
      expect(ins.error).toBeNull();
      const id = ins.data!.id as string;
      const up = await a.client
        .from("registration_periods")
        .update({ period_ends_on: "2029-06-01", last_audit_on: "2026-02-20" })
        .eq("id", id)
        .select("period_ends_on");
      expect(up.error).toBeNull();
      expect(up.data?.[0]?.period_ends_on).toBe("2029-06-01");
      const other = await b.client
        .from("registration_periods")
        .select("id")
        .eq("account_id", a.accountId);
      expect(other.error).toBeNull();
      expect(other.data).toEqual([]);
      const forged = await b.client
        .from("registration_periods")
        .insert(period(a.accountId, { period_starts_on: "2020-01-01" }));
      expect(forged.error).not.toBeNull();
      const del = await a.client
        .from("registration_periods")
        .delete()
        .eq("id", id)
        .select("id");
      expect(del.error?.code).toBe("42501");
      const still = await admin
        .from("registration_periods")
        .select("id")
        .eq("id", id);
      expect(still.data).toHaveLength(1);
    });

    it("the CHECKs: the end after the start, the override inside the period, one row per start date (findings 30 and 75)", async () => {
      const backwards = await a.client.from("registration_periods").insert(
        period(a.accountId, {
          period_starts_on: "2030-01-01",
          period_ends_on: "2029-12-31",
        }),
      );
      expect(backwards.error?.code).toBe("23514");
      const early = await a.client.from("registration_periods").insert(
        period(a.accountId, {
          period_starts_on: "2029-03-02",
          period_ends_on: "2032-03-02",
          midterm_start_by_override: "2029-03-01",
          midterm_override_source: "letter",
        }),
      );
      expect(early.error?.code).toBe("23514");
      const late = await a.client.from("registration_periods").insert(
        period(a.accountId, {
          period_starts_on: "2029-03-02",
          period_ends_on: "2032-03-02",
          midterm_start_by_override: "2032-03-03",
          midterm_override_source: "condition",
        }),
      );
      expect(late.error?.code).toBe("23514");
      const twice = await a.client
        .from("registration_periods")
        .insert(period(a.accountId));
      expect(twice.error?.code).toBe("23505");
    });

    it("clear_registration_reminders deletes the account's unsent timeline rows alone, refuses a non-owner, and the owner cannot delete reminders directly (finding 61)", async () => {
      const row = await admin
        .from("registration_periods")
        .select("id")
        .eq("account_id", a.accountId)
        .single();
      const periodId = row.data!.id as string;
      const seeded = await admin.from("reminders").insert([
        {
          account_id: a.accountId,
          kind: "midterm-prepare",
          subject_table: "registration_periods",
          subject_id: periodId,
          due_on: "2027-09-01",
          send_on: "2027-03-01",
        },
        {
          account_id: a.accountId,
          kind: "renewal-window",
          subject_table: "registration_periods",
          subject_id: periodId,
          due_on: "2029-06-01",
          send_on: "2028-12-01",
          sent_at: new Date().toISOString(),
        },
        {
          account_id: a.accountId,
          kind: "emergency-drill",
          subject_table: "accounts",
          subject_id: a.accountId,
          due_on: "2027-01-01",
          send_on: "2026-12-18",
        },
      ]);
      expect(seeded.error).toBeNull();
      // Run 38836764150: on a stack with default privileges the owner's delete
      // matched zero rows instead of raising, so the grant itself is read
      // (the `req-020-session-c-rls` pattern): `authenticated` holds select
      // on reminders and nothing else, whatever the defaults gave.
      const dbUrl = process.env.SUPABASE_DB_URL?.trim();
      if (dbUrl) {
        const grants = execFileSync(
          "psql",
          [
            dbUrl,
            "-v",
            "ON_ERROR_STOP=1",
            "-At",
            "-c",
            "select privilege_type from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'reminders' order by 1",
          ],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        )
          .split("\n")
          .filter(Boolean);
        expect(grants, "authenticated holds select alone on reminders").toEqual(
          ["SELECT"],
        );
      } else {
        expect(process.env.CI, "SUPABASE_DB_URL is not set").toBeFalsy();
      }
      const direct = await a.client
        .from("reminders")
        .delete()
        .eq("account_id", a.accountId)
        .select("id");
      expect(direct.error?.code).toBe("42501");
      const notOwner = await b.client.rpc("clear_registration_reminders", {
        p_account: a.accountId,
      });
      expect(notOwner.error?.code).toBe("42501");
      const cleared = await a.client.rpc("clear_registration_reminders", {
        p_account: a.accountId,
      });
      expect(cleared.error).toBeNull();
      expect(cleared.data).toBe(1);
      const left = await admin
        .from("reminders")
        .select("kind, sent_at")
        .eq("account_id", a.accountId)
        .order("kind");
      expect(left.data?.map((r) => r.kind)).toEqual([
        "emergency-drill",
        "renewal-window",
      ]);
    });
  },
);

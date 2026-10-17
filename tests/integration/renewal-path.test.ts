/**
 * REQ-023 Session C against a real Supabase stack (FR-7, FR-8, SR-1, AC-5):
 * the renewal's five facts on the period row with their CHECKs (the
 * auditing company's name bounded and never an NDIS-number shape; a scope or
 * decision date needs an application date), the rehearsal's mode and period
 * on `self_checks`, the auditor link's tick off by default and returned by
 * the signed-out lookup. Skips without the variables.
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
  const email = `req-023-c-${label}-${randomUUID()}@example.test`;
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
    p_trading_name: `Session C ${label}`,
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

describe.skipIf(!enabled)("the renewal path's rows (REQ-023 Session C)", () => {
  let admin: SupabaseClient;
  let a: Tenant;
  let periodId = "";

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    a = await signUpTenant(admin, env.url, env.publishableKey, "a");
    const ent = await admin
      .from("entitlements")
      .insert({ account_id: a.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    const period = await admin
      .from("registration_periods")
      .insert({
        account_id: a.accountId,
        period_starts_on: "2026-03-01",
        period_ends_on: "2029-03-01",
        audit_type: "certification",
        midterm_applies: true,
      })
      .select("id")
      .single();
    if (period.error) throw period.error;
    periodId = period.data.id as string;
  });

  afterAll(async () => {
    if (a?.userId)
      await admin.auth.admin.deleteUser(a.userId).catch(() => undefined);
  });

  it("FR-7: the five facts default empty; a scope or decision date without an application date is refused", async () => {
    const row = await a.client
      .from("registration_periods")
      .select(
        "application_submitted_on, scope_received_on, audit_booked_on, auditor_business_name, decision_received_on",
      )
      .eq("id", periodId)
      .single();
    expect(row.error).toBeNull();
    expect(row.data).toEqual({
      application_submitted_on: null,
      scope_received_on: null,
      audit_booked_on: null,
      auditor_business_name: "",
      decision_received_on: null,
    });
    const scopeFirst = await a.client
      .from("registration_periods")
      .update({ scope_received_on: "2028-10-01" })
      .eq("id", periodId);
    expect(scopeFirst.error?.code).toBe("23514");
    const decisionFirst = await a.client
      .from("registration_periods")
      .update({ decision_received_on: "2029-01-10" })
      .eq("id", periodId);
    expect(decisionFirst.error?.code).toBe("23514");
    const applied = await a.client
      .from("registration_periods")
      .update({ application_submitted_on: "2028-09-15" })
      .eq("id", periodId);
    expect(applied.error).toBeNull();
    const scope = await a.client
      .from("registration_periods")
      .update({ scope_received_on: "2028-10-01" })
      .eq("id", periodId);
    expect(scope.error).toBeNull();
  });

  it("SR-1: the auditing company's name is bounded and never an NDIS-number shape", async () => {
    const tooLong = await a.client
      .from("registration_periods")
      .update({ auditor_business_name: "A".repeat(81) })
      .eq("id", periodId);
    expect(tooLong.error?.code).toBe("23514");
    const ndisNumber = await a.client
      .from("registration_periods")
      .update({ auditor_business_name: "430123456" })
      .eq("id", periodId);
    expect(ndisNumber.error?.code).toBe("23514");
    const odd = await a.client
      .from("registration_periods")
      .update({ auditor_business_name: "Name <script>" })
      .eq("id", periodId);
    expect(odd.error?.code).toBe("23514");
    const ok = await a.client
      .from("registration_periods")
      .update({
        audit_booked_on: "2028-11-20",
        auditor_business_name: "Quality & Co. Pty Ltd (Audits)",
      })
      .eq("id", periodId)
      .select("audit_booked_on, auditor_business_name")
      .single();
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual({
      audit_booked_on: "2028-11-20",
      auditor_business_name: "Quality & Co. Pty Ltd (Audits)",
    });
  });

  it("FR-8: a rehearsal row carries its period, a walk carries none, and the mode is one of two", async () => {
    const walk = await a.client.from("self_checks").insert({
      account_id: a.accountId,
      walked_on: "2028-09-20",
      walked_by_ref: "W-01",
      findings: 0,
      answers: {},
      created_by: a.userId,
    });
    expect(walk.error).toBeNull();
    const walkWithPeriod = await a.client.from("self_checks").insert({
      account_id: a.accountId,
      walked_on: "2028-09-20",
      walked_by_ref: "W-01",
      findings: 0,
      answers: {},
      created_by: a.userId,
      period_from: "2026-03-01",
      period_to: "2028-09-20",
    });
    expect(walkWithPeriod.error?.code).toBe("23514");
    const rehearsalNoPeriod = await a.client.from("self_checks").insert({
      account_id: a.accountId,
      walked_on: "2028-09-20",
      walked_by_ref: "W-01",
      findings: 0,
      answers: {},
      created_by: a.userId,
      mode: "rehearsal",
    });
    expect(rehearsalNoPeriod.error?.code).toBe("23514");
    const rehearsal = await a.client
      .from("self_checks")
      .insert({
        account_id: a.accountId,
        walked_on: "2028-09-21",
        walked_by_ref: "W-01",
        findings: 2,
        answers: {},
        created_by: a.userId,
        mode: "rehearsal",
        period_from: "2026-03-01",
        period_to: "2028-09-21",
      })
      .select("mode, period_from, period_to")
      .single();
    expect(rehearsal.error).toBeNull();
    expect(rehearsal.data).toEqual({
      mode: "rehearsal",
      period_from: "2026-03-01",
      period_to: "2028-09-21",
    });
    const other = await a.client.from("self_checks").insert({
      account_id: a.accountId,
      walked_on: "2028-09-20",
      walked_by_ref: "W-01",
      findings: 0,
      answers: {},
      created_by: a.userId,
      mode: "practice",
    });
    expect(other.error?.code).toBe("23514");
  });

  it("D-2309: an auditor link's tick is off unless set, and the signed-out lookup returns it", async () => {
    const hash = randomUUID().replace(/-/g, "").repeat(2);
    const link = await a.client
      .from("auditor_links")
      .insert({
        account_id: a.accountId,
        token_hash: hash,
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        created_by: a.userId,
      })
      .select("include_rehearsal")
      .single();
    expect(link.error).toBeNull();
    expect(link.data?.include_rehearsal).toBe(false);
    const lookup = await admin.rpc("auditor_link_lookup", {
      p_token_hash: hash,
    });
    expect(lookup.error).toBeNull();
    const rows = lookup.data as { include_rehearsal: boolean }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].include_rehearsal).toBe(false);
    const ticked = await a.client
      .from("auditor_links")
      .insert({
        account_id: a.accountId,
        token_hash: `${hash.slice(0, 60)}abcd`,
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        created_by: a.userId,
        include_rehearsal: true,
      })
      .select("include_rehearsal")
      .single();
    expect(ticked.error).toBeNull();
    expect(ticked.data?.include_rehearsal).toBe(true);
    // The lookup stays the service role's alone (REQ-020 SR-1).
    const asTenant = await a.client.rpc("auditor_link_lookup", {
      p_token_hash: hash,
    });
    expect(asTenant.error).not.toBeNull();
  });
});

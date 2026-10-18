/**
 * REQ-032 against a real Supabase stack (FR-1 to FR-4, SR-1, AC-2): the
 * table holds the fixture's rows and the client roles read it alone;
 * `add_business_days` with states gives the TypeScript answer for every
 * day of 2026 and 2027 for NSW, {NSW, VIC} and no state; an unauthorised
 * restrictive practice saved by an NSW account carries Monday 13 April
 * 2026 (AC-1's date) and a {NSW, VIC} account the Melbourne Cup case; the
 * recompute re-derives an account's rows. Skips without the variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  HOLIDAY_ROWS,
  addBusinessDaysDetailed,
} from "@/lib/registers/public-holidays";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

vi.mock("server-only", () => ({}));

const enabled = hasSupabaseEnv();

type Tenant = { userId: string; client: SupabaseClient; accountId: string };

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
  states: string[],
): Promise<Tenant> {
  const email = `req-032-${label}-${randomUUID()}@example.test`;
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
    p_trading_name: `Holidays ${label}`,
    p_business_structure: "sole-trader",
    p_states: states,
    p_abn: null,
  });
  if (rpc.error) throw rpc.error;
  const accountId = rpc.data as string;
  const ent = await admin
    .from("entitlements")
    .insert({ account_id: accountId, kind: "subscription" });
  if (ent.error) throw ent.error;
  return { userId: created.data.user.id, client, accountId };
}

const incident = (accountId: string, occurredOn: string) => ({
  account_id: accountId,
  occurred_on: occurredOn,
  reported_on: occurredOn,
  category: "restrictive-practice-unauthorised",
  severity: "low",
  participant_ref: "P-001",
  summary: "A door was locked while the participant was inside.",
  actions_taken: "",
  reportable: true,
  status: "open",
});

describe.skipIf(!enabled)(
  "public holidays in the business-day count (REQ-032)",
  () => {
    let admin: SupabaseClient;
    let nsw: Tenant;
    let nswVic: Tenant;

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      nsw = await signUpTenant(admin, env.url, env.publishableKey, "nsw", [
        "NSW",
      ]);
      nswVic = await signUpTenant(
        admin,
        env.url,
        env.publishableKey,
        "nsw-vic",
        ["NSW", "VIC"],
      );
    });

    afterAll(async () => {
      if (!admin) return;
      for (const t of [nsw, nswVic]) {
        if (!t) continue;
        await admin.from("accounts").delete().eq("id", t.accountId);
        await admin.auth.admin.deleteUser(t.userId);
      }
    });

    it("holds the fixture's rows; a signed-in user reads them and writes none (SR-1)", async () => {
      const all = await nsw.client
        .from("public_holidays")
        .select("holiday_date, jurisdiction, name");
      expect(all.error).toBeNull();
      expect(all.data).toHaveLength(HOLIDAY_ROWS.length);
      const fixture = new Set(
        HOLIDAY_ROWS.map((r) => `${r.date}|${r.jurisdiction}|${r.name}`),
      );
      for (const row of all.data as {
        holiday_date: string;
        jurisdiction: string;
        name: string;
      }[])
        expect(
          fixture.has(`${row.holiday_date}|${row.jurisdiction}|${row.name}`),
        ).toBe(true);
      const ins = await nsw.client
        .from("public_holidays")
        .insert({
          holiday_date: "2026-07-01",
          jurisdiction: "NSW",
          name: "Made up",
        });
      expect(ins.error?.code).toBe("42501");
      const del = await nsw.client
        .from("public_holidays")
        .delete()
        .eq("holiday_date", "2026-01-01");
      expect(del.error?.code).toBe("42501");
    });

    it("AC-2: SQL and TypeScript agree for every day of 2026 and 2027, for NSW, {NSW, VIC} and no state", async () => {
      for (const states of [["NSW"], ["NSW", "VIC"], []] as string[][]) {
        const r = await nsw.client.rpc("add_business_days_range", {
          p_from: "2026-01-01",
          p_to: "2027-12-31",
          p_days: 5,
          p_states: states,
        });
        expect(r.error, states.join(",")).toBeNull();
        const rows = r.data as { start_date: string; result_date: string }[];
        expect(rows).toHaveLength(730);
        for (const row of rows)
          expect(row.result_date, `${states.join(",")} ${row.start_date}`).toBe(
            addBusinessDaysDetailed(row.start_date, 5, states).date,
          );
      }
      // The two-argument form is the weekends-only count.
      const two = await nsw.client.rpc("add_business_days", {
        p_date: "2026-04-02",
        p_days: 5,
      });
      expect(two.data).toBe("2026-04-09");
    });

    it("AC-1's dates on the row: NSW reads 13 April 2026; {NSW, VIC} reads 6 November, where VIC alone would read 9 November", async () => {
      const a = await nsw.client
        .from("incidents")
        .insert(incident(nsw.accountId, "2026-04-02"))
        .select("id, notify_by")
        .single();
      expect(a.error).toBeNull();
      expect(a.data!.notify_by).toBe("2026-04-13");
      const b = await nswVic.client
        .from("incidents")
        .insert(incident(nswVic.accountId, "2026-10-30"))
        .select("id, notify_by")
        .single();
      expect(b.error).toBeNull();
      expect(b.data!.notify_by).toBe("2026-11-06");
      // A changed date moves it through the trigger; a changed severity makes it the 24-hour window.
      const moved = await nsw.client
        .from("incidents")
        .update({ occurred_on: "2026-04-01", reported_on: "2026-04-01" })
        .eq("id", a.data!.id)
        .select("notify_by")
        .single();
      expect(moved.data!.notify_by).toBe("2026-04-10");
      const harm = await nsw.client
        .from("incidents")
        .update({ severity: "high" })
        .eq("id", a.data!.id)
        .select("notify_by")
        .single();
      expect(harm.data!.notify_by).toBe("2026-04-02");
    });

    it("FR-4, D-2917: the recompute re-derives an account's rows from the table and touches only the rows whose date moves", async () => {
      // VIC alone: the account's states change, so Melbourne Cup Day counts and the date moves.
      const states = await admin
        .from("accounts")
        .update({ states: ["VIC"] })
        .eq("id", nswVic.accountId);
      expect(states.error).toBeNull();
      const first = await admin.rpc("recompute_incident_notify_by", {
        p_account: nswVic.accountId,
      });
      expect(first.error).toBeNull();
      expect(first.data).toBe(1);
      const row = await admin
        .from("incidents")
        .select("notify_by")
        .eq("account_id", nswVic.accountId)
        .single();
      expect(row.data!.notify_by).toBe("2026-11-09");
      const again = await admin.rpc("recompute_incident_notify_by", {
        p_account: nswVic.accountId,
      });
      expect(again.data).toBe(0);
      // A signed-in user cannot call it (service role only).
      const user = await nswVic.client.rpc("recompute_incident_notify_by", {
        p_account: nswVic.accountId,
      });
      expect(user.error?.code).toBe("42501");
    });
  },
);

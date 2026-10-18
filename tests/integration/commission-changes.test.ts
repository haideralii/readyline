/**
 * REQ-023 Session D against a real Supabase stack (FR-10, SR-1, SR-2, AC-6):
 * the changes register under tenant RLS with its CHECKs, the row code from
 * the shared sequence, the status view's notify-by and states as D-2306 and
 * D-2311 define them, the shared trail taking the register, and nobody
 * deleting. Skips without the variables.
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
  const email = `req-023-d-${label}-${randomUUID()}@example.test`;
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
    p_trading_name: `Session D ${label}`,
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

/** The Sydney day plus an offset, as the view's `sydney_today()` counts it. */
const sydney = (offset: number) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};

describe.skipIf(!enabled)("the changes register (REQ-023 Session D)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let a: Tenant;
  let b: Tenant;
  let overdueId = "";
  let contactId = "";

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
    for (const t of [a, b]) {
      const ent = await admin
        .from("entitlements")
        .insert({ account_id: t.accountId, kind: "subscription" });
      if (ent.error) throw ent.error;
    }
  });

  afterAll(async () => {
    for (const t of [a, b])
      if (t?.userId)
        await admin.auth.admin.deleteUser(t.userId).catch(() => undefined);
  });

  it("AC-6: a s 13A notification known ten days ago that happened yesterday is overdue with its notify-by on the earlier day; the row takes the shared code", async () => {
    const ins = await a.client
      .from("commission_changes")
      .insert({
        account_id: a.accountId,
        kind: "notification",
        change_type: "key-personnel-change",
        happened_on: sydney(-1),
        aware_on: sydney(-10),
      })
      .select("id, reference")
      .single();
    expect(ins.error).toBeNull();
    overdueId = ins.data!.id as string;
    expect(ins.data!.reference).toBe("CHG-0001");
    const view = await a.client
      .from("commission_changes_status")
      .select("notify_by, state")
      .eq("id", overdueId)
      .single();
    expect(view.data).toEqual({ notify_by: sydney(-10), state: "overdue" });
  });

  it("AC-6: a s 13 notification has no notify-by and is to notify, never overdue; notified in the approved form it is notified, and with 'not sure' it is told, form not confirmed", async () => {
    const ins = await a.client
      .from("commission_changes")
      .insert({
        account_id: a.accountId,
        kind: "notification",
        change_type: "contact-details",
        happened_on: sydney(-10),
      })
      .select("id, reference")
      .single();
    expect(ins.error).toBeNull();
    contactId = ins.data!.id as string;
    expect(ins.data!.reference).toBe("CHG-0002");
    const pending = await a.client
      .from("commission_changes_status")
      .select("notify_by, state")
      .eq("id", contactId)
      .single();
    expect(pending.data).toEqual({ notify_by: null, state: "to notify" });
    const told = await a.client
      .from("commission_changes")
      .update({
        notified_on: sydney(0),
        channel: "portal",
        approved_form: "yes",
      })
      .eq("id", contactId)
      .select("id");
    expect(told.error).toBeNull();
    expect(told.data).toHaveLength(1);
    const notified = await a.client
      .from("commission_changes_status")
      .select("state")
      .eq("id", contactId)
      .single();
    expect(notified.data).toEqual({ state: "notified" });
    const unsure = await a.client
      .from("commission_changes")
      .update({ approved_form: "unsure" })
      .eq("id", contactId)
      .select("id");
    expect(unsure.error).toBeNull();
    const confirmed = await a.client
      .from("commission_changes_status")
      .select("state")
      .eq("id", contactId)
      .single();
    expect(confirmed.data).toEqual({ state: "told, form not confirmed" });
  });

  it("a variation is to apply, applied, then decided, with no notify-by", async () => {
    const ins = await a.client
      .from("commission_changes")
      .insert({
        account_id: a.accountId,
        kind: "variation",
        change_type: "supports-registered",
        happened_on: sydney(30),
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    const id = ins.data!.id as string;
    const read = async () =>
      (
        await a.client
          .from("commission_changes_status")
          .select("notify_by, state")
          .eq("id", id)
          .single()
      ).data;
    expect(await read()).toEqual({ notify_by: null, state: "to apply" });
    expect(
      (
        await a.client
          .from("commission_changes")
          .update({ applied_on: sydney(-2) })
          .eq("id", id)
      ).error,
    ).toBeNull();
    expect(await read()).toEqual({ notify_by: null, state: "applied" });
    expect(
      (
        await a.client
          .from("commission_changes")
          .update({ decided_on: sydney(-1), effective_on: sydney(30) })
          .eq("id", id)
      ).error,
    ).toBeNull();
    expect(await read()).toEqual({ notify_by: null, state: "decided" });
  });

  it("the CHECKs hold: a variation takes no notice fields, a notification no application dates, the kinds keep their own types, a notice names its form, and the free text refuses an NDIS number (SR-1)", async () => {
    const refused = async (row: Record<string, unknown>) => {
      const r = await a.client
        .from("commission_changes")
        .insert({ account_id: a.accountId, ...row });
      expect(r.error, JSON.stringify(row)).not.toBeNull();
    };
    await refused({
      kind: "variation",
      change_type: "supports-registered",
      happened_on: sydney(0),
      notified_on: sydney(0),
      approved_form: "yes",
    });
    await refused({
      kind: "notification",
      change_type: "area",
      happened_on: sydney(0),
      applied_on: sydney(0),
    });
    await refused({
      kind: "notification",
      change_type: "supports-registered",
      happened_on: sydney(0),
    });
    await refused({
      kind: "variation",
      change_type: "area",
      happened_on: sydney(0),
    });
    await refused({
      kind: "notification",
      change_type: "area",
      happened_on: sydney(0),
      notified_on: sydney(0),
    });
    await refused({
      kind: "notification",
      change_type: "area",
      happened_on: sydney(0),
      note: "Participant 430123456 moved.",
    });
    await refused({
      kind: "notification",
      change_type: "area",
      happened_on: sydney(0),
      commission_reference: "REF 430123456",
    });
    await refused({
      kind: "notification",
      change_type: "area",
      happened_on: sydney(0),
      change_type_x: "no such column",
    });
  });

  it("SR-2: another account and the anonymous key read nothing and cannot forge or change a row; nobody deletes", async () => {
    const theirs = await b.client
      .from("commission_changes_status")
      .select("id")
      .eq("account_id", a.accountId);
    expect(theirs.data ?? []).toEqual([]);
    const none = await anon.from("commission_changes_status").select("id");
    expect(none.data ?? []).toEqual([]);
    const forged = await b.client.from("commission_changes").insert({
      account_id: a.accountId,
      kind: "notification",
      change_type: "area",
      happened_on: sydney(0),
    });
    expect(forged.error).not.toBeNull();
    const theirEdit = await b.client
      .from("commission_changes")
      .update({ note: "changed" })
      .eq("id", overdueId)
      .select("id");
    expect(theirEdit.error).toBeNull();
    expect(theirEdit.data ?? []).toEqual([]);
    const ownerDelete = await a.client
      .from("commission_changes")
      .delete()
      .eq("id", overdueId)
      .select("id");
    // No delete grant (D-2245): Postgres refuses the owner's delete at the grant, 42501, before any policy.
    expect(ownerDelete.error?.code).toBe("42501");
    // The grants read back as the other registers' tests read them (adoption-per-version.test.ts):
    // authenticated holds select, insert and update, never delete; anon holds nothing.
    const dbUrl = process.env.SUPABASE_DB_URL?.trim();
    if (dbUrl) {
      const read = (grantee: string) =>
        execFileSync(
          "psql",
          [
            dbUrl,
            "-v",
            "ON_ERROR_STOP=1",
            "-At",
            "-c",
            `select privilege_type from information_schema.role_table_grants where grantee = '${grantee}' and table_schema = 'public' and table_name = 'commission_changes' order by 1`,
          ],
          { encoding: "utf8" },
        )
          .split(/\r?\n/)
          .filter(Boolean);
      expect(read("authenticated")).toEqual(["INSERT", "SELECT", "UPDATE"]);
      expect(read("anon")).toEqual([]);
    } else {
      expect(process.env.CI, "SUPABASE_DB_URL is not set").toBeFalsy();
    }
    const still = await admin
      .from("commission_changes")
      .select("id")
      .eq("id", overdueId);
    expect(still.data).toHaveLength(1);
  });

  it("the shared trail takes the register's name", async () => {
    const ev = await a.client.from("register_events").insert({
      account_id: a.accountId,
      register: "commission_changes",
      row_id: overdueId,
      kind: "created",
      note: "",
    });
    expect(ev.error).toBeNull();
  });
});

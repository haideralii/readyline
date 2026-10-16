/**
 * REQ-024 Session A1 against a real Supabase stack (FR-1, FR-2, FR-5, SR-2,
 * Data; D-2416, D-2417, D-2423, D-2429, D-2430, D-2431, D-2438, D-2444,
 * D-2445; findings 142, 143, 144, 151, 152, 153, 175, 176, 182, 183, 184,
 * 211, 212, 215 and 241): the owner's rows with the new columns; the s 17
 * roles owner-only; the items table and its worker read; the ticks without
 * a key and the owner's `with check`; the worker's two views without `note`
 * and the empty direct select on their base tables; the three worker
 * functions with their refusals; `set_owner_worker_ref` with its five
 * refusals; the two status views re-created with the new columns on the
 * Sydney day; one `role_table_grants` line per table this session touches.
 * Skips without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Person = {
  userId: string;
  email: string;
  client: SupabaseClient;
  accountId: string;
};

async function signUp(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
  withAccount: boolean,
): Promise<Person> {
  const email = `onboarding-a1-${label}-${randomUUID()}@example.test`;
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
  let accountId = "";
  if (withAccount) {
    const rpc = await client.rpc("create_account", {
      p_trading_name: `Onboarding ${label}`,
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
  }
  return { userId: created.data.user.id, email, client, accountId };
}

const sql = (query: string): string[] =>
  execFileSync("psql", [process.env.SUPABASE_DB_URL!, "-tAc", query], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);

describe.skipIf(!enabled)("REQ-024 A1: worker onboarding data", () => {
  let admin: SupabaseClient;
  let env: ReturnType<typeof readSupabaseAdminEnv>;
  let owner: Person;
  let other: Person;
  let worker: Person;
  let checklistId: string;
  let itemId: string;
  let clearanceId: string;
  let firstAidId: string;

  beforeAll(async () => {
    env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    owner = await signUp(admin, env.url, env.publishableKey, "owner", true);
    other = await signUp(admin, env.url, env.publishableKey, "other", true);
    for (const t of [owner, other]) {
      const ent = await admin
        .from("entitlements")
        .insert({ account_id: t.accountId, kind: "subscription" });
      if (ent.error) throw ent.error;
    }
    // A worker of the owner's account: the membership an accepted invitation writes (REQ-020 Session B), written by the admin here.
    worker = await signUp(admin, env.url, env.publishableKey, "worker", false);
    const member = await admin.from("memberships").insert({
      user_id: worker.userId,
      account_id: owner.accountId,
      role: "worker",
      worker_ref: "W-7",
    });
    if (member.error) throw member.error;
  });

  afterAll(async () => {
    for (const p of [owner, other, worker])
      if (p?.userId)
        await admin.auth.admin.deleteUser(p.userId).catch(() => undefined);
  });

  it("FR-1: the owner inserts a worker row with the role, states, flags and the s 20 dates; the status view carries them (finding 176)", async () => {
    const ins = await owner.client
      .from("staff_matrix")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-7",
        role_label: "support worker",
        role: "support-worker",
        states: ["NSW", "VIC"],
        works_with_children: true,
        risk_assessed: true,
        risk_assessed_from: "2026-10-01",
        risk_paragraph: "b",
        note: "owner's note about the worker",
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    const view = await owner.client
      .from("staff_matrix_status")
      .select("role, states, ended_on, works_with_children, risk_paragraph")
      .eq("account_id", owner.accountId)
      .eq("worker_ref", "W-7")
      .single();
    expect(view.data).toMatchObject({
      role: "support-worker",
      states: ["NSW", "VIC"],
      ended_on: null,
      works_with_children: true,
      risk_paragraph: "b",
    });
    const badState = await owner.client.from("staff_matrix").insert({
      account_id: owner.accountId,
      worker_ref: "W-8",
      role_label: "support worker",
      states: ["XX"],
    });
    expect(badState.error?.code).toBe("23514");
  });

  it("D-2416: the s 17 roles are the owner's alone; a member of another account and the worker read none; the grants are per verb", async () => {
    const ins = await owner.client
      .from("risk_assessed_roles")
      .insert({
        account_id: owner.accountId,
        title: "Support worker",
        paragraphs: ["b", "c"],
        seed_code: "support-worker",
        first_held_on: "2026-10-13",
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    const dup = await owner.client.from("risk_assessed_roles").insert({
      account_id: owner.accountId,
      title: "Support worker again",
      seed_code: "support-worker",
    });
    expect(dup.error?.code).toBe("23505");
    const badParagraph = await owner.client.from("risk_assessed_roles").insert({
      account_id: owner.accountId,
      title: "Odd",
      paragraphs: ["d"],
    });
    expect(badParagraph.error?.code).toBe("23514");
    const asOther = await other.client
      .from("risk_assessed_roles")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(asOther.data).toEqual([]);
    const asWorker = await worker.client
      .from("risk_assessed_roles")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(asWorker.data).toEqual([]);
    const forged = await other.client
      .from("risk_assessed_roles")
      .insert({ account_id: owner.accountId, title: "Forged" });
    expect(forged.error?.code).toBe("42501");
  });

  it("FR-2: the items table takes the owner's rows, the ticks take two on one day, the owner's tick needs the caller as actor and a KP- or own code on a worker checklist (D-2430, D-2444)", async () => {
    const list = await owner.client
      .from("onboarding_checklists")
      .insert({
        account_id: owner.accountId,
        kind: "worker",
        subject_ref: "W-7",
        started_on: "2026-10-13",
      })
      .select("id")
      .single();
    expect(list.error).toBeNull();
    checklistId = list.data!.id as string;
    const items = await owner.client
      .from("onboarding_items")
      .insert([
        {
          account_id: owner.accountId,
          checklist_id: checklistId,
          item_id: "w1-clearance",
          owner_role: "owner",
        },
        {
          account_id: owner.accountId,
          checklist_id: checklistId,
          item_id: "w5-induction",
          owner_role: "both",
        },
      ])
      .select("id, item_id");
    expect(items.error).toBeNull();
    itemId = (items.data as { id: string; item_id: string }[]).find(
      (i) => i.item_id === "w5-induction",
    )!.id;
    const dupItem = await owner.client.from("onboarding_items").insert({
      account_id: owner.accountId,
      checklist_id: checklistId,
      item_id: "w1-clearance",
      owner_role: "owner",
    });
    expect(dupItem.error?.code).toBe("23505");
    const noDelete = await owner.client
      .from("onboarding_items")
      .delete()
      .eq("id", itemId);
    expect(noDelete.error?.code).toBe("42501");

    const tick = (over: Record<string, unknown> = {}) =>
      owner.client.from("onboarding_ticks").insert({
        checklist_id: checklistId,
        account_id: owner.accountId,
        item_id: "w5-induction",
        ticked_on: "2026-10-14",
        ticked_by_ref: "KP-1",
        actor_user_id: owner.userId,
        ...over,
      });
    expect((await tick()).error).toBeNull();
    // D-2430: no unique key; the same actor's second change on the same day is a second row.
    expect((await tick()).error).toBeNull();
    // D-2444: a forged actor, a null actor and a worker's code on a worker checklist are refused.
    expect((await tick({ actor_user_id: other.userId })).error?.code).toBe(
      "42501",
    );
    expect((await tick({ actor_user_id: null })).error?.code).toBe("42501");
    expect((await tick({ ticked_by_ref: "W-7" })).error?.code).toBe("42501");
    // A participant checklist's tick keeps the shape CHECK alone (finding 212).
    const pList = await owner.client
      .from("onboarding_checklists")
      .insert({
        account_id: owner.accountId,
        kind: "participant",
        subject_ref: "P-3",
        started_on: "2026-10-13",
      })
      .select("id")
      .single();
    expect(pList.error).toBeNull();
    const pTick = await owner.client.from("onboarding_ticks").insert({
      checklist_id: pList.data!.id,
      account_id: owner.accountId,
      item_id: "consent-recorded",
      ticked_on: "2026-10-14",
      ticked_by_ref: "W-003",
      actor_user_id: owner.userId,
    });
    expect(pTick.error).toBeNull();
  });

  it("FR-5: a pending clearance is a row with the application number and no issue date; the view reads pending first on the Sydney day (findings 142, 157, 215)", async () => {
    const pending = await owner.client
      .from("worker_clearances")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-7",
        role_label: "support worker",
        clearance_kind: "ndis-worker-screening",
        application_number: "APP 2026 0042",
        state: "NSW",
        note: "owner's note about the clearance",
      })
      .select("id")
      .single();
    expect(pending.error).toBeNull();
    clearanceId = pending.data!.id as string;
    const neither = await owner.client.from("worker_clearances").insert({
      account_id: owner.accountId,
      worker_ref: "W-7",
      role_label: "support worker",
      clearance_kind: "cpr",
    });
    expect(neither.error?.code).toBe("23514");
    const cpr = await owner.client
      .from("worker_clearances")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-7",
        role_label: "support worker",
        clearance_kind: "cpr",
        issued_on: "2027-01-10",
        // Well past the 90-day window whenever the suite runs, so the expiring count below is the first aid row alone (#82's run 38911618628 ran on 17 Oct 2026, 85 days before 10 Jan 2027).
        expires_on: "2031-01-10",
      })
      .select("id")
      .single();
    expect(cpr.error).toBeNull();
    firstAidId = cpr.data!.id as string;
    const licence = await owner.client.from("worker_clearances").insert({
      account_id: owner.accountId,
      worker_ref: "W-7",
      role_label: "support worker",
      clearance_kind: "driver-licence",
      issued_on: "2024-01-10",
      expires_on: "2029-01-10",
    });
    expect(licence.error).toBeNull();
    const view = await owner.client
      .from("worker_clearances_status")
      .select("status, application_number, verified_in_database_on")
      .eq("id", clearanceId)
      .single();
    expect(view.data).toEqual({
      status: "pending",
      application_number: "APP 2026 0042",
      verified_in_database_on: null,
    });
    // The two re-created views compute their day in Sydney (D-2445): a row expiring today reads expiring, not expired.
    const sydneyToday = sql(
      "select (now() at time zone 'Australia/Sydney')::date",
    )[0];
    const today = await owner.client
      .from("worker_clearances")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-7",
        role_label: "support worker",
        clearance_kind: "first-aid",
        issued_on: "2023-01-01",
        expires_on: sydneyToday,
      })
      .select("id")
      .single();
    expect(today.error).toBeNull();
    const todayView = await owner.client
      .from("worker_clearances_status")
      .select("status")
      .eq("id", today.data!.id)
      .single();
    expect(todayView.data?.status).toBe("expiring");
    const matrix = await owner.client
      .from("staff_matrix_status")
      .select("expiring_checks, expired_checks")
      .eq("account_id", owner.accountId)
      .eq("worker_ref", "W-7")
      .single();
    // The pending row counts in neither; the first aid expiring today counts as expiring.
    expect(matrix.data).toEqual({ expiring_checks: 1, expired_checks: 0 });
  });

  it("SR-2: the worker reads their own rows through the two views without `note`, nothing through the base tables, their items and ticks, and nothing of another worker (D-2429; findings 153 and 182)", async () => {
    const viaView = await worker.client
      .from("staff_matrix_worker")
      .select("*")
      .eq("account_id", owner.accountId);
    expect(viaView.data).toHaveLength(1);
    expect(viaView.data![0]).not.toHaveProperty("note");
    expect(viaView.data![0]).toMatchObject({
      worker_ref: "W-7",
      role: "support-worker",
    });
    const base = await worker.client
      .from("staff_matrix")
      .select("*")
      .eq("account_id", owner.accountId);
    expect(base.data).toEqual([]);
    const clearances = await worker.client
      .from("worker_clearances_worker")
      .select("*")
      .eq("account_id", owner.accountId);
    expect(clearances.data!.length).toBeGreaterThanOrEqual(3);
    for (const c of clearances.data!) expect(c).not.toHaveProperty("note");
    const baseClearances = await worker.client
      .from("worker_clearances")
      .select("*")
      .eq("account_id", owner.accountId);
    expect(baseClearances.data).toEqual([]);
    const items = await worker.client
      .from("onboarding_items")
      .select("item_id")
      .eq("checklist_id", checklistId);
    expect(items.data!.map((i) => i.item_id).sort()).toEqual([
      "w1-clearance",
      "w5-induction",
    ]);
    // Another worker's row: a second matrix row the worker never sees through the view.
    await admin.from("staff_matrix").insert({
      account_id: owner.accountId,
      worker_ref: "W-9",
      role_label: "team leader",
    });
    const again = await worker.client
      .from("staff_matrix_worker")
      .select("worker_ref")
      .eq("account_id", owner.accountId);
    expect(again.data!.map((r) => r.worker_ref)).toEqual(["W-7"]);
    // No worker write policy: a direct update matches nothing; a direct tick is refused (findings 104 and 152).
    const upd = await worker.client
      .from("onboarding_items")
      .update({ confirmed_on: "2026-10-14" })
      .eq("id", itemId)
      .select("id");
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]);
    const directTick = await worker.client.from("onboarding_ticks").insert({
      checklist_id: checklistId,
      account_id: owner.accountId,
      item_id: "w5-induction",
      ticked_on: "2026-10-14",
      ticked_by_ref: "W-7",
      actor_user_id: worker.userId,
    });
    expect(directTick.error?.code).toBe("42501");
  });

  it("D-2417: the three worker functions write the worker's fields alone and refuse everything else with 42501 (findings 144, 151, 155)", async () => {
    const done = await worker.client.rpc("worker_update_item", {
      p_item: itemId,
      p_done_on: "2026-10-14",
    });
    expect(done.error).toBeNull();
    const row = await admin
      .from("onboarding_items")
      .select("done_on, confirmed_on, recorded_by_owner")
      .eq("id", itemId)
      .single();
    expect(row.data).toEqual({
      done_on: "2026-10-14",
      confirmed_on: null,
      recorded_by_owner: false,
    });
    const ticks = await admin
      .from("onboarding_ticks")
      .select("ticked_by_ref, actor_user_id")
      .eq("checklist_id", checklistId)
      .eq("item_id", "w5-induction");
    expect(ticks.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticked_by_ref: "W-7",
          actor_user_id: worker.userId,
        }),
      ]),
    );
    // The same day again: a second row, no key (D-2430).
    expect(
      (
        await worker.client.rpc("worker_update_item", {
          p_item: itemId,
          p_done_on: "2026-10-14",
        })
      ).error,
    ).toBeNull();
    // Refusals: another account's member, the owner, a missing row.
    for (const client of [other.client, owner.client]) {
      const r = await client.rpc("worker_update_item", {
        p_item: itemId,
        p_done_on: "2026-10-14",
      });
      expect(r.error?.code).toBe("42501");
    }
    expect(
      (
        await worker.client.rpc("worker_update_item", {
          p_item: randomUUID(),
          p_done_on: "2026-10-14",
        })
      ).error?.code,
    ).toBe("42501");

    const numbers = await worker.client.rpc("worker_update_clearance", {
      p_clearance: clearanceId,
      p_application_number: "APP 2026 0042",
      p_clearance_number: "NWS 777",
      p_expires_on: "2031-10-14",
    });
    expect(numbers.error).toBeNull();
    const clearance = await admin
      .from("worker_clearances")
      .select(
        "clearance_number, expires_on, verified_in_database_on, issued_on",
      )
      .eq("id", clearanceId)
      .single();
    expect(clearance.data).toEqual({
      clearance_number: "NWS 777",
      expires_on: "2031-10-14",
      verified_in_database_on: null,
      issued_on: null,
    });
    // Finding 151: the first aid, CPR and other rows are the owner's alone.
    const cpr = await worker.client.rpc("worker_update_clearance", {
      p_clearance: firstAidId,
      p_application_number: null,
      p_clearance_number: null,
      p_expires_on: "2028-01-10",
    });
    expect(cpr.error?.code).toBe("42501");
    expect(
      (
        await owner.client.rpc("worker_update_clearance", {
          p_clearance: clearanceId,
          p_application_number: null,
          p_clearance_number: "X",
          p_expires_on: null,
        })
      ).error?.code,
    ).toBe("42501");

    expect((await worker.client.rpc("worker_notice_seen")).error).toBeNull();
    const seen = await admin
      .from("memberships")
      .select("notice_seen_at")
      .eq("user_id", worker.userId)
      .eq("account_id", owner.accountId)
      .single();
    expect(seen.data?.notice_seen_at).toBeTruthy();
    expect((await owner.client.rpc("worker_notice_seen")).error?.code).toBe(
      "42501",
    );
  });

  it("D-2431: set_owner_worker_ref links the owner's membership once and refuses a member, a worker, a shared code, an absent code and a re-point (finding 184)", async () => {
    // The owner's membership `create_account` wrote (role owner, the signing user); every row of the account is in the message when it is not there (#82's run 38911618628 read null here).
    const all = await admin
      .from("memberships")
      .select("id, user_id, role, worker_ref")
      .eq("account_id", owner.accountId);
    expect(all.error).toBeNull();
    const rows = (all.data ?? []) as {
      id: string;
      user_id: string;
      role: string;
      worker_ref: string | null;
    }[];
    const membership = rows.find(
      (m) => m.user_id === owner.userId && m.role === "owner",
    );
    expect(
      membership,
      `the owner's membership for ${owner.userId}: ${JSON.stringify(rows)}`,
    ).toBeDefined();
    const membershipId = membership!.id;
    // W-7 is the worker's code: shared, refused.
    expect(
      (
        await owner.client.rpc("set_owner_worker_ref", {
          p_membership: membershipId,
          p_ref: "W-7",
        })
      ).error?.code,
    ).toBe("42501");
    // No matrix row: refused.
    expect(
      (
        await owner.client.rpc("set_owner_worker_ref", {
          p_membership: membershipId,
          p_ref: "W-1",
        })
      ).error?.code,
    ).toBe("42501");
    await owner.client.from("staff_matrix").insert({
      account_id: owner.accountId,
      worker_ref: "W-1",
      role_label: "owner and support worker",
      role: "key-personnel",
    });
    // A member of another account and the worker: refused.
    for (const client of [other.client, worker.client])
      expect(
        (
          await client.rpc("set_owner_worker_ref", {
            p_membership: membershipId,
            p_ref: "W-1",
          })
        ).error?.code,
      ).toBe("42501");
    expect(
      (
        await owner.client.rpc("set_owner_worker_ref", {
          p_membership: membershipId,
          p_ref: "W-1",
        })
      ).error,
    ).toBeNull();
    const linked = await admin
      .from("memberships")
      .select("worker_ref")
      .eq("id", membershipId)
      .single();
    expect(linked.data?.worker_ref).toBe("W-1");
    // Never re-pointed.
    expect(
      (
        await owner.client.rpc("set_owner_worker_ref", {
          p_membership: membershipId,
          p_ref: "W-9",
        })
      ).error?.code,
    ).toBe("42501");
    // `memberships` holds no `update` for authenticated (A0's revoke), so the link is the function's alone.
    const direct = await owner.client
      .from("memberships")
      .update({ worker_ref: "W-9" })
      .eq("id", membershipId)
      .select("id");
    expect(direct.error?.code).toBe("42501");
  });

  it("D-2243 (finding 175): one role_table_grants line per table this session touches", () => {
    if (!process.env.SUPABASE_DB_URL) {
      expect(process.env.CI, "SUPABASE_DB_URL is not set").toBeFalsy();
      return;
    }
    const grants = (table: string) =>
      sql(
        `select privilege_type from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = '${table}' order by 1`,
      );
    expect(grants("risk_assessed_roles")).toEqual([
      "DELETE",
      "INSERT",
      "SELECT",
      "UPDATE",
    ]);
    expect(grants("onboarding_items")).toEqual(["INSERT", "SELECT", "UPDATE"]);
    expect(grants("staff_matrix_worker")).toEqual(["SELECT"]);
    expect(grants("worker_clearances_worker")).toEqual(["SELECT"]);
    expect(grants("memberships")).toEqual(["DELETE", "SELECT"]);
    // The ticks' unique key is gone (D-2430).
    expect(
      sql(
        "select count(*) from pg_constraint where conrelid = 'public.onboarding_ticks'::regclass and contype = 'u'",
      ),
    ).toEqual(["0"]);
  });
});

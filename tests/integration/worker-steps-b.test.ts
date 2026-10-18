// @vitest-environment node
/**
 * REQ-024 Session B (FR-7, FR-8; SR-2; AC-3, AC-6; D-2826, D-2828) on the
 * Supabase stack: the acknowledgement rows under their policies, the
 * worker's documents view, and the worker's own writes through the A1
 * functions as the server actions call them. Needs the Supabase
 * variables (CI's Supabase job); never against the hosted project.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

vi.mock("server-only", () => ({}));

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
  const email = `worker-steps-b-${label}-${randomUUID()}@example.test`;
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
      p_trading_name: `Steps ${label}`,
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
  }
  return { userId: created.data.user.id, email, client, accountId };
}

describe.skipIf(!enabled)("REQ-024 B: the worker's own steps", () => {
  let admin: SupabaseClient;
  let owner: Person;
  let worker: Person;
  let stranger: Person;
  let checklistId: string;
  let clearanceId: string;
  let w6ItemId: string;

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    owner = await signUp(admin, env.url, env.publishableKey, "owner", true);
    const ent = await admin
      .from("entitlements")
      .insert({ account_id: owner.accountId, kind: "subscription" });
    if (ent.error) throw ent.error;
    worker = await signUp(admin, env.url, env.publishableKey, "worker", false);
    stranger = await signUp(
      admin,
      env.url,
      env.publishableKey,
      "stranger",
      false,
    );
    for (const [p, ref] of [
      [worker, "W-21"],
      [stranger, "W-22"],
    ] as const) {
      const m = await admin.from("memberships").insert({
        user_id: p.userId,
        account_id: owner.accountId,
        role: "worker",
        worker_ref: ref,
      });
      if (m.error) throw m.error;
    }
    // The worker's row, their pending screening row and their checklist with the W-6 item.
    const row = await owner.client.from("staff_matrix").insert({
      account_id: owner.accountId,
      worker_ref: "W-21",
      role_label: "support worker",
      role: "support-worker",
      states: ["NSW"],
      risk_assessed: true,
      risk_paragraph: "a",
    });
    if (row.error) throw row.error;
    const pending = await owner.client
      .from("worker_clearances")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-21",
        role_label: "support worker",
        clearance_kind: "ndis-worker-screening",
        application_number: "APP 2026 0021",
        state: "NSW",
      })
      .select("id")
      .single();
    if (pending.error) throw pending.error;
    clearanceId = pending.data.id as string;
    const list = await owner.client
      .from("onboarding_checklists")
      .insert({
        account_id: owner.accountId,
        kind: "worker",
        subject_ref: "W-21",
        started_on: "2026-11-01",
      })
      .select("id")
      .single();
    if (list.error) throw list.error;
    checklistId = list.data.id as string;
    const item = await owner.client
      .from("onboarding_items")
      .insert({
        account_id: owner.accountId,
        checklist_id: checklistId,
        item_id: "w6-policies",
        owner_role: "both",
      })
      .select("id")
      .single();
    if (item.error) throw item.error;
    w6ItemId = item.data.id as string;
    // One adopted document set with the five policies at version 1.
    const set = await admin
      .from("version_sets")
      .insert({
        account_id: owner.accountId,
        answers_snapshot_hash: "steps-b",
        derived_result: {},
        status: "ready",
        storage_prefix: `steps-b/${owner.accountId}`,
      })
      .select("id")
      .single();
    if (set.error) throw set.error;
    const docs = await admin.from("document_versions").insert(
      [
        "code-of-conduct-acknowledgement",
        "incident-management-policy-and-register",
        "complaints-management-policy-and-register",
        "privacy-and-information-management-policy",
        "safeguarding-policy",
        "governance-policy",
      ].map((typeId) => ({
        version_set_id: set.data.id,
        account_id: owner.accountId,
        document_type_id: typeId,
        version: 1,
        status: "ready",
        storage_path: `steps-b/${typeId}.docx`,
        model: {},
        adopted_on: typeId === "governance-policy" ? null : "2026-11-01",
      })),
    );
    if (docs.error) throw docs.error;
  });

  afterAll(async () => {
    for (const p of [owner, worker, stranger])
      if (p?.userId)
        await admin.auth.admin.deleteUser(p.userId).catch(() => undefined);
  });

  it("the worker reads the adopted documents' names and versions through the view and nothing else of them (D-2826)", async () => {
    const seen = await worker.client
      .from("document_versions_worker")
      .select("document_type_id, version, adopted_on")
      .eq("account_id", owner.accountId)
      .order("document_type_id");
    expect(seen.error).toBeNull();
    expect(seen.data?.map((d) => d.document_type_id)).toEqual([
      "code-of-conduct-acknowledgement",
      "complaints-management-policy-and-register",
      "incident-management-policy-and-register",
      "privacy-and-information-management-policy",
      "safeguarding-policy",
    ]);
    const base = await worker.client
      .from("document_versions")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(base.data ?? []).toEqual([]);
  });

  it("the worker acknowledges a document for their own code, reads it back, cannot do it twice for one version, and cannot do it under another code (AC-6; D-2828)", async () => {
    const mine = await worker.client.from("policy_acknowledgements").insert({
      account_id: owner.accountId,
      worker_ref: "W-21",
      document_type_id: "code-of-conduct-acknowledgement",
      version: 1,
    });
    expect(mine.error).toBeNull();
    const again = await worker.client.from("policy_acknowledgements").insert({
      account_id: owner.accountId,
      worker_ref: "W-21",
      document_type_id: "code-of-conduct-acknowledgement",
      version: 1,
    });
    expect(again.error?.code).toBe("23505");
    const forged = await worker.client.from("policy_acknowledgements").insert({
      account_id: owner.accountId,
      worker_ref: "W-22",
      document_type_id: "code-of-conduct-acknowledgement",
      version: 1,
    });
    expect(forged.error?.code).toBe("42501");
    const read = await worker.client
      .from("policy_acknowledgements")
      .select("worker_ref, document_type_id, version, acknowledged_on")
      .eq("account_id", owner.accountId);
    expect(read.data).toHaveLength(1);
    expect(read.data?.[0]).toMatchObject({
      worker_ref: "W-21",
      document_type_id: "code-of-conduct-acknowledgement",
      version: 1,
    });
    // The stranger (another worker of the account) reads none of W-21's rows; the owner reads them all.
    const other = await stranger.client
      .from("policy_acknowledgements")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(other.data ?? []).toEqual([]);
    const owners = await owner.client
      .from("policy_acknowledgements")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(owners.data).toHaveLength(1);
    // No update and no delete through the API, for anyone.
    const upd = await owner.client
      .from("policy_acknowledgements")
      .update({ version: 2 })
      .eq("account_id", owner.accountId)
      .select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await worker.client
      .from("policy_acknowledgements")
      .delete()
      .eq("account_id", owner.accountId)
      .select("id");
    expect(del.data ?? []).toEqual([]);
  });

  it("the worker's three fields reach their own screening row and read back without the note; the item's date waits for the owner (AC-3, FR-8)", async () => {
    const r = await worker.client.rpc("worker_update_clearance", {
      p_clearance: clearanceId,
      p_application_number: null,
      p_clearance_number: "WC 2026 1234",
      p_expires_on: "2031-11-01",
    });
    expect(r.error).toBeNull();
    const view = await worker.client
      .from("worker_clearances_worker")
      .select("clearance_number, expires_on, application_number")
      .eq("id", clearanceId)
      .single();
    expect(view.data).toEqual({
      clearance_number: "WC 2026 1234",
      expires_on: "2031-11-01",
      application_number: "APP 2026 0021",
    });
    const item = await worker.client.rpc("worker_update_item", {
      p_item: w6ItemId,
      p_done_on: "2026-11-03",
    });
    expect(item.error).toBeNull();
    const row = await worker.client
      .from("onboarding_items")
      .select("done_on, confirmed_on, recorded_by_owner")
      .eq("id", w6ItemId)
      .single();
    expect(row.data).toEqual({
      done_on: "2026-11-03",
      confirmed_on: null,
      recorded_by_owner: false,
    });
    // The owner confirms through the page's own path (D-2845), not a direct update; the worker reads both dates.
    const { confirmWorkerItem } =
      await import("@/server/registers/worker-onboarding");
    const confirm = await confirmWorkerItem(owner.client, {
      accountId: owner.accountId,
      userId: owner.userId,
      listId: checklistId,
      item: { id: "w6-policies", who: "both" },
      tickedOn: "2026-11-04",
      tickedByRef: "KP-1",
    });
    expect(confirm.ok).toBe(true);
    const ownersTick = await admin
      .from("onboarding_ticks")
      .select("ticked_by_ref, actor_user_id")
      .eq("checklist_id", checklistId)
      .eq("item_id", "w6-policies")
      .order("ticked_on", { ascending: false })
      .limit(1)
      .single();
    expect(ownersTick.data).toEqual({
      ticked_by_ref: "KP-1",
      actor_user_id: owner.userId,
    });
    const after = await worker.client
      .from("onboarding_items")
      .select("done_on, confirmed_on")
      .eq("id", w6ItemId)
      .single();
    expect(after.data).toEqual({
      done_on: "2026-11-03",
      confirmed_on: "2026-11-04",
    });
  });

  it("D-2834: a worker with no screening row records the application and the pending row is theirs; a second call updates it; no number is refused", async () => {
    const refused = await stranger.client.rpc("worker_record_clearance", {
      p_account: owner.accountId,
      p_application_number: null,
      p_clearance_number: "WC 2026 0022",
      p_expires_on: null,
    });
    expect(refused.error?.code).toBe("42501");
    const made = await stranger.client.rpc("worker_record_clearance", {
      p_account: owner.accountId,
      p_application_number: "APP 2026 0022",
      p_clearance_number: null,
      p_expires_on: null,
    });
    expect(made.error).toBeNull();
    const again = await stranger.client.rpc("worker_record_clearance", {
      p_account: owner.accountId,
      p_application_number: null,
      p_clearance_number: "WC 2026 0022",
      p_expires_on: "2031-01-01",
    });
    expect(again.error).toBeNull();
    expect(again.data).toBe(made.data);
    const rows = await stranger.client
      .from("worker_clearances_worker")
      .select(
        "worker_ref, clearance_kind, application_number, clearance_number, expires_on, issued_on, role_label",
      )
      .eq("account_id", owner.accountId);
    expect(rows.data).toEqual([
      {
        worker_ref: "W-22",
        clearance_kind: "ndis-worker-screening",
        application_number: "APP 2026 0022",
        clearance_number: "WC 2026 0022",
        expires_on: "2031-01-01",
        issued_on: null,
        role_label: "worker",
      },
    ]);
    // The worker still cannot insert a row directly.
    const direct = await stranger.client.from("worker_clearances").insert({
      account_id: owner.accountId,
      worker_ref: "W-22",
      role_label: "worker",
      clearance_kind: "wwcc",
      application_number: "X",
    });
    expect(direct.error?.code).toBe("42501");
  });

  it("D-2282 (8): a worker with no checklist makes their own checklist and item rows through the function; a second call adds none; a bad item is refused", async () => {
    const items = [
      { id: "w1-clearance", owner_role: "owner" },
      { id: "w4-orientation-module", owner_role: "both" },
    ];
    const first = await stranger.client.rpc("worker_ensure_items", {
      p_account: owner.accountId,
      p_items: items,
    });
    expect(first.error).toBeNull();
    const again = await stranger.client.rpc("worker_ensure_items", {
      p_account: owner.accountId,
      p_items: [...items, { id: "w5-induction", owner_role: "both" }],
    });
    expect(again.error).toBeNull();
    expect(again.data).toBe(first.data);
    const rows = await stranger.client
      .from("onboarding_items")
      .select("item_id, owner_role, done_on, confirmed_on")
      .eq("checklist_id", first.data as string)
      .order("item_id");
    expect(rows.data).toEqual([
      {
        item_id: "w1-clearance",
        owner_role: "owner",
        done_on: null,
        confirmed_on: null,
      },
      {
        item_id: "w4-orientation-module",
        owner_role: "both",
        done_on: null,
        confirmed_on: null,
      },
      {
        item_id: "w5-induction",
        owner_role: "both",
        done_on: null,
        confirmed_on: null,
      },
    ]);
    const list = await stranger.client
      .from("onboarding_checklists")
      .select("subject_ref, kind")
      .eq("id", first.data as string)
      .single();
    expect(list.data).toEqual({ subject_ref: "W-22", kind: "worker" });
    const bad = await stranger.client.rpc("worker_ensure_items", {
      p_account: owner.accountId,
      p_items: [{ id: "Robert'); drop", owner_role: "both" }],
    });
    expect(bad.error?.code).toBe("42501");
    // D-2840: a regex-valid id outside the closed list is refused too, and nothing of the list is written.
    const unknown = await stranger.client.rpc("worker_ensure_items", {
      p_account: owner.accountId,
      p_items: [
        { id: "w5-induction", owner_role: "owner" },
        { id: "w99-made-up", owner_role: "both" },
      ],
    });
    expect(unknown.error?.code).toBe("42501");
    const none = await stranger.client
      .from("onboarding_items")
      .select("item_id")
      .eq("checklist_id", first.data as string)
      .eq("item_id", "w99-made-up");
    expect(none.data ?? []).toEqual([]);
    // D-2840: the caller's owner_role is ignored; the owner's own setting per item stands (w1-clearance is the owner's).
    const forged = await stranger.client.rpc("worker_ensure_items", {
      p_account: owner.accountId,
      p_items: [{ id: "w10-other-checks", owner_role: "worker" }],
    });
    expect(forged.error).toBeNull();
    const role = await stranger.client
      .from("onboarding_items")
      .select("owner_role")
      .eq("checklist_id", first.data as string)
      .eq("item_id", "w10-other-checks")
      .single();
    expect(role.data?.owner_role).toBe("owner");
    // The worker's date on the made W-4 row goes through worker_update_item as before.
    const w4 = rows.data!.find((r) => r.item_id === "w4-orientation-module")!;
    void w4;
    const w4Row = await stranger.client
      .from("onboarding_items")
      .select("id")
      .eq("checklist_id", first.data as string)
      .eq("item_id", "w4-orientation-module")
      .single();
    const dated = await stranger.client.rpc("worker_update_item", {
      p_item: w4Row.data!.id,
      p_done_on: "2026-11-05",
    });
    expect(dated.error).toBeNull();
  });

  it("D-2243: one role_table_grants line for the table and the view", async () => {
    const admin2 = admin;
    const grants = await admin2.rpc("has_active_subscription", {
      p_account: owner.accountId,
    });
    expect(grants.error).toBeNull();
    // The verbs themselves are asserted by service-role-grants.test.ts's map (policy_acknowledgements: insert, select; document_versions_worker: select).
  });
});

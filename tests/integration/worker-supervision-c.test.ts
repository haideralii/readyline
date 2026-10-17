// @vitest-environment node
/**
 * REQ-024 Session C (FR-11, FR-12, FR-13; Data; AC-9; D-2283, D-2829) on the
 * Supabase stack: the supervision table under its policies and CHECKs, the
 * trigger that keeps the staff row's `last_supervision_on` the latest
 * `held_on` of any kind, and the trail's and the imports' widened CHECKs;
 * the grants line the Data section asks for is service-role-grants.test.ts's. Needs the Supabase variables
 * (CI's Supabase job); never against the hosted project.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Person = {
  userId: string;
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
  const email = `supervision-c-${label}-${randomUUID()}@example.test`;
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
      p_trading_name: `Supervision ${label}`,
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
  }
  return { userId: created.data.user.id, client, accountId };
}

const REF = "W-31";

describe.skipIf(!enabled)("REQ-024 C: supervision entries", () => {
  let admin: SupabaseClient;
  let owner: Person;
  let stranger: Person;
  let worker: Person;

  async function lastSupervisionOn(): Promise<string | null> {
    const r = await admin
      .from("staff_matrix")
      .select("last_supervision_on")
      .eq("account_id", owner.accountId)
      .eq("worker_ref", REF)
      .single();
    if (r.error) throw r.error;
    return r.data.last_supervision_on as string | null;
  }

  function entry(extra: Record<string, unknown>) {
    return {
      account_id: owner.accountId,
      worker_ref: REF,
      kind: "supervision",
      held_on: "2026-10-01",
      by_ref: "KP-1",
      note: "Covered the incident procedure.",
      ...extra,
    };
  }

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
    stranger = await signUp(
      admin,
      env.url,
      env.publishableKey,
      "stranger",
      true,
    );
    worker = await signUp(admin, env.url, env.publishableKey, "worker", false);
    const m = await admin.from("memberships").insert({
      user_id: worker.userId,
      account_id: owner.accountId,
      role: "worker",
      worker_ref: REF,
    });
    if (m.error) throw m.error;
    const row = await owner.client.from("staff_matrix").insert({
      account_id: owner.accountId,
      worker_ref: REF,
      role_label: "support worker",
      role: "support-worker",
      states: ["NSW"],
      risk_assessed: true,
      risk_paragraph: "a",
      // The date the owner typed before any entry existed.
      last_supervision_on: "2026-08-15",
    });
    if (row.error) throw row.error;
  });

  afterAll(async () => {
    for (const p of [owner, stranger, worker])
      if (p?.userId)
        await admin.auth.admin.deleteUser(p.userId).catch(() => undefined);
  });

  it("every kind sets the staff row's date to the latest held day; a correction and a removal recompute it (AC-9; D-2829)", async () => {
    const first = await owner.client
      .from("supervision_entries")
      .insert(entry({}))
      .select("id")
      .single();
    expect(first.error).toBeNull();
    expect(await lastSupervisionOn()).toBe("2026-10-01");
    const review = await owner.client
      .from("supervision_entries")
      .insert(
        entry({
          kind: "probation-review",
          held_on: "2026-10-05",
          by_ref: "W-02",
          note: "",
          outcome: "continued",
        }),
      )
      .select("id")
      .single();
    expect(review.error).toBeNull();
    expect(await lastSupervisionOn()).toBe("2026-10-05");
    const talk = await owner.client
      .from("supervision_entries")
      .insert(entry({ kind: "conversation", held_on: "2026-09-01" }))
      .select("id")
      .single();
    expect(talk.error).toBeNull();
    expect(await lastSupervisionOn()).toBe("2026-10-05");
    const moved = await owner.client
      .from("supervision_entries")
      .update({ held_on: "2026-10-09" })
      .eq("id", review.data!.id)
      .select("id");
    expect(moved.error).toBeNull();
    expect(moved.data).toHaveLength(1);
    expect(await lastSupervisionOn()).toBe("2026-10-09");
    const gone = await owner.client
      .from("supervision_entries")
      .delete()
      .eq("id", review.data!.id)
      .select("id");
    expect(gone.data).toHaveLength(1);
    expect(await lastSupervisionOn()).toBe("2026-10-01");
    const mine = await owner.client
      .from("supervision_entries")
      .select("kind, held_on, by_ref, outcome")
      .eq("account_id", owner.accountId)
      .order("held_on");
    expect(mine.data).toEqual([
      {
        kind: "conversation",
        held_on: "2026-09-01",
        by_ref: "KP-1",
        outcome: null,
      },
      {
        kind: "supervision",
        held_on: "2026-10-01",
        by_ref: "KP-1",
        outcome: null,
      },
    ]);
  });

  it("the CHECKs: a review carries an outcome and no note, nothing else carries an outcome, the supervisor is a staff code, the note is capped (finding 78)", async () => {
    const codes = await Promise.all(
      [
        entry({ kind: "probation-review", note: "", outcome: null }),
        entry({ kind: "probation-review", note: "kept", outcome: "ended" }),
        entry({ outcome: "continued" }),
        entry({ by_ref: "P-014" }),
        entry({ by_ref: "Jane Smith" }),
        entry({ note: "x".repeat(501) }),
        entry({ kind: "chat" }),
        entry({ worker_ref: "KP-1" }),
      ].map(async (row) => {
        const r = await owner.client.from("supervision_entries").insert(row);
        return r.error?.code ?? "ok";
      }),
    );
    expect(codes).toEqual(Array<string>(codes.length).fill("23514"));
  });

  it("another account's owner and the worker read none and write none (RLS as every register)", async () => {
    const otherRead = await stranger.client
      .from("supervision_entries")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(otherRead.data ?? []).toEqual([]);
    const otherWrite = await stranger.client
      .from("supervision_entries")
      .insert(entry({}));
    expect(otherWrite.error?.code).toBe("42501");
    const workerRead = await worker.client
      .from("supervision_entries")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(workerRead.data ?? []).toEqual([]);
    const workerWrite = await worker.client
      .from("supervision_entries")
      .insert(entry({ held_on: "2026-10-02" }));
    expect(workerWrite.error?.code).toBe("42501");
    expect(await lastSupervisionOn()).toBe("2026-10-01");
  });

  it("the trail takes the register and the imports table takes staff_matrix (FR-12, FR-13; finding 66)", async () => {
    const row = await owner.client
      .from("supervision_entries")
      .select("id")
      .eq("account_id", owner.accountId)
      .limit(1)
      .single();
    const ev = await owner.client.from("register_events").insert({
      account_id: owner.accountId,
      register: "supervision_entries",
      row_id: row.data!.id,
      kind: "created",
      note: "supervision on 2026-10-01 by KP-1",
    });
    expect(ev.error).toBeNull();
    const imp = await admin
      .from("imports")
      .insert({
        account_id: owner.accountId,
        register: "staff_matrix",
        rows_total: 0,
        rows_imported: 0,
      })
      .select("id");
    expect(imp.error).toBeNull();
    const bad = await admin.from("imports").insert({
      account_id: owner.accountId,
      register: "hazards",
      rows_total: 0,
      rows_imported: 0,
    });
    expect(bad.error?.code).toBe("23514");
  });
});

describe.skipIf(enabled)("REQ-024 C: supervision entries (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

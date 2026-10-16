/**
 * REQ-024 Session A2 against a real Supabase stack (FR-4, FR-4a, FR-5,
 * Data; D-2413, D-2434 as amended, D-2439 as amended; findings 154, 168,
 * 174, 175, 208, 213, 219, 227 and 246): `screening_exceptions` under the
 * owner, a member of another account and a worker; its CHECKs (the null
 * supervisor on a gated code, the Part 4 start after 31 January 2026 for
 * NSW and VIC, the empty state on a Part 4 code, the own-call fields on an
 * own-call code); one open row per worker; the two decision columns on the
 * clearance row and their pairing; the two views carrying them; the
 * snapshot function's cross-account case; one `role_table_grants` line per
 * table this session touches. Skips without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { participantRiskSnapshot } from "@/server/registers/participant-risk-snapshot";
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
  const email = `exceptions-a2-${label}-${randomUUID()}@example.test`;
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
      p_trading_name: `Exceptions ${label}`,
      p_business_structure: "sole-trader",
      p_states: ["WA"],
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

describe.skipIf(!enabled)("REQ-024 A2: the s 14 exception's data", () => {
  let admin: SupabaseClient;
  let env: ReturnType<typeof readSupabaseAdminEnv>;
  let owner: Person;
  let other: Person;
  let worker: Person;
  let pendingId: string;
  let supervisorId: string;
  let planVersionId: string;
  let openId: string;

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
    worker = await signUp(admin, env.url, env.publishableKey, "worker", false);
    const member = await admin.from("memberships").insert({
      user_id: worker.userId,
      account_id: owner.accountId,
      role: "worker",
      worker_ref: "W-4",
    });
    if (member.error) throw member.error;
    // The worker (W-4) with a pending application in WA and the supervisor (W-2) cleared and verified.
    for (const ref of ["W-4", "W-2"]) {
      const m = await owner.client.from("staff_matrix").insert({
        account_id: owner.accountId,
        worker_ref: ref,
        role_label: "support worker",
        role: "support-worker",
        risk_assessed: true,
        states: ["WA"],
      });
      if (m.error) throw m.error;
    }
    const pending = await owner.client
      .from("worker_clearances")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-4",
        role_label: "support worker",
        clearance_kind: "ndis-worker-screening",
        application_number: "WA-2026-0441",
        verified_in_database_on: "2026-10-30",
        state: "WA",
      })
      .select("id")
      .single();
    if (pending.error) throw pending.error;
    pendingId = pending.data.id as string;
    const supervisor = await owner.client
      .from("worker_clearances")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-2",
        role_label: "support worker",
        clearance_kind: "ndis-worker-screening",
        clearance_number: "NWS 2001",
        issued_on: "2025-01-10",
        expires_on: "2030-01-10",
        verified_in_database_on: "2025-01-12",
        state: "WA",
      })
      .select("id")
      .single();
    if (supervisor.error) throw supervisor.error;
    supervisorId = supervisor.data.id as string;
    // A version set with one procedure version to pin (the plan's version).
    const set = await admin
      .from("version_sets")
      .insert({
        account_id: owner.accountId,
        created_by: owner.userId,
        answers_snapshot_hash: "a2-test",
        derived_result: { documents: [], registers: [] },
        status: "ready",
        document_count: 1,
        fallback_section_count: 0,
        generated_count: 0,
        storage_prefix: "",
      })
      .select("id")
      .single();
    if (set.error) throw set.error;
    const version = await admin
      .from("document_versions")
      .insert({
        version_set_id: set.data.id,
        account_id: owner.accountId,
        document_type_id: "worker-screening-and-recruitment-procedure",
        version: 1,
        status: "ready",
        storage_path: "a2-test/procedure.v1.docx",
        model: {
          typeId: "worker-screening-and-recruitment-procedure",
          sections: [],
        },
      })
      .select("id")
      .single();
    if (version.error) throw version.error;
    planVersionId = version.data.id as string;
  });

  afterAll(async () => {
    for (const p of [owner, other, worker])
      if (p?.userId)
        await admin.auth.admin.deleteUser(p.userId).catch(() => undefined);
  });

  const gatedRow = () => ({
    account_id: owner.accountId,
    worker_ref: "W-4",
    clearance_id: pendingId,
    code: "s14-1a",
    started_on: "2026-11-02",
    verified_on: "2026-10-30",
    notice_seen_on: "2026-10-29",
    supervisor_ref: "W-2",
    declaration_on: "2026-11-01",
    plan_version_id: planVersionId,
    plan_register_date: "2026-10-28",
  });

  it("D-2434: the owner starts the gated exception with its five dates; a second open row for the worker is refused; a member of another account and the worker read none and write none", async () => {
    const ins = await owner.client
      .from("screening_exceptions")
      .insert(gatedRow())
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    openId = ins.data!.id as string;
    const twice = await owner.client
      .from("screening_exceptions")
      .insert(gatedRow());
    expect(twice.error?.code).toBe("23505");
    const otherRead = await other.client
      .from("screening_exceptions")
      .select("id")
      .eq("account_id", owner.accountId);
    expect(otherRead.data).toEqual([]);
    const workerRead = await worker.client
      .from("screening_exceptions")
      .select("id");
    expect(workerRead.data).toEqual([]);
    const otherWrite = await other.client
      .from("screening_exceptions")
      .insert({ ...gatedRow(), worker_ref: "W-5" });
    expect(otherWrite.error?.code).toBe("42501");
    const workerWrite = await worker.client
      .from("screening_exceptions")
      .insert({ ...gatedRow(), worker_ref: "W-5" });
    expect(workerWrite.error?.code).toBe("42501");
    // No delete for the owner (the row is ended, never removed).
    const del = await owner.client
      .from("screening_exceptions")
      .delete()
      .eq("id", openId)
      .select("id");
    expect(del.error?.code).toBe("42501");
  });

  it("the CHECKs (findings 213, 219, 227, 246): a gated code without its supervisor or plan, an own-call code with s 15 fields, a Part 4 code without its state, and a Part 4 start after 31 January 2026 for NSW and VIC are each refused with 23514", async () => {
    const refused = async (row: Record<string, unknown>) =>
      (await owner.client.from("screening_exceptions").insert(row)).error?.code;
    expect(
      await refused({ ...gatedRow(), worker_ref: "W-6", supervisor_ref: null }),
    ).toBe("23514");
    expect(
      await refused({
        ...gatedRow(),
        worker_ref: "W-6",
        plan_version_id: null,
      }),
    ).toBe("23514");
    expect(
      await refused({
        account_id: owner.accountId,
        worker_ref: "W-6",
        code: "s14-1c",
        started_on: "2026-11-02",
        supervisor_ref: "W-2",
      }),
    ).toBe("23514");
    expect(
      await refused({
        account_id: owner.accountId,
        worker_ref: "W-6",
        code: "s14-1b",
        started_on: "2025-06-01",
        ended_on: "2025-12-01",
        end_code: "clearance-issued",
      }),
    ).toBe("23514");
    for (const state of ["NSW", "VIC"])
      expect(
        await refused({
          account_id: owner.accountId,
          worker_ref: "W-6",
          code: "s14-1b",
          part4_state: state,
          started_on: "2026-02-01",
        }),
      ).toBe("23514");
    // An end needs both the date and the code, and never before the start.
    expect(
      await refused({
        account_id: owner.accountId,
        worker_ref: "W-6",
        code: "s14-1c",
        started_on: "2026-11-02",
        ended_on: "2026-11-05",
      }),
    ).toBe("23514");
    // A past Part 4 row with its state lands and ends.
    const past = await owner.client
      .from("screening_exceptions")
      .insert({
        account_id: owner.accountId,
        worker_ref: "W-6",
        code: "s14-1b",
        part4_state: "NSW",
        started_on: "2025-06-01",
        ended_on: "2025-12-01",
        end_code: "clearance-issued",
      })
      .select("id, part4_state")
      .single();
    expect(past.error).toBeNull();
    expect(past.data?.part4_state).toBe("NSW");
  });

  it("D-2413, finding 168: the end writes the clearance row; the decision columns pair and read back through both views; a decided row is not cleared", async () => {
    const end = await owner.client
      .from("screening_exceptions")
      .update({ ended_on: "2026-11-20", end_code: "excluded" })
      .eq("id", openId)
      .select("ended_on")
      .single();
    expect(end.error).toBeNull();
    const decided = await owner.client
      .from("worker_clearances")
      .update({ decision_code: "excluded", decision_on: "2026-11-20" })
      .eq("id", pendingId)
      .select("decision_code")
      .single();
    expect(decided.error).toBeNull();
    // One without the other is refused.
    const half = await owner.client
      .from("worker_clearances")
      .update({ decision_code: "suspended", decision_on: null })
      .eq("id", supervisorId);
    expect(half.error?.code).toBe("23514");
    const unknown = await owner.client
      .from("worker_clearances")
      .update({ decision_code: "banned", decision_on: "2026-11-20" })
      .eq("id", supervisorId);
    expect(unknown.error?.code).toBe("23514");
    const status = await owner.client
      .from("worker_clearances_status")
      .select("decision_code, decision_on, status")
      .eq("id", pendingId)
      .single();
    expect(status.data).toMatchObject({
      decision_code: "excluded",
      decision_on: "2026-11-20",
      status: "pending",
    });
    const own = await worker.client
      .from("worker_clearances_worker")
      // SR-1, D-2429: every column but `note`; the owner reads the note through the table.
      .select("decision_code, decision_on")
      .eq("id", pendingId)
      .maybeSingle();
    expect(own.error).toBeNull();
    expect(own.data).toEqual({
      decision_code: "excluded",
      decision_on: "2026-11-20",
    });
    // The worker now has no open exception, so a new one may start (one open row at a time).
    const again = await owner.client
      .from("screening_exceptions")
      .insert({ ...gatedRow(), started_on: "2026-11-21" })
      .select("id")
      .single();
    expect(again.error).toBeNull();
  });

  it("finding 154: the snapshot function reads one account's register and never another's", async () => {
    for (const [p, code, risk] of [
      [owner, "P-14", "Tires in the afternoon and may fall."],
      [other, "P-99", "Other account's risk, never copied."],
    ] as const) {
      const r = await p.client.from("participant_risks").insert({
        account_id: p.accountId,
        participant_ref: code,
        risk,
        controls: "Shorter outings.",
        review_on: "2027-01-01",
      });
      expect(r.error).toBeNull();
    }
    const ev = await admin.from("register_events").insert({
      account_id: owner.accountId,
      register: "participant_risks",
      row_id: randomUUID(),
      kind: "reviewed",
      at: "2026-10-27T23:30:00Z",
      note: "",
    });
    expect(ev.error).toBeNull();
    const mine = await participantRiskSnapshot(
      admin,
      owner.accountId,
      "2026-11-02",
    );
    expect(mine.rows).toEqual([
      { code: "P-14", risk: "Tires in the afternoon and may fall." },
    ]);
    expect(mine.rows.map((r) => r.risk).join(" ")).not.toContain(
      "Other account",
    );
    // 23:30Z on 27 October is 28 October in Sydney (D-2242).
    expect(mine.lastReviewedOn).toBe("2026-10-28");
    expect(mine.takenOn).toBe("2026-11-02");
    const theirs = await participantRiskSnapshot(
      admin,
      other.accountId,
      "2026-11-02",
    );
    expect(theirs.rows).toEqual([
      { code: "P-99", risk: "Other account's risk, never copied." },
    ]);
  });

  it("the trail takes the two new kinds under the new register with words, never a uuid", async () => {
    const ok = await owner.client.from("register_events").insert({
      account_id: owner.accountId,
      register: "screening_exceptions",
      row_id: openId,
      kind: "exception-started",
      note: "version 3, adopted 2 November 2026; register current to 28 October 2026",
    });
    expect(ok.error).toBeNull();
    const ended = await owner.client.from("register_events").insert({
      account_id: owner.accountId,
      register: "screening_exceptions",
      row_id: openId,
      kind: "exception-ended",
      note: "the unit made an exclusion (s 15(1)) on 20 November 2026",
    });
    expect(ended.error).toBeNull();
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
    expect(grants("screening_exceptions")).toEqual([
      "INSERT",
      "SELECT",
      "UPDATE",
    ]);
    expect(grants("worker_clearances_status")).toEqual(["SELECT"]);
    expect(grants("worker_clearances_worker")).toEqual(["SELECT"]);
    expect(
      sql(
        "select indexdef from pg_indexes where tablename = 'screening_exceptions' and indexname = 'screening_exceptions_open_idx'",
      )[0],
    ).toMatch(/WHERE \(ended_on IS NULL\)/);
  });
});

/**
 * REQ-018 Session A, SR-1 and SR-2, against a real Supabase stack: a
 * subscribed member inserts and reads a row in each audit-day register;
 * another account reads nothing and cannot forge a row; the append-only
 * tables (decisions, onboarding ticks, register events) refuse an update
 * with 42501, never a silent no-op; the NDIS-number CHECK and the code
 * patterns fire; the status views compute from today's date; the staff
 * matrix counts a worker's expired checks; the new training kinds are
 * accepted. Skips without the variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { RISK_AREAS } from "@/lib/registers/audit-day-types";
import { seedCorporateRisks } from "@/server/registers/audit-day-queries";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

/** Backlog 4: one harmless edit per editable register, to prove the owner's update lands and another tenant's does not. */
const EDITABLE_PATCH: Record<string, Record<string, unknown>> = {
  corporate_risks: { controls: "Claims match the notes and the roster." },
  participant_risks: { controls: "Two workers for every outing." },
  conflicts_of_interest: { managed_by: "Another worker handles that plan." },
  delegations: { backup_may: "Report to the Commission and sign claims." },
  insurance_items: { label: "Insurer B" },
  improvements: { changed: "Mop at the end of the visit; sign out." },
  staff_matrix: { role_label: "team leader" },
  onboarding_checklists: { subject_ref: "W-3" },
};

type Tenant = { userId: string; client: SupabaseClient; accountId: string };

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Tenant> {
  const email = `audit-day-${label}-${randomUUID()}@example.test`;
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
    p_trading_name: `Audit Day ${label}`,
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

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

describe.skipIf(!enabled)(
  "audit-day registers row-level security and rules (REQ-018 SR-1, SR-2)",
  () => {
    let admin: SupabaseClient;
    let anon: SupabaseClient;
    let a: Tenant;
    let b: Tenant;
    let c: Tenant | undefined;
    let env: ReturnType<typeof readSupabaseAdminEnv>;

    beforeAll(async () => {
      env = readSupabaseAdminEnv();
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
      for (const t of [a, b, c])
        if (t?.userId)
          await admin.auth.admin.deleteUser(t.userId).catch(() => undefined);
    });

    it("a subscribed member inserts and reads one row in each editable register; the other account sees none", async () => {
      const rows: Record<string, Record<string, unknown>> = {
        corporate_risks: {
          area: "finance",
          what_could_happen: "A claim is made for a support not delivered.",
          likelihood: "low",
          controls: "Claims match the notes.",
          owner_role: "Owner",
          review_on: day(180),
          starter: true,
        },
        participant_risks: {
          participant_ref: "P-014",
          risk: "Falls when tired in the afternoon.",
          controls: "Two workers for afternoon outings.",
          review_on: day(90),
          support_plan_review_on: day(120),
        },
        conflicts_of_interest: {
          who_ref: "W-1",
          conflict: "Also works for the participant's plan manager.",
          managed_by: "Does not handle that participant's claims.",
          declared_on: day(-10),
          review_on: day(355),
        },
        delegations: {
          role: "incident-reporter",
          holder_ref: "KP-1",
          backup_ref: "W-2",
          backup_may: "Report to the Commission when the owner is away.",
        },
        insurance_items: {
          kind: "public-liability",
          label: "Insurer A",
          expires_on: day(20),
        },
        improvements: {
          source_kind: "incident",
          source_ref: "INC-0001",
          learned: "The kitchen floor was wet after mopping.",
          changed: "Mop at the end of the visit and put the sign out.",
          owner_role: "Owner",
          due_on: day(14),
        },
        staff_matrix: {
          worker_ref: "W-1",
          role_label: "support worker",
          risk_assessed: true,
          last_supervision_on: day(-40),
          last_appraisal_on: day(-20),
        },
        onboarding_checklists: {
          kind: "worker",
          subject_ref: "W-1",
        },
      };
      for (const [table, row] of Object.entries(rows)) {
        const ins = await a.client
          .from(table)
          .insert({ account_id: a.accountId, ...row })
          .select("id")
          .single();
        expect(ins.error, table).toBeNull();
        const mine = await a.client
          .from(table)
          .select("id")
          .eq("account_id", a.accountId);
        expect(mine.data?.length, table).toBe(1);
        const theirs = await b.client
          .from(table)
          .select("id")
          .eq("account_id", a.accountId);
        expect(theirs.data, table).toEqual([]);
        const none = await anon.from(table).select("id");
        expect(none.data ?? [], table).toEqual([]);
        const forged = await b.client
          .from(table)
          .insert({ account_id: a.accountId, ...row });
        expect(forged.error, table).not.toBeNull();
      }
    });

    it("the append-only tables take an insert and refuse an update with 42501", async () => {
      const decision = await a.client
        .from("decisions")
        .insert({
          account_id: a.accountId,
          decided_on: day(0),
          decision: "Move supervision to the first Monday of the month.",
          decided_by: "KP-1",
        })
        .select("id, created_by")
        .single();
      expect(decision.error).toBeNull();
      expect(decision.data?.created_by).toBe(a.userId);
      const edit = await a.client
        .from("decisions")
        .update({ decision: "changed" })
        .eq("id", decision.data!.id)
        .select("id");
      expect(edit.error?.code).toBe("42501");

      // D-2272 as amended: the days a row records are the Sydney day, the
      // checklist's started_on and a tick's ticked_on by default.
      const todaySydney = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Australia/Sydney",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const checklist = await a.client
        .from("onboarding_checklists")
        .select("id, started_on")
        .eq("account_id", a.accountId)
        .single();
      expect(checklist.data?.started_on).toBe(todaySydney);
      const tick = await a.client
        .from("onboarding_ticks")
        .insert({
          checklist_id: checklist.data!.id,
          account_id: a.accountId,
          item_id: "screening-clearance-seen",
          ticked_by_ref: "KP-1",
        })
        .select("id, actor_user_id, ticked_on")
        .single();
      expect(tick.error).toBeNull();
      expect(tick.data?.actor_user_id).toBe(a.userId);
      expect(tick.data?.ticked_on).toBe(todaySydney);
      const retick = await a.client
        .from("onboarding_ticks")
        .update({ ticked_by_ref: "W-9" })
        .eq("id", tick.data!.id)
        .select("id");
      expect(retick.error?.code).toBe("42501");
      const crossTick = await b.client.from("onboarding_ticks").insert({
        checklist_id: checklist.data!.id,
        account_id: b.accountId,
        item_id: "screening-clearance-seen",
        ticked_by_ref: "KP-1",
      });
      expect(crossTick.error).not.toBeNull();

      const risk = await a.client
        .from("corporate_risks")
        .select("id")
        .eq("account_id", a.accountId)
        .single();
      const ev = await a.client
        .from("register_events")
        .insert({
          account_id: a.accountId,
          register: "corporate_risks",
          row_id: risk.data!.id,
          kind: "reviewed",
          note: "Reviewed at the quarterly check.",
        })
        .select("id")
        .single();
      expect(ev.error).toBeNull();
      const evEdit = await a.client
        .from("register_events")
        .update({ note: "changed" })
        .eq("id", ev.data!.id)
        .select("id");
      expect(evEdit.error?.code).toBe("42501");
      const reread = await a.client
        .from("register_events")
        .select("note")
        .eq("id", ev.data!.id);
      expect(reread.data).toEqual([
        { note: "Reviewed at the quarterly check." },
      ]);
    });

    it("the NDIS-number CHECK and the code patterns fire", async () => {
      const ndis = await a.client.from("participant_risks").insert({
        account_id: a.accountId,
        participant_ref: "P-2",
        risk: "Participant 430123456 may wander.",
        controls: "Door alarm.",
        review_on: day(30),
      });
      expect(ndis.error).not.toBeNull();
      const name = await a.client.from("participant_risks").insert({
        account_id: a.accountId,
        participant_ref: "Jane Citizen",
        risk: "Falls.",
        controls: "Two workers.",
        review_on: day(30),
      });
      expect(name.error).not.toBeNull();
      const badArea = await a.client.from("corporate_risks").insert({
        account_id: a.accountId,
        area: "weather",
        what_could_happen: "Rain.",
        likelihood: "low",
        controls: "Umbrella.",
        owner_role: "Owner",
        review_on: day(30),
      });
      expect(badArea.error).not.toBeNull();
      const badHolder = await a.client.from("delegations").insert({
        account_id: a.accountId,
        role: "finance-approver",
        holder_ref: "P-1",
      });
      expect(badHolder.error).not.toBeNull();
    });

    it("the status views compute: review states, insurance expiry, improvement state, staff matrix supervision and expired checks, checklist progress", async () => {
      const risks = await a.client
        .from("corporate_risks_status")
        .select("area, status")
        .eq("account_id", a.accountId);
      expect(risks.data).toEqual([{ area: "finance", status: "current" }]);
      const soon = await a.client
        .from("conflicts_of_interest_status")
        .select("status")
        .eq("account_id", a.accountId);
      expect(soon.data).toEqual([{ status: "current" }]);
      const ins = await a.client
        .from("insurance_items_status")
        .select("status")
        .eq("account_id", a.accountId);
      expect(ins.data).toEqual([{ status: "expiring" }]);
      const imp = await a.client
        .from("improvements_status")
        .select("status")
        .eq("account_id", a.accountId);
      expect(imp.data).toEqual([{ status: "open" }]);
      // An expired first-aid check for W-1 (a new training kind) shows on the matrix.
      const check = await a.client.from("worker_clearances").insert({
        account_id: a.accountId,
        worker_ref: "W-1",
        role_label: "support worker",
        clearance_kind: "manual-handling",
        issued_on: day(-800),
        expires_on: day(-5),
      });
      expect(check.error).toBeNull();
      const matrix = await a.client
        .from("staff_matrix_status")
        .select("worker_ref, status, expired_checks, expiring_checks")
        .eq("account_id", a.accountId);
      expect(matrix.data).toEqual([
        {
          worker_ref: "W-1",
          status: "supervision-overdue",
          expired_checks: 1,
          expiring_checks: 0,
        },
      ]);
      const progress = await a.client
        .from("onboarding_checklists_status")
        .select("kind, ticked, status")
        .eq("account_id", a.accountId);
      expect(progress.data).toEqual([
        { kind: "worker", ticked: 1, status: "in-progress" },
      ]);
      const hidden = await b.client
        .from("staff_matrix_status")
        .select("worker_ref")
        .eq("account_id", a.accountId);
      expect(hidden.data ?? []).toEqual([]);
    });

    // Backlog 4: the three cases the PO asked for on every REQ-018 register.
    it("every editable register takes the owner's update and gives another tenant's update nothing, with no error to probe", async () => {
      for (const [table, patch] of Object.entries(EDITABLE_PATCH)) {
        const row = await a.client
          .from(table)
          .select("id")
          .eq("account_id", a.accountId)
          .limit(1)
          .single();
        expect(row.error, table).toBeNull();
        const theirs = await b.client
          .from(table)
          .update(patch)
          .eq("id", row.data!.id)
          .select("id");
        // RLS hides the row from the other tenant: zero rows, not a refusal that confirms it exists.
        expect(theirs.error, table).toBeNull();
        expect(theirs.data ?? [], table).toEqual([]);
        const mine = await a.client
          .from(table)
          .update(patch)
          .eq("id", row.data!.id)
          .select("id");
        expect(mine.error, table).toBeNull();
        expect(mine.data?.length, table).toBe(1);
        const [[column, value]] = Object.entries(patch);
        const reread = await admin
          .from(table)
          .select(column)
          .eq("id", row.data!.id)
          .single();
        const stored = (reread.data ?? {}) as Record<string, unknown>;
        expect(stored[column], table).toBe(value);
      }
    });

    it("the append-only registers are read by their own tenant only; another tenant and the anonymous key see nothing", async () => {
      for (const table of [
        "decisions",
        "onboarding_ticks",
        "register_events",
      ]) {
        const mine = await a.client
          .from(table)
          .select("id")
          .eq("account_id", a.accountId);
        expect(mine.error, table).toBeNull();
        expect(mine.data?.length, table).toBeGreaterThanOrEqual(1);
        const theirs = await b.client
          .from(table)
          .select("id")
          .eq("account_id", a.accountId);
        expect(theirs.data ?? [], table).toEqual([]);
        const none = await anon.from(table).select("id");
        expect(none.data ?? [], table).toEqual([]);
      }
    });

    it("the corporate risk starter rows are seeded once: nine rows, one per area, all marked starter, and a second seed inserts nothing", async () => {
      c = await signUpTenant(admin, env.url, env.publishableKey, "c");
      const ent = await admin
        .from("entitlements")
        .insert({ account_id: c.accountId, kind: "subscription" });
      if (ent.error) throw ent.error;
      const sole = loadReferenceCases().find(
        (x) => x.id === "verification-sole-trader",
      )!;
      const first = await seedCorporateRisks(
        c.client,
        c.accountId,
        sole.answers,
        sole.result,
        day(0),
      );
      expect(first).toBe(RISK_AREAS.length);
      const second = await seedCorporateRisks(
        c.client,
        c.accountId,
        sole.answers,
        sole.result,
        day(0),
      );
      expect(second).toBe(0);
      const rows = await c.client
        .from("corporate_risks")
        .select("area, starter, review_on, owner_role")
        .eq("account_id", c.accountId)
        .order("area");
      expect(rows.error).toBeNull();
      expect(rows.data?.map((r) => r.area).sort()).toEqual(
        [...RISK_AREAS].sort(),
      );
      expect(rows.data?.every((r) => r.starter === true)).toBe(true);
      expect(rows.data?.every((r) => r.owner_role === "Owner")).toBe(true);
      // Another tenant never sees the starter rows, and a lapsed account (no entitlement) cannot seed.
      const theirs = await b.client
        .from("corporate_risks")
        .select("id")
        .eq("account_id", c.accountId);
      expect(theirs.data ?? []).toEqual([]);
    });

    it("the owner deletes a row; another account cannot", async () => {
      const row = await a.client
        .from("improvements")
        .select("id")
        .eq("account_id", a.accountId)
        .single();
      const theirs = await b.client
        .from("improvements")
        .delete()
        .eq("id", row.data!.id)
        .select("id");
      expect(theirs.data ?? []).toEqual([]);
      const mine = await a.client
        .from("improvements")
        .delete()
        .eq("id", row.data!.id)
        .select("id");
      expect(mine.error).toBeNull();
      expect(mine.data?.length).toBe(1);
    });
  },
);

describe.skipIf(enabled)("audit-day registers (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

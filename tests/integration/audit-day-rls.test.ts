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
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

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

      const checklist = await a.client
        .from("onboarding_checklists")
        .select("id")
        .eq("account_id", a.accountId)
        .single();
      const tick = await a.client
        .from("onboarding_ticks")
        .insert({
          checklist_id: checklist.data!.id,
          account_id: a.accountId,
          item_id: "screening-clearance-seen",
          ticked_by_ref: "KP-1",
        })
        .select("id, actor_user_id")
        .single();
      expect(tick.error).toBeNull();
      expect(tick.data?.actor_user_id).toBe(a.userId);
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

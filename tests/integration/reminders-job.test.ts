/**
 * REQ-009 AC-4 against a real Supabase stack: a forced run of the reminders
 * job on a seeded account produces exactly the expected rows, a second run
 * inserts nothing, and the email names registers and references only
 * (SR-4). Also `apply_stripe_subscription_event`: grant, past_due keeps,
 * canceled revokes, active again re-grants, replay is a duplicate, and the
 * function is closed to the publishable key. Skips without the variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LogOnlyEmailProvider } from "@/server/email/provider";
import { runRemindersJob } from "@/server/registers/reminders-job";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";
import { addDays } from "@/lib/registers/status";
import { addMonths } from "@/lib/registers/reminders";

const enabled = hasSupabaseEnv();
const TODAY = "2026-10-13";

describe.skipIf(!enabled)(
  "reminders job (REQ-009 AC-4) and the subscription ledger",
  () => {
    let admin: SupabaseClient;
    let anon: SupabaseClient;
    let userId: string;
    let accountId: string;
    let email: string;

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      anon = createClient(env.url, env.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      email = `reminders-${randomUUID()}@example.test`;
      const password = `Pw-${randomUUID()}`;
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw created.error ?? new Error("createUser failed");
      userId = created.data.user.id;
      const client = createClient(env.url, env.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await client.auth.signInWithPassword({ email, password });
      if (signed.error) throw signed.error;
      const rpc = await client.rpc("create_account", {
        p_trading_name: "Reminder Supports",
        p_business_structure: "sole-trader",
        p_states: ["NSW"],
        p_abn: null,
      });
      if (rpc.error) throw rpc.error;
      accountId = rpc.data as string;
      // Certification registered 12 months ago: a mid-term reminder today.
      const reg = await admin
        .from("accounts")
        .update({
          registration_date: addMonths(TODAY, -12),
          registration_kind: "certification",
        })
        .eq("id", accountId);
      if (reg.error) throw reg.error;
      const sub = await admin
        .from("entitlements")
        .insert({ account_id: accountId, kind: "subscription" });
      if (sub.error) throw sub.error;
      // A worker check expiring in 7 days, a policy review due in 14, a reportable incident whose notify_by
      // was yesterday, and a complaint received on Thursday 8 October still unacknowledged.
      const seeds = await Promise.all([
        admin.from("worker_clearances").insert({
          account_id: accountId,
          worker_ref: "W-1",
          role_label: "support worker",
          clearance_kind: "wwcc",
          issued_on: "2021-10-20",
          expires_on: addDays(TODAY, 7),
        }),
        admin.from("policy_reviews").insert({
          account_id: accountId,
          document_type_id: "complaints-management-policy-and-register",
          adopted_on: addMonths(addDays(TODAY, 14), -12),
        }),
        admin.from("incidents").insert({
          account_id: accountId,
          occurred_on: addDays(TODAY, -2),
          reported_on: addDays(TODAY, -2),
          category: "serious-injury",
          severity: "high",
          summary: "Fall in the kitchen.",
          reportable: true,
        }),
        admin.from("complaints").insert({
          account_id: accountId,
          received_on: "2026-10-08",
          channel: "phone",
          summary: "Late twice.",
        }),
      ]);
      for (const s of seeds) if (s.error) throw s.error;
      // REQ-020 FR-5 (AC-4): two unconfirmed reports. The first came in 13
      // hours ago and would be overdue to the Commission if it counted: the
      // job nudges the owner to confirm it and raises nothing else for it.
      // The second came in an hour ago: nothing yet.
      const hoursAgo = (h: number) =>
        new Date(Date.now() - h * 3_600_000).toISOString();
      for (const [awareAt, summary] of [
        [hoursAgo(13), "Reported through the link, still waiting."],
        [hoursAgo(1), "Reported through the link just now."],
      ]) {
        const draft = await admin.from("incidents").insert({
          account_id: accountId,
          occurred_on: addDays(TODAY, -2),
          reported_on: addDays(TODAY, -2),
          category: "serious-injury",
          severity: "high",
          summary,
          reportable: true,
          status: "draft",
          reported_via: "link",
          logged_by_ref: "support worker",
          aware_at: awareAt,
          aware_on: awareAt.slice(0, 10),
        });
        if (draft.error) throw draft.error;
      }
      // REQ-018 Session C (AC-3): one row per new reminder kind with a fixed date that fires today.
      const drill = await admin
        .from("accounts")
        .update({ last_emergency_drill_on: addMonths(TODAY, -6) })
        .eq("id", accountId);
      if (drill.error) throw drill.error;
      const auditDaySeeds = await Promise.all([
        admin.from("insurance_items").insert({
          account_id: accountId,
          kind: "public-liability",
          label: "Insurer A",
          expires_on: addDays(TODAY, 7),
        }),
        admin.from("staff_matrix").insert({
          account_id: accountId,
          worker_ref: "W-1",
          role_label: "support worker",
          last_supervision_on: addDays(TODAY, -31),
          last_appraisal_on: addDays(TODAY, -365),
        }),
        admin.from("participant_risks").insert({
          account_id: accountId,
          participant_ref: "P-1",
          risk: "Falls when tired.",
          controls: "Two workers in the afternoon.",
          review_on: addDays(TODAY, 90),
          support_plan_review_on: addDays(TODAY, 30),
        }),
        admin.from("conflicts_of_interest").insert({
          account_id: accountId,
          who_ref: "W-1",
          conflict: "Related to a participant's plan manager.",
          managed_by: "Does not handle that plan.",
          declared_on: addDays(TODAY, -100),
          review_on: addDays(TODAY, 14),
        }),
      ]);
      for (const s of auditDaySeeds) if (s.error) throw s.error;
    });

    afterAll(async () => {
      if (userId)
        await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    });

    it("a forced run inserts exactly the expected rows, emails them once, and a second run inserts nothing", async () => {
      const provider = new LogOnlyEmailProvider();
      // Batch 41: the other integration files seed accounts into the same
      // stack, and the job reports totals over every account it visits, so
      // both runs are scoped to this account and the row counts are read
      // back from the table for this account alone.
      const first = await runRemindersJob({
        admin,
        email: provider,
        today: TODAY,
        ownerEmail: async () => email,
        accountIds: [accountId],
      });
      expect(first.errors).toEqual([]);
      expect(first.accounts).toBe(1);
      const rows = await admin
        .from("reminders")
        .select("kind, subject_table, due_on, send_on, sent_at")
        .eq("account_id", accountId)
        .order("kind");
      const kinds = (rows.data ?? [])
        .map((r) => `${r.kind}@${r.send_on}`)
        .sort();
      expect(kinds).toEqual(
        [
          `clearance-expiry@${TODAY}`,
          `policy-review@${TODAY}`,
          `reportable-not-notified@${TODAY}`,
          "complaint-unacknowledged@2026-10-12",
          `mid-term-audit@${TODAY}`,
          // REQ-018 Session C (AC-3): the six new kinds, each from the fixed date seeded above.
          `insurance-expiry@${TODAY}`,
          `supervision-due@${TODAY}`,
          `appraisal-due@${TODAY}`,
          `support-plan-review@${TODAY}`,
          `register-review@${TODAY}`,
          `emergency-drill@${TODAY}`,
          // REQ-020 FR-5 (AC-4): the 13-hour-old report, and nothing for the one-hour-old one.
          `report-to-confirm@${TODAY}`,
        ].sort(),
      );
      expect(rows.data?.length).toBe(12);
      expect(first.inserted).toBe(12);
      expect(first.emailed).toBe(12);
      expect((rows.data ?? []).every((r) => r.sent_at)).toBe(true);
      // SR-4: the message names registers and references, never the summary text.
      const sent = provider.sent.find((m) => m.to === email);
      expect(sent?.text).toContain("W-1");
      expect(sent?.text).toContain("INC-0001");
      expect(sent?.text).toContain("CMP-0001");
      expect(sent?.text).not.toMatch(/kitchen|Late twice/);

      const sentBefore = provider.sent.filter((m) => m.to === email).length;
      const second = await runRemindersJob({
        admin,
        email: provider,
        today: TODAY,
        ownerEmail: async () => email,
        accountIds: [accountId],
      });
      expect(second.errors).toEqual([]);
      expect(second.inserted).toBe(0);
      expect(second.emailed).toBe(0);
      // The table and the outbox for this account, not the job's totals.
      const again = await admin
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);
      expect(again.count).toBe(12);
      expect(provider.sent.filter((m) => m.to === email).length).toBe(
        sentBefore,
      );
    });

    it("apply_stripe_subscription_event: grant, past_due keeps, canceled revokes, active re-grants, replay duplicates", async () => {
      const subId = `sub_test_${randomUUID().slice(0, 8)}`;
      const call = (over: Record<string, unknown>) =>
        admin.rpc("apply_stripe_subscription_event", {
          p_event_id: `evt_${randomUUID()}`,
          p_type: "customer.subscription.updated",
          p_subscription_id: subId,
          p_customer_id: "cus_test",
          p_account_id: accountId,
          p_status: "active",
          p_period_end: null,
          p_occurred_at: new Date().toISOString(),
          ...over,
        });
      const before = await admin
        .from("entitlements")
        .select("id")
        .eq("account_id", accountId)
        .eq("kind", "subscription")
        .is("revoked_at", null);
      const baseline = before.data?.length ?? 0;
      const grant = await call({
        p_type: "checkout.session.completed",
        p_status: null,
      });
      expect(grant.error).toBeNull();
      expect(grant.data).toBe("subscription_granted");
      const fixedId = `evt_${randomUUID()}`;
      const dup1 = await call({ p_event_id: fixedId });
      expect(dup1.data).toBe("subscription_updated");
      const dup2 = await call({ p_event_id: fixedId });
      expect(dup2.data).toBe("duplicate");
      const failed = await call({
        p_type: "invoice.payment_failed",
        p_status: null,
        p_account_id: null,
      });
      expect(failed.data).toBe("subscription_updated");
      const live = await admin
        .from("entitlements")
        .select("id")
        .eq("account_id", accountId)
        .eq("kind", "subscription")
        .is("revoked_at", null);
      expect(live.data?.length).toBe(baseline + 1);
      const canceled = await call({
        p_type: "customer.subscription.deleted",
        p_status: null,
        p_account_id: null,
      });
      expect(canceled.data).toBe("subscription_revoked");
      const after = await admin
        .from("entitlements")
        .select("id")
        .eq("account_id", accountId)
        .eq("kind", "subscription")
        .is("revoked_at", null);
      expect(after.data?.length).toBe(baseline);
      const renewed = await call({ p_status: "active", p_account_id: null });
      expect(renewed.data).toBe("subscription_granted");
      const row = await admin
        .from("subscriptions")
        .select("status, stripe_customer_id")
        .eq("stripe_subscription_id", subId)
        .single();
      expect(row.data).toEqual({
        status: "active",
        stripe_customer_id: "cus_test",
      });
      // Closed to the publishable key.
      const closed = await anon.rpc("apply_stripe_subscription_event", {
        p_event_id: `evt_${randomUUID()}`,
        p_type: "customer.subscription.deleted",
        p_subscription_id: subId,
        p_customer_id: null,
        p_account_id: null,
        p_status: null,
        p_period_end: null,
        p_occurred_at: new Date().toISOString(),
      });
      expect(closed.error).not.toBeNull();
    });
  },
);

describe.skipIf(enabled)("reminders job (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

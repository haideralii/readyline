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
    });

    afterAll(async () => {
      if (userId)
        await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    });

    it("a forced run inserts exactly the expected rows, emails them once, and a second run inserts nothing", async () => {
      const provider = new LogOnlyEmailProvider();
      const first = await runRemindersJob({
        admin,
        email: provider,
        today: TODAY,
        ownerEmail: async () => email,
      });
      expect(first.errors).toEqual([]);
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
        ].sort(),
      );
      expect(first.inserted).toBe(5);
      expect(first.emailed).toBe(5);
      expect((rows.data ?? []).every((r) => r.sent_at)).toBe(true);
      // SR-4: the message names registers and references, never the summary text.
      const sent = provider.sent.find((m) => m.to === email);
      expect(sent?.text).toContain("W-1");
      expect(sent?.text).toContain("INC-0001");
      expect(sent?.text).toContain("CMP-0001");
      expect(sent?.text).not.toMatch(/kitchen|Late twice/);

      const second = await runRemindersJob({
        admin,
        email: provider,
        today: TODAY,
        ownerEmail: async () => email,
      });
      expect(second.inserted).toBe(0);
      expect(second.emailed).toBe(0);
      const again = await admin
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);
      expect(again.count).toBe(5);
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

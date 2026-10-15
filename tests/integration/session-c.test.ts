/**
 * REQ-004 Session C integration tests against a real Supabase stack: export
 * contains only the owner's rows (AC-4), deletion hides the account at once
 * and the purge removes rows and the auth user after the retention period
 * (AC-5), audit writes are member-scoped, and platform_admin stays false for
 * ordinary users (AC-7 data side). Skips itself without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unzipSync } from "fflate";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAccountExport, buildExportZip } from "@/server/accounts/export";
import { runPurge } from "@/server/accounts/purge";
import type { EmailMessage, EmailProvider } from "@/server/email/provider";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

class FakeEmail implements EmailProvider {
  readonly name = "fake";
  readonly sent: EmailMessage[] = [];
  async send(m: EmailMessage) {
    this.sent.push(m);
  }
}

type Tenant = {
  email: string;
  userId: string;
  client: SupabaseClient;
  accountId: string;
};

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Tenant> {
  const email = `sc-${label}-${randomUUID()}@example.test`;
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
    p_trading_name: `Tenant ${label}`,
    p_business_structure: "sole-trader",
    p_states: ["NSW"],
    p_abn: null,
  });
  if (rpc.error) throw rpc.error;
  const accountId = rpc.data as string;
  const draft = await client.from("questionnaire_drafts").insert({
    account_id: accountId,
    answers: { owner: label },
    answers_version: 1,
    current_step: "business",
  });
  if (draft.error) throw draft.error;
  return { email, userId: created.data.user.id, client, accountId };
}

describe.skipIf(!enabled)(
  "session C: export, deletion, purge, audit (AC-4, AC-5, AC-7)",
  () => {
    let admin: SupabaseClient;
    let a: Tenant;
    let b: Tenant;

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      a = await signUpTenant(admin, env.url, env.publishableKey, "a");
      b = await signUpTenant(admin, env.url, env.publishableKey, "b");
    });

    afterAll(async () => {
      for (const t of [a, b]) {
        if (t?.userId)
          await admin.auth.admin.deleteUser(t.userId).catch(() => undefined);
      }
    });

    it("members can write audit rows only for their own account and as themselves", async () => {
      const own = await a.client.from("audit_log").insert({
        account_id: a.accountId,
        actor_user_id: a.userId,
        action: "test.own",
        target: null,
      });
      expect(own.error).toBeNull();
      const asOther = await a.client.from("audit_log").insert({
        account_id: a.accountId,
        actor_user_id: b.userId,
        action: "test.spoof",
        target: null,
      });
      expect(asOther.error).not.toBeNull();
      const otherAccount = await a.client.from("audit_log").insert({
        account_id: b.accountId,
        actor_user_id: a.userId,
        action: "test.cross",
        target: null,
      });
      expect(otherAccount.error).not.toBeNull();
    });

    it("export contains every row for the account and nothing from any other account (AC-4)", async () => {
      // Retro review of REQ-004 (15 Oct 2026, finding 32): the zip covers
      // every owner-readable table. A fact the owner wrote and a register row
      // for each tenant (written by the service role, so no subscription is
      // needed) prove the new tables are in and scoped.
      const fact = await a.client.from("account_facts").insert({
        account_id: a.accountId,
        key: "complaints-contact",
        value: "the owner",
      });
      expect(fact.error).toBeNull();
      const reviews = await admin
        .from("policy_reviews")
        .insert([
          {
            account_id: a.accountId,
            document_type_id: "other",
            title: "Review A",
          },
          {
            account_id: b.accountId,
            document_type_id: "other",
            title: "Review B",
          },
        ])
        .select("id, account_id");
      expect(reviews.error).toBeNull();
      const reviewA = reviews.data!.find((r) => r.account_id === a.accountId)!;
      const reviewB = reviews.data!.find((r) => r.account_id === b.accountId)!;

      const data = await buildAccountExport(a.client, a.accountId);
      expect(data).not.toBeNull();
      expect(data!.account.id).toBe(a.accountId);
      expect(data!.questionnaireDraft?.answers).toEqual({ owner: "a" });
      expect(data!.memberships.map((m) => m.user_id)).toEqual([a.userId]);
      expect(data!.auditLog.length).toBeGreaterThanOrEqual(2); // account.created + test.own
      for (const row of data!.auditLog)
        expect(row.actor_user_id).toBe(a.userId);
      expect(data!.tables.account_facts.map((r) => r.key)).toEqual([
        "complaints-contact",
      ]);
      expect(data!.tables.policy_reviews.map((r) => r.id)).toEqual([
        reviewA.id,
      ]);
      const json = JSON.stringify(data);
      expect(json).not.toContain(b.accountId);
      expect(json).not.toContain(b.userId);
      expect(json).not.toContain(reviewB.id);
      expect(json).not.toContain("token_hash");

      const zip = buildExportZip(data!);
      expect(zip.length).toBeGreaterThan(100);
      expect(Buffer.from(zip.slice(0, 2)).toString("binary")).toBe("PK");
      const files = Object.keys(unzipSync(zip));
      expect(files).toContain("account.json");
      expect(files).toContain("account_facts.json");
      expect(files).toContain("policy_reviews.json");
      expect(files).toContain("README.txt");

      const cross = await buildAccountExport(b.client, a.accountId);
      expect(cross).toBeNull();
    });

    it("ordinary users are not platform admins and cannot become one (AC-7)", async () => {
      const row = await a.client
        .from("users")
        .select("platform_admin")
        .eq("id", a.userId)
        .single();
      expect(row.data?.platform_admin).toBe(false);
    });

    it("delete_account hides the account at once and the purge removes it after the retention period (AC-5)", async () => {
      const email = new FakeEmail();
      const del = await b.client.rpc("delete_account");
      expect(del.error).toBeNull();
      expect(del.data).toBe(b.accountId);

      const visible = await b.client.from("accounts").select("id");
      expect(visible.data).toEqual([]);
      const draft = await b.client
        .from("questionnaire_drafts")
        .select("account_id");
      expect(draft.data).toEqual([]);
      const again = await b.client.rpc("delete_account");
      expect(again.error).not.toBeNull();
      const audit = await admin
        .from("audit_log")
        .select("action")
        .eq("account_id", b.accountId)
        .eq("action", "account.deleted");
      expect(audit.data?.length).toBe(1);

      const tooEarly = await runPurge({ admin, email, now: new Date() });
      expect(tooEarly.purged).toEqual([]);
      const later = new Date(Date.now() + 31 * 86_400_000);
      const dry = await runPurge({ admin, email, now: later, dryRun: true });
      expect(dry.purged.map((p) => p.accountId)).toContain(b.accountId);
      const stillThere = await admin
        .from("accounts")
        .select("id")
        .eq("id", b.accountId);
      expect(stillThere.data?.length).toBe(1);
      expect(email.sent).toEqual([]);

      const real = await runPurge({ admin, email, now: later });
      expect(real.errors).toEqual([]);
      expect(real.purged.map((p) => p.accountId)).toContain(b.accountId);
      const gone = await admin
        .from("accounts")
        .select("id")
        .eq("id", b.accountId);
      expect(gone.data).toEqual([]);
      const user = await admin.auth.admin.getUserById(b.userId);
      expect(user.data.user).toBeNull();
      expect(email.sent.map((m) => m.to)).toContain(b.email);
      expect(email.sent[0]?.text).toMatch(/permanently removed/);
      const purgedRow = await admin
        .from("audit_log")
        .select("action")
        .eq("target", b.accountId)
        .eq("action", "account.purged");
      expect(purgedRow.data?.length).toBe(1);

      const second = await runPurge({ admin, email, now: later });
      expect(second.purged.map((p) => p.accountId)).not.toContain(b.accountId);
      const untouched = await admin
        .from("accounts")
        .select("id")
        .eq("id", a.accountId);
      expect(untouched.data?.length).toBe(1);

      // Retro review of REQ-004 (15 Oct 2026, fix 40): a limiter row whose
      // window ended more than a day ago goes with the purge; a live one
      // stays, and a dry run only counts.
      const staleKey = `test:stale:${randomUUID()}`;
      const liveKey = `test:live:${randomUUID()}`;
      const seeded = await admin.from("auth_rate_limits").insert([
        {
          key: staleKey,
          window_start: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          count: 1,
        },
        { key: liveKey, window_start: new Date().toISOString(), count: 1 },
      ]);
      expect(seeded.error).toBeNull();
      const counted = await runPurge({
        admin,
        email,
        now: new Date(),
        dryRun: true,
      });
      expect(counted.rateLimitRowsRemoved).toBeGreaterThanOrEqual(1);
      const swept = await runPurge({ admin, email, now: new Date() });
      expect(swept.errors).toEqual([]);
      expect(swept.rateLimitRowsRemoved).toBeGreaterThanOrEqual(1);
      const keys = await admin
        .from("auth_rate_limits")
        .select("key")
        .in("key", [staleKey, liveKey]);
      expect(keys.data?.map((r) => r.key)).toEqual([liveKey]);
      await admin.from("auth_rate_limits").delete().eq("key", liveKey);

      // Retro review of REQ-004 (15 Oct 2026, finding 34): audit rows older
      // than two years go; a job-run row of the same age stays because the
      // launch page reads it; a recent row stays; a dry run only counts.
      const oldAt = new Date(Date.now() - 731 * 86_400_000).toISOString();
      const marker = `test.old.${randomUUID()}`;
      const jobMarker = `jobs.purge.ran`;
      const seededAudit = await admin
        .from("audit_log")
        .insert([
          {
            account_id: a.accountId,
            actor_user_id: a.userId,
            action: marker,
            target: "old",
            at: oldAt,
          },
          {
            account_id: null,
            actor_user_id: null,
            action: jobMarker,
            target: `test=${marker}`,
            at: oldAt,
          },
          {
            account_id: a.accountId,
            actor_user_id: a.userId,
            action: marker,
            target: "recent",
          },
        ])
        .select("id");
      expect(seededAudit.error).toBeNull();
      const countedAudit = await runPurge({
        admin,
        email,
        now: new Date(),
        dryRun: true,
      });
      expect(countedAudit.auditLogRowsRemoved).toBeGreaterThanOrEqual(1);
      const stillOld = await admin
        .from("audit_log")
        .select("target")
        .eq("action", marker);
      expect(stillOld.data?.map((r) => r.target).sort()).toEqual([
        "old",
        "recent",
      ]);
      const sweptAudit = await runPurge({ admin, email, now: new Date() });
      expect(sweptAudit.errors).toEqual([]);
      expect(sweptAudit.auditLogRowsRemoved).toBeGreaterThanOrEqual(1);
      const afterSweep = await admin
        .from("audit_log")
        .select("target")
        .eq("action", marker);
      expect(afterSweep.data?.map((r) => r.target)).toEqual(["recent"]);
      const jobRowKept = await admin
        .from("audit_log")
        .select("id")
        .eq("action", jobMarker)
        .eq("target", `test=${marker}`);
      expect(jobRowKept.data?.length).toBe(1);
      await admin
        .from("audit_log")
        .delete()
        .in(
          "id",
          seededAudit.data!.map((r) => r.id),
        );
    });
  },
);

describe.skipIf(enabled)("session C (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

// @vitest-environment node
/**
 * REQ-022 Session B (FR-5, FR-7, SR-6; D-2823): the reminder settings on
 * the Supabase stack. The row's RLS (a member reads, the owner updates,
 * nobody deletes, anon sees nothing); the job creates the row with the
 * token's hash and holds every reminder back once do_not_send is set; the
 * unsubscribe click sets it by the token, writes one audit line and is
 * idempotent; an unknown token is refused. Needs the Supabase variables
 * (CI's Supabase job); never against the hosted project.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  hashUnsubscribeToken,
  unsubscribeToken,
} from "@/lib/email/unsubscribe-token";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

vi.mock("server-only", () => ({}));

const enabled = hasSupabaseEnv();
const PEPPER = "integration-pepper";

type Person = {
  userId: string;
  email: string;
  client: SupabaseClient;
};

async function signUp(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Person> {
  const email = `reminder-settings-${label}-${randomUUID()}@example.test`;
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
  return { userId: created.data.user.id, email, client };
}

describe.skipIf(!enabled)("reminder settings (REQ-022 Session B)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let owner: Person;
  let stranger: Person;
  let accountId: string;

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    owner = await signUp(admin, env.url, env.publishableKey, "owner");
    stranger = await signUp(admin, env.url, env.publishableKey, "stranger");
    const rpc = await owner.client.rpc("create_account", {
      p_trading_name: "Reminder Settings Co",
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
  });

  afterAll(async () => {
    if (!admin) return;
    if (accountId) await admin.from("accounts").delete().eq("id", accountId);
    for (const p of [owner, stranger])
      if (p) await admin.auth.admin.deleteUser(p.userId);
  });

  it("the job's first use creates the row with the token's hash and nothing is held back", async () => {
    const { ensureReminderSettings } =
      await import("@/server/email/reminder-settings");
    const first = await ensureReminderSettings(admin, accountId, PEPPER);
    expect(first.doNotSend).toBe(false);
    expect(first.token).toBe(unsubscribeToken(accountId, PEPPER));
    const row = await admin
      .from("reminder_settings")
      .select("do_not_send, unsubscribe_token_hash")
      .eq("account_id", accountId)
      .single();
    expect(row.data).toEqual({
      do_not_send: false,
      unsubscribe_token_hash: hashUnsubscribeToken(first.token!),
    });
    // A pepper change writes the new hash on the next use.
    const second = await ensureReminderSettings(admin, accountId, "other");
    expect(second.token).not.toBe(first.token);
    const again = await admin
      .from("reminder_settings")
      .select("unsubscribe_token_hash")
      .eq("account_id", accountId)
      .single();
    expect(again.data?.unsubscribe_token_hash).toBe(
      hashUnsubscribeToken(second.token!),
    );
    await ensureReminderSettings(admin, accountId, PEPPER);
  });

  it("the owner reads and updates the row; a stranger and anon see nothing; nobody deletes", async () => {
    const mine = await owner.client
      .from("reminder_settings")
      .select("account_id, do_not_send")
      .eq("account_id", accountId);
    expect(mine.error).toBeNull();
    expect(mine.data).toHaveLength(1);
    const theirs = await stranger.client
      .from("reminder_settings")
      .select("account_id")
      .eq("account_id", accountId);
    expect(theirs.data).toEqual([]);
    const nobody = await anon
      .from("reminder_settings")
      .select("account_id")
      .eq("account_id", accountId);
    expect(nobody.data ?? []).toEqual([]);
    const up = await owner.client
      .from("reminder_settings")
      .update({
        do_not_send: true,
        do_not_send_reason: "unsubscribed",
        do_not_send_at: new Date().toISOString(),
      })
      .eq("account_id", accountId)
      .select("do_not_send");
    expect(up.error).toBeNull();
    expect(up.data?.[0]?.do_not_send).toBe(true);
    const back = await owner.client
      .from("reminder_settings")
      .update({
        do_not_send: false,
        do_not_send_reason: null,
        do_not_send_at: null,
      })
      .eq("account_id", accountId)
      .select("do_not_send");
    expect(back.data?.[0]?.do_not_send).toBe(false);
    const del = await owner.client
      .from("reminder_settings")
      .delete()
      .eq("account_id", accountId)
      .select("account_id");
    // No delete policy and no grant: nothing goes.
    expect(del.data ?? []).toEqual([]);
    const still = await admin
      .from("reminder_settings")
      .select("account_id")
      .eq("account_id", accountId);
    expect(still.data).toHaveLength(1);
  });

  it("the flag needs its reason and time (the CHECK), and the reason is one of three", async () => {
    const bare = await admin
      .from("reminder_settings")
      .update({ do_not_send: true })
      .eq("account_id", accountId);
    expect(bare.error).not.toBeNull();
    const odd = await admin
      .from("reminder_settings")
      .update({
        do_not_send: true,
        do_not_send_reason: "cancelled",
        do_not_send_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);
    expect(odd.error).not.toBeNull();
  });

  it("the unsubscribe click sets do_not_send by the token, audits once, is idempotent, and refuses an unknown token", async () => {
    const { unsubscribeByToken } =
      await import("@/server/email/reminder-settings");
    const token = unsubscribeToken(accountId, PEPPER);
    const unknown = await unsubscribeByToken(
      admin,
      hashUnsubscribeToken("not-a-token"),
    );
    expect(unknown.ok).toBe(false);
    const first = await unsubscribeByToken(admin, token);
    expect(first).toEqual({
      ok: true,
      accountId,
      tradingName: "Reminder Settings Co",
    });
    const row = await admin
      .from("reminder_settings")
      .select("do_not_send, do_not_send_reason, do_not_send_at")
      .eq("account_id", accountId)
      .single();
    expect(row.data?.do_not_send).toBe(true);
    expect(row.data?.do_not_send_reason).toBe("unsubscribed");
    expect(row.data?.do_not_send_at).not.toBeNull();
    const second = await unsubscribeByToken(admin, token);
    expect(second.ok).toBe(true);
    const audits = await admin
      .from("audit_log")
      .select("id")
      .eq("account_id", accountId)
      .eq("action", "reminders.unsubscribed");
    expect(audits.data).toHaveLength(1);
  });

  it("with do_not_send set the job holds every reminder back and emails nothing", async () => {
    const { runRemindersJob } =
      await import("@/server/registers/reminders-job");
    const { LogOnlyEmailProvider } = await import("@/server/email/provider");
    // A policy adopted a year ago on a 12-month cycle is due today (next_review_on is generated), so the
    // job has rows to send: 60 and 14 days before and the day itself.
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const adopted = new Date(now);
    adopted.setUTCFullYear(adopted.getUTCFullYear() - 1);
    const pr = await admin.from("policy_reviews").insert({
      account_id: accountId,
      document_type_id: "complaints-policy",
      adopted_on: adopted.toISOString().slice(0, 10),
      review_cycle_months: 12,
    });
    if (pr.error) throw pr.error;
    const provider = new LogOnlyEmailProvider();
    const report = await runRemindersJob({
      admin,
      email: provider,
      today,
      ownerEmail: async () => owner.email,
      accountIds: [accountId],
    });
    expect(report.emailed).toBe(0);
    expect(report.suppressed).toBeGreaterThan(0);
    expect(provider.sent).toHaveLength(0);
    const unsent = await admin
      .from("reminders")
      .select("id, sent_at")
      .eq("account_id", accountId)
      .is("sent_at", null);
    expect((unsent.data ?? []).length).toBeGreaterThan(0);
  });
});

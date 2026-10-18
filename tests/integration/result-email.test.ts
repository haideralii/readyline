// @vitest-environment node
/**
 * REQ-031 AC-2, AC-4 (D-2881, D-2882): a real send of the result leaves one
 * audit line, `email.sent` with `result:<peppered hash>`, the owner's account
 * when the message carries it and null otherwise; no row and no line holds
 * the address. The SMTP provider over a recording transport, the provider's
 * own audit through the service role. Needs a Supabase stack.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deriveChecklist } from "@/lib/checklist/derive";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { emailHash } from "@/lib/peppered-hash";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

vi.mock("server-only", () => ({}));

const enabled = hasSupabaseEnv();
const PEPPER = "integration-pepper";

describe.skipIf(!enabled)(
  "the result email's audit line (REQ-031 AC-2, AC-4)",
  () => {
    let admin: SupabaseClient;
    let userId = "";
    let accountId = "";
    const sent: Record<string, unknown>[] = [];
    const address = `result-${randomUUID()}@example.test`;

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const email = `result-owner-${randomUUID()}@example.test`;
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
        p_trading_name: "Result Email Co",
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
      if (userId) await admin.auth.admin.deleteUser(userId);
    });

    it("a signed-in send writes email.sent with result:<hash> and the owner's account; a signed-out send writes null; neither holds the address", async () => {
      const { createEmailProvider } = await import("@/server/email/provider");
      const { resultEmail } = await import("@/server/email/templates");
      const dataset = getStandardsDataset();
      const c = loadReferenceCases()[0];
      const outcome = buildResult(dataset, c.answers);
      if (!outcome.ok) throw new Error(outcome.message);
      const transport = {
        sendMail: async (m: Record<string, unknown>) => {
          sent.push(m);
          return { messageId: "x" };
        },
      } as unknown as import("nodemailer").Transporter;
      const provider = createEmailProvider(
        {
          EMAIL_PROVIDER: "smtp",
          SMTP_HOST: "smtp.example.test",
          SMTP_PORT: "587",
          SMTP_USER: "u",
          SMTP_PASS: "p",
          EMAIL_FROM: "Readyline <no-reply@readyline.example>",
          HASH_PEPPER: PEPPER,
        },
        { transport },
      );
      const base = {
        result: outcome.result,
        checklistTotal: deriveChecklist(outcome.result, c.answers, dataset)
          .total,
        origin: "https://readyline.example",
        today: new Date(),
        contact: null,
      };
      await provider.send(
        resultEmail({ ...base, to: address, signedIn: true, accountId }),
      );
      await provider.send(
        resultEmail({ ...base, to: address, signedIn: false, accountId: null }),
      );
      expect(sent).toHaveLength(2);

      const expectedHash = emailHash(address, process.env.HASH_PEPPER ?? null);
      const rows = await admin
        .from("audit_log")
        .select("account_id, action, target")
        .eq("action", "email.sent")
        .like("target", "result:%")
        .order("at", { ascending: false })
        .limit(10);
      const ours = (
        (rows.data as { account_id: string | null; target: string }[] | null) ??
        []
      ).filter((r) => r.target === `result:${expectedHash}`);
      expect(ours.map((r) => r.account_id).sort()).toEqual(
        [accountId, null].sort(),
      );
      expect(JSON.stringify(rows.data)).not.toContain(address);
      // No row anywhere holds the address: the facts and the accounts tables are the only text stores a send could reach.
      const facts = await admin
        .from("account_facts")
        .select("value")
        .ilike("value", `%${address}%`);
      expect(facts.data ?? []).toEqual([]);
    });
  },
);

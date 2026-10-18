/**
 * REQ-033 against a real Supabase stack (FR-3, FR-5, SR-2, AC-4): a finding
 * row gets its FND reference and its CHECKs hold; a member of the account
 * reads it; another account sees nothing and cannot write to it; an
 * improvement row with the new "audit-finding" source is accepted and links
 * back. Skips without the variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

vi.mock("server-only", () => ({}));

const enabled = hasSupabaseEnv();

type Session = { userId: string; client: SupabaseClient };

async function signUp(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Session> {
  const email = `req-033-${label}-${randomUUID()}@example.test`;
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
  return { userId: created.data.user.id, client };
}

const finding = (accountId: string, over: Record<string, unknown> = {}) => ({
  account_id: accountId,
  standard_id: "core.governance.incident-management",
  indicator: "",
  severity: "minor",
  finding: "The incident register had no record of the Commission being told.",
  due_on: "2026-11-30",
  status: "open",
  ...over,
});

describe.skipIf(!enabled)("the findings register's rows (REQ-033)", () => {
  let admin: SupabaseClient;
  let owner: Session;
  let member: Session;
  let other: Session;
  let accountId = "";
  let otherAccountId = "";
  let findingId = "";

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    owner = await signUp(admin, env.url, env.publishableKey, "owner");
    const rpc = await owner.client.rpc("create_account", {
      p_trading_name: "Findings Supports",
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
    member = await signUp(admin, env.url, env.publishableKey, "member");
    const m = await admin.from("memberships").insert({
      user_id: member.userId,
      account_id: accountId,
      role: "member",
    });
    if (m.error) throw m.error;
    other = await signUp(admin, env.url, env.publishableKey, "other");
    const rpc2 = await other.client.rpc("create_account", {
      p_trading_name: "Other Supports",
      p_business_structure: "sole-trader",
      p_states: ["VIC"],
      p_abn: null,
    });
    if (rpc2.error) throw rpc2.error;
    otherAccountId = rpc2.data as string;
    for (const id of [accountId, otherAccountId]) {
      const ent = await admin
        .from("entitlements")
        .insert({ account_id: id, kind: "subscription" });
      if (ent.error) throw ent.error;
    }
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of [accountId, otherAccountId])
      if (id) await admin.from("accounts").delete().eq("id", id);
    for (const s of [owner, member, other])
      if (s) await admin.auth.admin.deleteUser(s.userId);
  });

  it("gives a finding its FND reference, keeps the CHECKs, and refuses an NDIS-number shape in the words", async () => {
    const ins = await owner.client
      .from("findings")
      .insert(finding(accountId))
      .select("id, reference, status, improvement_id")
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data).toMatchObject({
      reference: "FND-0001",
      status: "open",
      improvement_id: null,
    });
    findingId = ins.data!.id as string;
    const bad = await owner.client
      .from("findings")
      .insert(finding(accountId, { severity: "critical" }));
    expect(bad.error?.code).toBe("23514");
    const number = await owner.client
      .from("findings")
      .insert(
        finding(accountId, { finding: "Participant 430123456 was named." }),
      );
    expect(number.error?.code).toBe("23514");
    const half = await owner.client
      .from("findings")
      .insert(finding(accountId, { status: "addressed" }));
    expect(half.error?.code).toBe("23514");
  });

  it("AC-4: a member of the account reads the row; another account sees nothing and cannot write to it", async () => {
    const asMember = await member.client
      .from("findings_status")
      .select("reference, state")
      .eq("account_id", accountId);
    expect(asMember.error).toBeNull();
    expect(asMember.data).toEqual([{ reference: "FND-0001", state: "open" }]);
    const asOther = await other.client
      .from("findings")
      .select("id")
      .eq("account_id", accountId);
    expect(asOther.data).toEqual([]);
    const otherUpdate = await other.client
      .from("findings")
      .update({ status: "addressed", addressed_on: "2026-10-02" })
      .eq("id", findingId)
      .select("id");
    expect(otherUpdate.data).toEqual([]);
    const otherInsert = await other.client
      .from("findings")
      .insert(finding(accountId));
    expect(otherInsert.error?.code).toBe("42501");
  });

  it("FR-5: an improvement row takes the audit-finding source and the finding links to it", async () => {
    const imp = await owner.client
      .from("improvements")
      .insert({
        account_id: accountId,
        source_kind: "audit-finding",
        source_ref: "FND-0001",
        learned: "The register had no notification record.",
        changed:
          "Corrective action for FND-0001: to be recorded here when it is done.",
        owner_role: "Owner",
        due_on: "2026-11-30",
      })
      .select("id")
      .single();
    expect(imp.error).toBeNull();
    const link = await owner.client
      .from("findings")
      .update({ improvement_id: imp.data!.id as string })
      .eq("id", findingId)
      .select("improvement_id")
      .single();
    expect(link.data?.improvement_id).toBe(imp.data!.id);
    const addressed = await owner.client
      .from("findings")
      .update({
        status: "addressed",
        addressed_on: "2026-10-02",
        addressed_by_role: "Owner",
      })
      .eq("id", findingId)
      .select("status")
      .single();
    expect(addressed.data?.status).toBe("addressed");
    const state = await owner.client
      .from("findings_status")
      .select("state")
      .eq("id", findingId)
      .single();
    expect(state.data?.state).toBe("addressed");
  });
});

/**
 * REQ-035 SR-3, AC-2, AC-5 against a real Supabase stack: a gap check's rows
 * carry only the list (type, title, counts, states, reasons); the owner
 * writes them, a member of the account reads them and cannot write, another
 * account sees nothing and cannot insert, update or delete; the CHECKs hold.
 * Skips without the variables.
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
  const email = `req-035-${label}-${randomUUID()}@example.test`;
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

const check = (accountId: string, over: Record<string, unknown> = {}) => ({
  account_id: accountId,
  document_type_id: "complaints-management-policy-and-register",
  title: "Complaints policy 2023",
  covered: 5,
  partly: 0,
  missing: 11,
  prompt_version: "gap-check-1",
  ...over,
});

describe.skipIf(!enabled)("the gap check's rows (REQ-035 SR-3, AC-5)", () => {
  let admin: SupabaseClient;
  let owner: Session;
  let member: Session;
  let other: Session;
  let accountId = "";
  let otherAccountId = "";
  let checkId = "";

  beforeAll(async () => {
    const env = readSupabaseAdminEnv();
    admin = createClient(env.url, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    owner = await signUp(admin, env.url, env.publishableKey, "owner");
    const rpc = await owner.client.rpc("create_account", {
      p_trading_name: "Gap Check Supports",
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
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of [accountId, otherAccountId])
      if (id) await admin.from("accounts").delete().eq("id", id);
    for (const s of [owner, member, other])
      if (s) await admin.auth.admin.deleteUser(s.userId);
  });

  it("the owner writes a check and its sections; the CHECKs refuse a bad state, an NDIS-number shape and an over-long title", async () => {
    const ins = await owner.client
      .from("gap_checks")
      .insert(check(accountId))
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    checkId = ins.data!.id as string;
    const sections = await owner.client.from("gap_check_sections").insert([
      {
        gap_check_id: checkId,
        account_id: accountId,
        section_id: "purpose",
        number: "3",
        heading: "Purpose",
        position: 0,
        state: "covered",
        reason: "The outline's Purpose section was found by its heading.",
        standard_ids: ["core.governance.feedback-and-complaints-management"],
        indicator_labels: [],
      },
      {
        gap_check_id: checkId,
        account_id: accountId,
        section_id: "procedure",
        number: "9",
        heading: "Complaints procedure",
        position: 1,
        state: "missing",
        reason:
          "The outline asks for this; your document does not say it in a way the check could find.",
        standard_ids: ["core.governance.feedback-and-complaints-management"],
        indicator_labels: [
          "Feedback and complaints management (Core module), indicator 2",
        ],
      },
    ]);
    expect(sections.error).toBeNull();
    const badState = await owner.client.from("gap_check_sections").insert({
      gap_check_id: checkId,
      account_id: accountId,
      section_id: "scope",
      heading: "Scope",
      position: 2,
      state: "passed",
      reason: "No.",
    });
    expect(badState.error?.code).toBe("23514");
    const number = await owner.client
      .from("gap_checks")
      .insert(check(accountId, { title: "Policy for 430123456" }));
    expect(number.error?.code).toBe("23514");
    const long = await owner.client
      .from("gap_checks")
      .insert(check(accountId, { title: "x".repeat(121) }));
    expect(long.error?.code).toBe("23514");
  });

  it("AC-5: a member reads the check and its sections and cannot write them; another account sees nothing and cannot insert, update or delete", async () => {
    const asMember = await member.client
      .from("gap_checks")
      .select("title, covered, partly, missing")
      .eq("account_id", accountId);
    expect(asMember.error).toBeNull();
    expect(asMember.data).toEqual([
      { title: "Complaints policy 2023", covered: 5, partly: 0, missing: 11 },
    ]);
    const memberSections = await member.client
      .from("gap_check_sections")
      .select("section_id, state")
      .eq("gap_check_id", checkId)
      .order("position");
    expect(memberSections.data).toEqual([
      { section_id: "purpose", state: "covered" },
      { section_id: "procedure", state: "missing" },
    ]);
    const memberInsert = await member.client
      .from("gap_checks")
      .insert(check(accountId, { title: "A member's try" }));
    expect(memberInsert.error?.code).toBe("42501");
    const memberSectionInsert = await member.client
      .from("gap_check_sections")
      .insert({
        gap_check_id: checkId,
        account_id: accountId,
        section_id: "scope",
        heading: "Scope",
        position: 5,
        state: "covered",
        reason: "A member's try.",
      });
    expect(memberSectionInsert.error?.code).toBe("42501");
    const asOther = await other.client
      .from("gap_checks")
      .select("id")
      .eq("account_id", accountId);
    expect(asOther.data).toEqual([]);
    const otherSections = await other.client
      .from("gap_check_sections")
      .select("id")
      .eq("account_id", accountId);
    expect(otherSections.data).toEqual([]);
    const otherInsert = await other.client
      .from("gap_checks")
      .insert(check(accountId));
    expect(otherInsert.error?.code).toBe("42501");
    const otherUpdate = await other.client
      .from("gap_checks")
      .update({ title: "Changed" })
      .eq("id", checkId)
      .select("id");
    expect(otherUpdate.data).toEqual([]);
    const otherSectionUpdate = await other.client
      .from("gap_check_sections")
      .update({ state: "covered" })
      .eq("gap_check_id", checkId)
      .select("id");
    expect(otherSectionUpdate.data).toEqual([]);
    const otherDelete = await other.client
      .from("gap_checks")
      .delete()
      .eq("id", checkId)
      .select("id");
    expect(otherDelete.data).toEqual([]);
    // Nothing edits a stored list, the owner included: no update grant.
    const ownerUpdate = await owner.client
      .from("gap_checks")
      .update({ title: "Changed" })
      .eq("id", checkId)
      .select("id");
    expect(ownerUpdate.error?.code).toBe("42501");
  });

  it("the owner removes a check and its sections go with it", async () => {
    const del = await owner.client
      .from("gap_checks")
      .delete()
      .eq("id", checkId)
      .select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    const left = await admin
      .from("gap_check_sections")
      .select("id")
      .eq("gap_check_id", checkId);
    expect(left.data).toEqual([]);
  });
});

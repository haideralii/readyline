/**
 * REQ-020 Session C against a real Supabase stack (FR-7, FR-8, FR-9,
 * FR-12, SR-3, SR-4): the hazard register under tenant RLS with its CHECKs
 * and status view; the shared trail taking an `imported` line for an
 * incident; an import row the owner marks undone and nobody deletes; a
 * self-check row that is append-only, and an improvement row with the
 * `self-check` source; a reminder may point at a hazard. Skips without
 * the variables.
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
  const email = `session-c-${label}-${randomUUID()}@example.test`;
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
    p_trading_name: `Session C ${label}`,
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

const hazard = (over: Record<string, unknown> = {}) => ({
  site_ref: "S-1",
  hazard: "Loose rail on the back step.",
  harm_to: "participant",
  likelihood: "medium",
  severity: "high",
  controls: "Rail fixed; checked monthly.",
  due_on: day(7),
  review_on: day(90),
  ...over,
});

describe.skipIf(!enabled)(
  "hazards, imports and self-checks (REQ-020 Session C)",
  () => {
    let admin: SupabaseClient;
    let anon: SupabaseClient;
    let a: Tenant;
    let b: Tenant;
    let hazardId = "";

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

    it("FR-7: a subscribed member adds a hazard and reads it with its review state; another account and the anonymous key see nothing and cannot forge one", async () => {
      const ins = await a.client
        .from("hazards")
        .insert({ account_id: a.accountId, ...hazard() })
        .select("id")
        .single();
      expect(ins.error).toBeNull();
      hazardId = ins.data!.id as string;
      const mine = await a.client
        .from("hazards_status")
        .select("site_ref, status, done_on")
        .eq("account_id", a.accountId);
      expect(mine.data).toEqual([
        { site_ref: "S-1", status: "current", done_on: null },
      ]);
      const theirs = await b.client
        .from("hazards")
        .select("id")
        .eq("account_id", a.accountId);
      expect(theirs.data ?? []).toEqual([]);
      const none = await anon.from("hazards_status").select("id");
      expect(none.data ?? []).toEqual([]);
      const forged = await b.client
        .from("hazards")
        .insert({ account_id: a.accountId, ...hazard() });
      expect(forged.error).not.toBeNull();
      const theirEdit = await b.client
        .from("hazards")
        .update({ controls: "changed" })
        .eq("id", hazardId)
        .select("id");
      expect(theirEdit.error).toBeNull();
      expect(theirEdit.data ?? []).toEqual([]);
      const myEdit = await a.client
        .from("hazards")
        .update({ done_on: day(0) })
        .eq("id", hazardId)
        .select("id");
      expect(myEdit.data?.length).toBe(1);
    });

    it("FR-7, SR-3: the CHECKs refuse an address-shaped site, an NDIS number in the text, and a harm target off the list; a past review date reads overdue", async () => {
      const address = await a.client.from("hazards").insert({
        account_id: a.accountId,
        ...hazard({ site_ref: "12 Smith St" }),
      });
      expect(address.error).not.toBeNull();
      const ndis = await a.client.from("hazards").insert({
        account_id: a.accountId,
        ...hazard({ hazard: "Participant 430123456 trips on the step." }),
      });
      expect(ndis.error).not.toBeNull();
      const harm = await a.client.from("hazards").insert({
        account_id: a.accountId,
        ...hazard({ harm_to: "neighbour" }),
      });
      expect(harm.error).not.toBeNull();
      const old = await a.client
        .from("hazards")
        .insert({
          account_id: a.accountId,
          ...hazard({ site_ref: "V-2", review_on: day(-1) }),
        })
        .select("id")
        .single();
      expect(old.error).toBeNull();
      const status = await a.client
        .from("hazards_status")
        .select("status")
        .eq("id", old.data!.id)
        .single();
      expect(status.data?.status).toBe("overdue");
      const gone = await a.client
        .from("hazards")
        .delete()
        .eq("id", old.data!.id)
        .select("id");
      expect(gone.data?.length).toBe(1);
    });

    it("FR-7: the shared trail takes a hazard's reviewed line and a reminder may point at a hazard", async () => {
      const ev = await a.client.from("register_events").insert({
        account_id: a.accountId,
        register: "hazards",
        row_id: hazardId,
        kind: "reviewed",
        note: "Checked at the quarterly walk.",
      });
      expect(ev.error).toBeNull();
      const rem = await admin
        .from("reminders")
        .insert({
          account_id: a.accountId,
          kind: "register-review",
          subject_table: "hazards",
          subject_id: hazardId,
          due_on: day(90),
          send_on: day(76),
        })
        .select("id")
        .single();
      expect(rem.error).toBeNull();
      const theirs = await b.client
        .from("reminders")
        .select("id")
        .eq("id", rem.data!.id);
      expect(theirs.data ?? []).toEqual([]);
    });

    it("FR-8, FR-12: an imported incident carries its `imported` line; the import row is read by its tenant, marked undone by the owner, never deleted, and another account cannot touch it", async () => {
      const inc = await a.client
        .from("incidents")
        .insert({
          account_id: a.accountId,
          occurred_on: day(-3),
          reported_on: day(-3),
          category: "near-miss",
          severity: "low",
          summary: "Wet floor by the back door.",
        })
        .select("id")
        .single();
      expect(inc.error).toBeNull();
      const line = await a.client.from("register_events").insert({
        account_id: a.accountId,
        register: "incidents",
        row_id: inc.data!.id,
        kind: "imported",
        note: "Imported from a spreadsheet",
      });
      expect(line.error).toBeNull();
      const badKind = await a.client.from("register_events").insert({
        account_id: a.accountId,
        register: "incidents",
        row_id: inc.data!.id,
        kind: "uploaded",
        note: "",
      });
      expect(badKind.error).not.toBeNull();
      const imp = await a.client
        .from("imports")
        .insert({
          account_id: a.accountId,
          register: "incidents",
          rows_total: 2,
          rows_imported: 1,
          row_ids: [inc.data!.id],
        })
        .select("id, created_by")
        .single();
      expect(imp.error).toBeNull();
      expect(imp.data?.created_by).toBe(a.userId);
      const theirs = await b.client
        .from("imports")
        .select("id")
        .eq("id", imp.data!.id);
      expect(theirs.data ?? []).toEqual([]);
      const theirUndo = await b.client
        .from("imports")
        .update({ undone_at: new Date().toISOString() })
        .eq("id", imp.data!.id)
        .select("id");
      expect(theirUndo.data ?? []).toEqual([]);
      const del = await a.client
        .from("imports")
        .delete()
        .eq("id", imp.data!.id)
        .select("id");
      expect(del.error?.code).toBe("42501");
      const undo = await a.client
        .from("imports")
        .update({ undone_at: new Date().toISOString() })
        .eq("id", imp.data!.id)
        .select("undone_at");
      expect(undo.error).toBeNull();
      expect(undo.data?.[0]?.undone_at).toBeTruthy();
      const tooMany = await a.client.from("imports").insert({
        account_id: a.accountId,
        register: "incidents",
        rows_total: 501,
        rows_imported: 0,
      });
      expect(tooMany.error).not.toBeNull();
      const forged = await b.client.from("imports").insert({
        account_id: a.accountId,
        register: "incidents",
        rows_total: 1,
        rows_imported: 1,
      });
      expect(forged.error).not.toBeNull();
    });

    it("FR-9: a self-check row is inserted with the answers, never updated (42501), read by its tenant alone; a finding is an improvement row with the self-check source", async () => {
      const walk = await a.client
        .from("self_checks")
        .insert({
          account_id: a.accountId,
          walked_on: day(0),
          walked_by_ref: "owner",
          findings: 1,
          answers: { incidents: { answer: "no", note: "" } },
        })
        .select("id, created_by")
        .single();
      expect(walk.error).toBeNull();
      expect(walk.data?.created_by).toBe(a.userId);
      const edit = await a.client
        .from("self_checks")
        .update({ findings: 0 })
        .eq("id", walk.data!.id)
        .select("id");
      expect(edit.error?.code).toBe("42501");
      const theirs = await b.client
        .from("self_checks")
        .select("id")
        .eq("account_id", a.accountId);
      expect(theirs.data ?? []).toEqual([]);
      const named = await a.client.from("self_checks").insert({
        account_id: a.accountId,
        walked_on: day(0),
        walked_by_ref: "Jane",
        findings: 0,
      });
      expect(named.error).not.toBeNull();
      const finding = await a.client
        .from("improvements")
        .insert({
          account_id: a.accountId,
          source_kind: "self-check",
          source_ref: `Check ${day(0)}`,
          learned: "Incidents register: the self-check answer was no.",
          changed:
            "To decide: what we change so the answer is yes next quarter.",
          owner_role: "Owner",
          due_on: day(30),
        })
        .select("id")
        .single();
      expect(finding.error).toBeNull();
      const open = await a.client
        .from("improvements_status")
        .select("status, source_kind")
        .eq("id", finding.data!.id)
        .single();
      expect(open.data).toEqual({ status: "open", source_kind: "self-check" });
    });
  },
);

describe.skipIf(enabled)("REQ-020 Session C (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

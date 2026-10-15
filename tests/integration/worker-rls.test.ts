/**
 * REQ-020 Session B against a real Supabase stack (AC-3, AC-4, SR-1, SR-2,
 * SR-3): an invitation is accepted only by the invited address and only
 * once; a worker inserts and reads their own incident and complaint rows
 * and nothing else (no other register, no documents, no invitations, no
 * links, no accounts); a report through the link is a draft with awareness
 * fixed at submission, counted by the status view as a draft, refused at
 * the eleventh; confirming it sets the notification clock from the later of
 * the occurred and aware dates; rejecting keeps it; a revoked link answers
 * nothing; removing the worker ends their access. Skips without the
 * Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emailHash } from "@/lib/peppered-hash";
import { hashAuditorToken } from "@/lib/registers/auditor-link";
import { addDays } from "@/lib/registers/status";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Person = {
  userId: string;
  email: string;
  client: SupabaseClient;
  accountId: string;
};

async function signUp(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
  withAccount: boolean,
): Promise<Person> {
  const email = `worker-rls-${label}-${randomUUID()}@example.test`;
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
  let accountId = "";
  if (withAccount) {
    const rpc = await client.rpc("create_account", {
      p_trading_name: `Tenant ${label}`,
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
  }
  return { userId: created.data.user.id, email, client, accountId };
}

// The invitation's email hash is the app's peppered hash (retro finding 34);
// the same function in the same process, so the stand-in pepper CI runs
// with matches on both sides.
const report = (over: Record<string, unknown> = {}) => ({
  p_occurred_on: "2026-10-01",
  p_category: "near-miss",
  p_severity: "low",
  p_participant_ref: "P-014",
  p_worker_ref: "",
  p_summary: "Near miss in the kitchen; no harm.",
  p_actions_taken: "",
  p_reporter: "support worker",
  ...over,
});

describe.skipIf(!enabled)(
  "the worker role and the report link (REQ-020 Session B)",
  () => {
    let admin: SupabaseClient;
    let anon: SupabaseClient;
    let owner: Person;
    let other: Person;
    let worker: Person;
    const inviteToken = `inv-${randomUUID()}`;
    const linkToken = `lnk-${randomUUID()}`;
    let workerIncidentId = "";
    const draftIds: string[] = [];

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      anon = createClient(env.url, env.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      owner = await signUp(admin, env.url, env.publishableKey, "owner", true);
      other = await signUp(admin, env.url, env.publishableKey, "other", true);
      worker = await signUp(
        admin,
        env.url,
        env.publishableKey,
        "worker",
        false,
      );
      for (const id of [owner.accountId, other.accountId]) {
        const ent = await admin
          .from("entitlements")
          .insert({ account_id: id, kind: "subscription" });
        if (ent.error) throw ent.error;
      }
    });

    afterAll(async () => {
      for (const p of [owner, other, worker])
        if (p?.userId)
          await admin.auth.admin.deleteUser(p.userId).catch(() => undefined);
    });

    it("the owner invites; only the invited address accepts, and only once (FR-4, SR-1, SR-5)", async () => {
      const ins = await owner.client
        .from("invitations")
        .insert({
          account_id: owner.accountId,
          email_hash: emailHash(worker.email),
          worker_ref: "W-003",
          token_hash: hashAuditorToken(inviteToken),
          expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        })
        .select("id, email_hash")
        .single();
      expect(ins.error).toBeNull();
      // Another owner cannot write an invitation into this account.
      const cross = await other.client.from("invitations").insert({
        account_id: owner.accountId,
        email_hash: emailHash(worker.email),
        worker_ref: "W-009",
        token_hash: hashAuditorToken(`x-${randomUUID()}`),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(cross.error).not.toBeNull();
      // The preview is the service key's alone.
      const previewAnon = await anon.rpc("invitation_preview", {
        p_token_hash: hashAuditorToken(inviteToken),
      });
      expect(previewAnon.error).not.toBeNull();
      const preview = await admin.rpc("invitation_preview", {
        p_token_hash: hashAuditorToken(inviteToken),
      });
      expect(preview.data).toEqual([
        { trading_name: "Tenant owner", worker_ref: "W-003" },
      ]);
      // Accepting is the service key's alone (retro finding 34): the server
      // action passes the session's user id and peppered email hash, so a
      // signed-in session cannot call it with a hash of its own choosing.
      const direct = await worker.client.rpc("accept_invitation", {
        p_token_hash: hashAuditorToken(inviteToken),
        p_user_id: worker.userId,
        p_email_hash: emailHash(worker.email),
      });
      expect(direct.error).not.toBeNull();
      // The wrong address: nothing, and no reason.
      const wrong = await admin.rpc("accept_invitation", {
        p_token_hash: hashAuditorToken(inviteToken),
        p_user_id: other.userId,
        p_email_hash: emailHash(other.email),
      });
      expect(wrong.error).toBeNull();
      expect(wrong.data).toBeNull();
      const accepted = await admin.rpc("accept_invitation", {
        p_token_hash: hashAuditorToken(inviteToken),
        p_user_id: worker.userId,
        p_email_hash: emailHash(worker.email),
      });
      expect(accepted.error).toBeNull();
      expect(accepted.data).toBe(owner.accountId);
      const again = await admin.rpc("accept_invitation", {
        p_token_hash: hashAuditorToken(inviteToken),
        p_user_id: worker.userId,
        p_email_hash: emailHash(worker.email),
      });
      expect(again.data).toBeNull();
      const membership = await worker.client
        .from("memberships")
        .select("account_id, role, worker_ref")
        .eq("user_id", worker.userId);
      expect(membership.data).toEqual([
        { account_id: owner.accountId, role: "worker", worker_ref: "W-003" },
      ]);
      // The invitation row itself stays the owner's: the worker reads none of them.
      const seen = await worker.client.from("invitations").select("id");
      expect(seen.data).toEqual([]);
      const audit = await admin
        .from("audit_log")
        .select("action")
        .eq("account_id", owner.accountId)
        .eq("action", "invitation.accepted");
      expect(audit.data?.length).toBe(1);
    });

    it("a worker logs their own rows and reads nothing else (AC-3, SR-2)", async () => {
      // The owner's own incident first; the worker must never see it.
      const own = await owner.client
        .from("incidents")
        .insert({
          account_id: owner.accountId,
          occurred_on: "2026-10-02",
          reported_on: "2026-10-02",
          category: "medication",
          severity: "low",
          summary: "Owner's own entry.",
        })
        .select("id")
        .single();
      expect(own.error).toBeNull();
      const refused = await worker.client.from("incidents").insert({
        account_id: owner.accountId,
        occurred_on: "2026-10-03",
        reported_on: "2026-10-03",
        category: "near-miss",
        severity: "low",
        summary: "A closed row from a worker.",
        reported_via: "worker",
        logged_by_ref: "W-003",
        created_by: worker.userId,
        status: "closed",
        closed_on: "2026-10-03",
      });
      expect(refused.error).not.toBeNull();
      const ins = await worker.client
        .from("incidents")
        .insert({
          account_id: owner.accountId,
          occurred_on: "2026-10-03",
          reported_on: "2026-10-03",
          category: "near-miss",
          severity: "low",
          participant_ref: "P-014",
          summary: "Logged by the worker.",
          reported_via: "worker",
          logged_by_ref: "W-003",
          created_by: worker.userId,
        })
        .select("id, reference, status, logged_by_ref")
        .single();
      expect(ins.error).toBeNull();
      expect(ins.data).toMatchObject({
        status: "open",
        logged_by_ref: "W-003",
      });
      workerIncidentId = ins.data!.id as string;
      const mine = await worker.client
        .from("incidents_status")
        .select("id, notification_status")
        .eq("account_id", owner.accountId);
      expect(mine.data).toEqual([
        { id: workerIncidentId, notification_status: "open" },
      ]);
      const note = await worker.client.from("incident_events").insert({
        incident_id: workerIncidentId,
        account_id: owner.accountId,
        kind: "note",
        note: "Told the team leader.",
      });
      expect(note.error).toBeNull();
      // No update path: the owner owns the register.
      const up = await worker.client
        .from("incidents")
        .update({ summary: "Changed." })
        .eq("id", workerIncidentId)
        .select("id");
      expect(up.data).toEqual([]);
      const complaint = await worker.client.from("complaints").insert({
        account_id: owner.accountId,
        received_on: "2026-10-03",
        channel: "phone",
        summary: "Complaint logged by the worker.",
        created_by: worker.userId,
      });
      expect(complaint.error).toBeNull();
      for (const table of [
        "worker_clearances",
        "policy_reviews",
        "invitations",
        "report_links",
        "auditor_links",
        "accounts",
        "documents",
        "entitlements",
      ]) {
        const r = await worker.client.from(table).select("id").limit(5);
        expect(r.data ?? [], table).toEqual([]);
      }
      // The owner sees who logged it.
      const seen = await owner.client
        .from("incidents")
        .select("reported_via, logged_by_ref, created_by")
        .eq("id", workerIncidentId)
        .single();
      expect(seen.data).toEqual({
        reported_via: "worker",
        logged_by_ref: "W-003",
        created_by: worker.userId,
      });
    });

    it("a report through the link is a draft with awareness fixed at submission; the eleventh is refused; confirming starts the clock (AC-4)", async () => {
      const link = await owner.client
        .from("report_links")
        .insert({
          account_id: owner.accountId,
          token_hash: hashAuditorToken(linkToken),
        })
        .select("id")
        .single();
      expect(link.error).toBeNull();
      const hash = hashAuditorToken(linkToken);
      // Signed-out and signed-in sessions cannot call the function; the service key does.
      const viaAnon = await anon.rpc("submit_incident_report", {
        p_token_hash: hash,
        ...report(),
      });
      expect(viaAnon.error).not.toBeNull();
      const viaWorker = await worker.client.rpc("submit_incident_report", {
        p_token_hash: hash,
        ...report(),
      });
      expect(viaWorker.error).not.toBeNull();
      const before = Date.now();
      for (let i = 0; i < 10; i += 1) {
        const r = await admin.rpc("submit_incident_report", {
          p_token_hash: hash,
          ...report({
            p_category: i === 0 ? "serious-injury" : "near-miss",
            p_summary: `Report ${i + 1} through the link.`,
          }),
        });
        expect(r.error, `report ${i + 1}`).toBeNull();
        draftIds.push((r.data as { incident_id: string }[])[0].incident_id);
      }
      const eleventh = await admin.rpc("submit_incident_report", {
        p_token_hash: hash,
        ...report(),
      });
      expect(eleventh.error?.code).toBe("P0003");
      const first = await admin
        .from("incidents_status")
        .select(
          "status, reported_via, logged_by_ref, aware_at, aware_on, notify_by, reportable, notification_status, created_by",
        )
        .eq("id", draftIds[0])
        .single();
      expect(first.data).toMatchObject({
        status: "draft",
        reported_via: "link",
        logged_by_ref: "support worker",
        notify_by: null,
        reportable: false,
        notification_status: "draft",
        created_by: null,
      });
      const awareAt = Date.parse(first.data!.aware_at as string);
      expect(awareAt).toBeGreaterThanOrEqual(before - 5_000);
      expect(awareAt).toBeLessThanOrEqual(Date.now() + 5_000);
      const events = await admin
        .from("incident_events")
        .select("kind, note")
        .eq("incident_id", draftIds[0]);
      expect(events.data).toEqual([
        {
          kind: "reported",
          note: "Reported through the report link by support worker",
        },
      ]);
      // The owner reads the draft (RLS) and confirms it: open, reportable, the clock from the aware date (the report said 1 October).
      const awareOn = first.data!.aware_on as string;
      const confirm = await owner.client
        .from("incidents")
        .update({
          status: "open",
          reported_on: awareOn,
          reportable: true,
        })
        .eq("id", draftIds[0])
        .eq("status", "draft")
        .select("status, notify_by, reported_on");
      expect(confirm.error).toBeNull();
      expect(confirm.data).toEqual([
        {
          status: "open",
          notify_by: addDays(awareOn, 1),
          reported_on: awareOn,
        },
      ]);
      // The old inline CHECK (reported_on >= occurred_on, auto-named incidents_check) is gone and the
      // new one lets a draft carry an earlier report date while an open row still may not (PR #62).
      const earlyOpen = await admin.from("incidents").insert({
        account_id: owner.accountId,
        occurred_on: "2026-10-05",
        reported_on: "2026-10-04",
        category: "near-miss",
        severity: "low",
        summary: "Typed with the dates the wrong way round.",
        status: "open",
      });
      expect(earlyOpen.error?.code).toBe("23514");
      const earlyDraft = await admin
        .from("incidents")
        .insert({
          account_id: owner.accountId,
          occurred_on: "2026-10-05",
          reported_on: "2026-10-04",
          category: "near-miss",
          severity: "low",
          summary: "A draft may carry the reporter's dates as given.",
          status: "draft",
          reported_via: "link",
          logged_by_ref: "casual worker",
        })
        .select("id")
        .single();
      expect(earlyDraft.error).toBeNull();
      await admin.from("incidents").delete().eq("id", earlyDraft.data!.id);
      // Finding 31: logged_by_ref is a worker code or one of the five roles, never a name.
      const named = await admin.from("incidents").insert({
        account_id: owner.accountId,
        occurred_on: "2026-10-05",
        reported_on: "2026-10-05",
        category: "near-miss",
        severity: "low",
        summary: "Logged under a name.",
        status: "draft",
        reported_via: "link",
        logged_by_ref: "jane smith",
      });
      expect(named.error?.code).toBe("23514"); // Nine drafts remain; the twelfth submission is accepted.
      const twelfth = await admin.rpc("submit_incident_report", {
        p_token_hash: hash,
        ...report(),
      });
      expect(twelfth.error).toBeNull();
      draftIds.push((twelfth.data as { incident_id: string }[])[0].incident_id);
      // Rejecting keeps the row, marked, with the reason.
      const reject = await owner.client
        .from("incidents")
        .update({
          status: "rejected",
          rejected_reason: "Logged twice; see INC-0003.",
        })
        .eq("id", draftIds[1])
        .select("status");
      expect(reject.data).toEqual([{ status: "rejected" }]);
      const rejectedView = await owner.client
        .from("incidents_status")
        .select("notification_status, rejected_reason")
        .eq("id", draftIds[1])
        .single();
      expect(rejectedView.data).toEqual({
        notification_status: "rejected",
        rejected_reason: "Logged twice; see INC-0003.",
      });
      // A participant number in the reason is refused by the CHECK (SR-3).
      const bad = await owner.client
        .from("incidents")
        .update({
          status: "rejected",
          rejected_reason: "Participant 430123456 again.",
        })
        .eq("id", draftIds[2]);
      expect(bad.error).not.toBeNull();
      // Another owner's session sees none of these drafts.
      const cross = await other.client
        .from("incidents")
        .select("id")
        .in("id", draftIds);
      expect(cross.data).toEqual([]);
      // Revoked: the function answers nothing, with its own code.
      const revoke = await owner.client
        .from("report_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", link.data!.id)
        .select("id");
      expect(revoke.data?.length).toBe(1);
      const dead = await admin.rpc("submit_incident_report", {
        p_token_hash: hash,
        ...report(),
      });
      expect(dead.error?.code).toBe("P0002");
      const lookup = await admin.rpc("report_link_lookup", {
        p_token_hash: hash,
      });
      expect(lookup.data).toEqual([]);
    });

    it("removing the worker ends their access; their rows stay (FR-4, FR-11)", async () => {
      const byWorker = await worker.client
        .from("memberships")
        .delete()
        .eq("account_id", owner.accountId)
        .eq("user_id", owner.userId)
        .select("user_id");
      expect(byWorker.data ?? []).toEqual([]);
      const removed = await owner.client
        .from("memberships")
        .delete()
        .eq("account_id", owner.accountId)
        .eq("user_id", worker.userId)
        .eq("role", "worker")
        .select("user_id");
      expect(removed.error).toBeNull();
      expect(removed.data).toEqual([{ user_id: worker.userId }]);
      const gone = await worker.client
        .from("incidents")
        .select("id")
        .eq("account_id", owner.accountId);
      expect(gone.data).toEqual([]);
      const refused = await worker.client.from("incidents").insert({
        account_id: owner.accountId,
        occurred_on: "2026-10-04",
        reported_on: "2026-10-04",
        category: "near-miss",
        severity: "low",
        summary: "After removal.",
        reported_via: "worker",
        created_by: worker.userId,
      });
      expect(refused.error).not.toBeNull();
      const kept = await owner.client
        .from("incidents")
        .select("logged_by_ref")
        .eq("id", workerIncidentId)
        .single();
      expect(kept.data).toEqual({ logged_by_ref: "W-003" });
    });
  },
);

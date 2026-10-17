/**
 * REQ-009 AC-1 against a real Supabase stack: a subscribed member reads and
 * writes their own register rows; another account reads nothing; a lapsed
 * subscription can still read but not write (RLS, not the UI); the
 * NDIS-number CHECK fires on free text; references are per account and in
 * order, including under two concurrent inserts; `notify_by` follows the
 * category; the event tables are append-only; the status views compute;
 * the accounts registration columns take the two kinds and nothing else.
 * Skips without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CSV_COLUMNS } from "@/lib/registers/csv";
import { hasSupabaseEnv, readSupabaseAdminEnv } from "@/server/supabase/env";

const enabled = hasSupabaseEnv();

type Tenant = { userId: string; client: SupabaseClient; accountId: string };

async function signUpTenant(
  admin: SupabaseClient,
  url: string,
  key: string,
  label: string,
): Promise<Tenant> {
  const email = `registers-${label}-${randomUUID()}@example.test`;
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
  return {
    userId: created.data.user.id,
    client,
    accountId: rpc.data as string,
  };
}

async function subscribe(admin: SupabaseClient, accountId: string) {
  const ent = await admin
    .from("entitlements")
    .insert({ account_id: accountId, kind: "subscription" })
    .select("id")
    .single();
  if (ent.error) throw ent.error;
  return ent.data.id as string;
}

const incident = (accountId: string, extra: Record<string, unknown> = {}) => ({
  account_id: accountId,
  occurred_on: "2026-10-09",
  reported_on: "2026-10-09",
  category: "near-miss",
  severity: "low",
  participant_ref: "P-014",
  summary: "Near miss in the kitchen; no harm.",
  ...extra,
});

describe.skipIf(!enabled)(
  "registers row-level security and rules (REQ-009 AC-1)",
  () => {
    let admin: SupabaseClient;
    let anon: SupabaseClient;
    let a: Tenant;
    let b: Tenant;
    let aEntitlementId: string;

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
      aEntitlementId = await subscribe(admin, a.accountId);
      await subscribe(admin, b.accountId);
    });

    afterAll(async () => {
      for (const t of [a, b])
        if (t?.userId)
          await admin.auth.admin.deleteUser(t.userId).catch(() => undefined);
    });

    it("a subscribed member inserts, reads and updates their own incident; the reference is assigned", async () => {
      const ins = await a.client
        .from("incidents")
        .insert(incident(a.accountId))
        .select("reference, status, notify_by, created_by")
        .single();
      expect(ins.error).toBeNull();
      expect(ins.data).toEqual({
        reference: "INC-0001",
        status: "open",
        notify_by: null,
        created_by: a.userId,
      });
      const up = await a.client
        .from("incidents")
        .update({ status: "closed", closed_on: "2026-10-12" })
        .eq("account_id", a.accountId)
        .eq("reference", "INC-0001")
        .select("status, closed_on");
      expect(up.error).toBeNull();
      expect(up.data).toEqual([{ status: "closed", closed_on: "2026-10-12" }]);
      // Batch 45 item 30: the Commission reference round-trips through the
      // status view the pages and the export read (migration 20261015030000).
      const ref = await a.client
        .from("incidents")
        .update({ reportable: true, commission_reference: "REF-2026/14" })
        .eq("account_id", a.accountId)
        .eq("reference", "INC-0001");
      expect(ref.error).toBeNull();
      const viaView = await a.client
        .from("incidents_status")
        .select("reference, commission_reference")
        .eq("account_id", a.accountId)
        .eq("reference", "INC-0001")
        .single();
      expect(viaView.error).toBeNull();
      expect(viaView.data).toEqual({
        reference: "INC-0001",
        commission_reference: "REF-2026/14",
      });
      const bad = await a.client
        .from("incidents")
        .update({ commission_reference: "430123456" })
        .eq("account_id", a.accountId)
        .eq("reference", "INC-0001");
      expect(bad.error?.code).toBe("23514");
    });

    it("references are per account, in order, and distinct under two concurrent inserts", async () => {
      const second = await a.client
        .from("incidents")
        .insert(incident(a.accountId))
        .select("reference")
        .single();
      expect(second.data?.reference).toBe("INC-0002");
      const [c1, c2] = await Promise.all([
        a.client
          .from("incidents")
          .insert(incident(a.accountId))
          .select("reference")
          .single(),
        a.client
          .from("incidents")
          .insert(incident(a.accountId))
          .select("reference")
          .single(),
      ]);
      expect(c1.error).toBeNull();
      expect(c2.error).toBeNull();
      expect([c1.data?.reference, c2.data?.reference].sort()).toEqual([
        "INC-0003",
        "INC-0004",
      ]);
      const other = await b.client
        .from("incidents")
        .insert(incident(b.accountId))
        .select("reference")
        .single();
      expect(other.data?.reference).toBe("INC-0001");
      const complaint = await a.client
        .from("complaints")
        .insert({
          account_id: a.accountId,
          received_on: "2026-10-12",
          channel: "phone",
          from_ref: "FAM-2",
          summary: "Worker arrived late twice this week.",
        })
        .select("reference, status")
        .single();
      expect(complaint.error).toBeNull();
      expect(complaint.data).toEqual({
        reference: "CMP-0001",
        status: "received",
      });
    });

    it("notify_by is the next day for a 24-hour kind, five business days for a low-severity unauthorised restrictive practice and the next day when it caused harm", async () => {
      const serious = await a.client
        .from("incidents")
        .insert(
          incident(a.accountId, {
            category: "serious-injury",
            severity: "high",
            reportable: true,
          }),
        )
        .select("notify_by")
        .single();
      expect(serious.error).toBeNull();
      expect(serious.data?.notify_by).toBe("2026-10-10");
      const rp = await a.client
        .from("incidents")
        .insert(
          incident(a.accountId, {
            category: "restrictive-practice-unauthorised",
            severity: "low",
            reportable: true,
          }),
        )
        .select("notify_by")
        .single();
      expect(rp.error).toBeNull();
      // Friday 9 October plus five business days is Friday 16 October.
      expect(rp.data?.notify_by).toBe("2026-10-16");
      // Harm (severity medium or high) moves it to the 24-hour window (D-902).
      for (const severity of ["medium", "high"]) {
        const harmed = await a.client
          .from("incidents")
          .insert(
            incident(a.accountId, {
              category: "restrictive-practice-unauthorised",
              severity,
              reportable: true,
            }),
          )
          .select("notify_by")
          .single();
        expect(harmed.error).toBeNull();
        expect(harmed.data?.notify_by).toBe("2026-10-10");
      }
      const notFlagged = await a.client
        .from("incidents")
        .insert(
          incident(a.accountId, {
            category: "serious-injury",
            severity: "high",
          }),
        )
        .select("notify_by")
        .single();
      expect(notFlagged.data?.notify_by).toBeNull();
      // Retro review finding 23 (PO decision 23): an owner's back-filled row
      // carries the aware date the form sets (defaulting to the day it
      // happened), so the clock runs from the event, not the typing day
      // (D-902: early, never late); when the provider learned of it later,
      // the clock runs from that day (migration 20261015050000 § 3).
      const backFilled = await a.client
        .from("incidents")
        .insert(
          incident(a.accountId, {
            occurred_on: "2026-10-06",
            aware_on: "2026-10-06",
            reported_on: "2026-10-09",
            category: "serious-injury",
            severity: "high",
            reportable: true,
          }),
        )
        .select("notify_by, aware_on")
        .single();
      expect(backFilled.error).toBeNull();
      expect(backFilled.data).toEqual({
        notify_by: "2026-10-07",
        aware_on: "2026-10-06",
      });
      const awareLater = await a.client
        .from("incidents")
        .insert(
          incident(a.accountId, {
            occurred_on: "2026-10-06",
            aware_on: "2026-10-08",
            reported_on: "2026-10-09",
            category: "serious-injury",
            severity: "high",
            reportable: true,
          }),
        )
        .select("notify_by")
        .single();
      expect(awareLater.error).toBeNull();
      expect(awareLater.data?.notify_by).toBe("2026-10-09");
    });

    it("the NDIS-number CHECK fires on free text, and names in a reference field are refused", async () => {
      const ndis = await a.client
        .from("incidents")
        .insert(
          incident(a.accountId, { summary: "Participant 430123456 slipped." }),
        );
      expect(ndis.error).not.toBeNull();
      const note = await a.client.from("worker_clearances").insert({
        account_id: a.accountId,
        worker_ref: "W-1",
        role_label: "support worker",
        clearance_kind: "wwcc",
        issued_on: "2025-01-01",
        expires_on: "2030-01-01",
        note: "number 430000001",
      });
      expect(note.error).not.toBeNull();
      const name = await a.client
        .from("incidents")
        .insert(incident(a.accountId, { participant_ref: "Jane Citizen" }));
      expect(name.error).not.toBeNull();
      const closed = await a.client
        .from("incidents")
        .insert(incident(a.accountId, { status: "closed" }));
      expect(closed.error).not.toBeNull();
    });

    it("another account and an anonymous client see nothing and change nothing", async () => {
      const theirs = await b.client
        .from("incidents")
        .select("reference")
        .eq("account_id", a.accountId);
      expect(theirs.data).toEqual([]);
      const none = await anon.from("incidents").select("reference");
      expect(none.data ?? []).toEqual([]);
      const forged = await b.client
        .from("incidents")
        .insert(incident(a.accountId));
      expect(forged.error).not.toBeNull();
      const update = await b.client
        .from("incidents")
        .update({ summary: "tampered" })
        .eq("account_id", a.accountId)
        .select("reference");
      expect(update.data ?? []).toEqual([]);
      const ref = await b.client.rpc("next_register_reference", {
        p_account: a.accountId,
        p_register: "incidents",
      });
      expect(ref.error).not.toBeNull();
      const seq = await b.client.from("register_sequences").select("next");
      expect(seq.data ?? []).toEqual([]);
    });

    it("event trails are append-only: insert and read, never update", async () => {
      const inc = await a.client
        .from("incidents")
        .select("id")
        .eq("account_id", a.accountId)
        .eq("reference", "INC-0001")
        .single();
      const ev = await a.client
        .from("incident_events")
        .insert({
          incident_id: inc.data!.id,
          account_id: a.accountId,
          kind: "note",
          note: "Spoke with the worker.",
        })
        .select("id, actor_user_id")
        .single();
      expect(ev.error).toBeNull();
      expect(ev.data?.actor_user_id).toBe(a.userId);
      // A loud refusal (42501, no update privilege), never a silent zero-row no-op (D-906).
      const edit = await a.client
        .from("incident_events")
        .update({ note: "changed" })
        .eq("id", ev.data!.id)
        .select("note");
      expect(edit.error?.code).toBe("42501");
      const reread = await a.client
        .from("incident_events")
        .select("note")
        .eq("id", ev.data!.id);
      expect(reread.data).toEqual([{ note: "Spoke with the worker." }]);
      const cmp = await a.client
        .from("complaints")
        .select("id")
        .eq("account_id", a.accountId)
        .eq("reference", "CMP-0001")
        .single();
      const cev = await a.client
        .from("complaint_events")
        .insert({
          complaint_id: cmp.data!.id,
          account_id: a.accountId,
          kind: "acknowledged",
          note: "Called back the same day.",
        })
        .select("id")
        .single();
      expect(cev.error).toBeNull();
      const cedit = await a.client
        .from("complaint_events")
        .update({ note: "changed" })
        .eq("id", cev.data!.id)
        .select("note");
      expect(cedit.error?.code).toBe("42501");
      const creread = await a.client
        .from("complaint_events")
        .select("note")
        .eq("id", cev.data!.id);
      expect(creread.data).toEqual([{ note: "Called back the same day." }]);
      const wrongIncident = await b.client.from("incident_events").insert({
        incident_id: inc.data!.id,
        account_id: b.accountId,
        kind: "note",
        note: "cross-account",
      });
      expect(wrongIncident.error).not.toBeNull();
    });

    it("the status views compute from today's date", async () => {
      const soon = await a.client.from("worker_clearances").insert({
        account_id: a.accountId,
        worker_ref: "W-2",
        role_label: "director",
        clearance_kind: "ndis-worker-screening",
        clearance_number: "WWC1234567",
        issued_on: "2021-11-01",
        expires_on: new Date(Date.now() + 30 * 86_400_000)
          .toISOString()
          .slice(0, 10),
      });
      expect(soon.error).toBeNull();
      // Batch 45 (PR #56): the view must carry the column added after it was
      // created (migration 20261015030000), or the list and CSV read it empty.
      const view = await a.client
        .from("worker_clearances_status")
        .select("worker_ref, status, clearance_number")
        .eq("account_id", a.accountId)
        .order("worker_ref");
      expect(view.error).toBeNull();
      expect(view.data).toEqual([
        {
          worker_ref: "W-2",
          status: "expiring",
          clearance_number: "WWC1234567",
        },
      ]);
      // Every column the CSV export writes exists on the view it reads from;
      // a column added to the table without recreating the view fails here.
      for (const [viewName, columns] of [
        ["worker_clearances_status", CSV_COLUMNS.worker_clearances],
        ["incidents_status", CSV_COLUMNS.incidents],
        ["policy_reviews_status", CSV_COLUMNS.policy_reviews],
      ] as const) {
        const all = await a.client
          .from(viewName)
          .select(columns.join(","))
          .eq("account_id", a.accountId)
          .limit(1);
        expect(all.error, viewName).toBeNull();
      }
      // REQ-024 A0 (D-2442; #77's run 38880262268): a client may not plant a
      // catalogue type's adopted date, so the owner's insert is refused by
      // `policy_reviews_adopted_on_guard` and the fixture row goes in through
      // the service role, which passes the gate.
      const planted = await a.client.from("policy_reviews").insert({
        account_id: a.accountId,
        document_type_id: "complaints-management-policy-and-register",
        adopted_on: "2025-01-15",
      });
      expect(planted.error?.code).toBe("42501");
      const review = await admin
        .from("policy_reviews")
        .insert({
          account_id: a.accountId,
          document_type_id: "complaints-management-policy-and-register",
          adopted_on: "2025-01-15",
        })
        .select("next_review_on")
        .single();
      expect(review.error).toBeNull();
      expect(review.data?.next_review_on).toBe("2026-01-15");
      const rs = await a.client
        .from("policy_reviews_status")
        .select("status")
        .eq("account_id", a.accountId);
      expect(rs.data).toEqual([{ status: "overdue" }]);
      const hidden = await b.client
        .from("worker_clearances_status")
        .select("worker_ref")
        .eq("account_id", a.accountId);
      expect(hidden.data ?? []).toEqual([]);
    });

    it("the status views judge today on the Sydney day (D-2272)", async () => {
      // The product's calendar (D-2242). On a UTC runner between 00:00 and
      // 10 or 11 am Sydney the two days differ; the old `current_date` views
      // then read a notification due yesterday as still due. Outside that
      // window both definitions agree, which is the most a test without a
      // clock can pin.
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Australia/Sydney",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const day = (iso: string, delta: number) =>
        new Date(Date.parse(iso) + delta * 86_400_000)
          .toISOString()
          .slice(0, 10);
      // A 24-hour kind: notify_by is the day after it happened.
      const rows: Record<string, string> = {};
      for (const [label, ago] of [
        ["overdue-notification", 2],
        ["notification-due", 1],
      ] as const) {
        const ins = await a.client
          .from("incidents")
          .insert(
            incident(a.accountId, {
              category: "serious-injury",
              severity: "high",
              reportable: true,
              occurred_on: day(today, -ago),
              reported_on: day(today, -ago),
            }),
          )
          .select("id")
          .single();
        expect(ins.error).toBeNull();
        rows[ins.data!.id as string] = label;
      }
      const view = await a.client
        .from("incidents_status")
        .select("id, notification_status")
        .in("id", Object.keys(rows));
      expect(view.error).toBeNull();
      expect(
        Object.fromEntries(
          (view.data ?? []).map((r) => [r.id, r.notification_status]),
        ),
      ).toEqual(rows);
    });

    it("accounts take a registration date and kind, and only the two kinds", async () => {
      const ok = await a.client
        .from("accounts")
        .update({
          registration_date: "2026-08-01",
          registration_kind: "certification",
        })
        .eq("id", a.accountId)
        .select("registration_date, registration_kind");
      expect(ok.error).toBeNull();
      expect(ok.data).toEqual([
        { registration_date: "2026-08-01", registration_kind: "certification" },
      ]);
      const bad = await a.client
        .from("accounts")
        .update({ registration_kind: "provisional" })
        .eq("id", a.accountId);
      expect(bad.error).not.toBeNull();
    });

    it("a lapsed subscription reads but cannot write (PO answer 4)", async () => {
      const revoke = await admin
        .from("entitlements")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", aEntitlementId);
      expect(revoke.error).toBeNull();
      const read = await a.client
        .from("incidents")
        .select("reference")
        .eq("account_id", a.accountId)
        .order("reference");
      expect(read.error).toBeNull();
      expect(read.data?.length).toBeGreaterThanOrEqual(4);
      const insert = await a.client
        .from("incidents")
        .insert(incident(a.accountId));
      expect(insert.error).not.toBeNull();
      const update = await a.client
        .from("incidents")
        .update({ summary: "edited after lapse" })
        .eq("account_id", a.accountId)
        .eq("reference", "INC-0002")
        .select("summary");
      expect(update.data ?? []).toEqual([]);
      const still = await admin
        .from("incidents")
        .select("summary")
        .eq("account_id", a.accountId)
        .eq("reference", "INC-0002");
      expect(still.data).toEqual([
        { summary: "Near miss in the kitchen; no harm." },
      ]);
      // A fresh subscription unfreezes writes.
      await subscribe(admin, a.accountId);
      const again = await a.client
        .from("incidents")
        .insert(incident(a.accountId))
        .select("reference")
        .single();
      expect(again.error).toBeNull();
      expect(again.data?.reference).toMatch(/^INC-\d{4}$/);
    });
  },
);

describe.skipIf(enabled)("registers (skipped)", () => {
  it("needs the Supabase variables", () => {
    expect(enabled).toBe(false);
  });
});

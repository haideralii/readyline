/**
 * REQ-024 Session A0 against a real Supabase stack (AC-17; D-2427, D-2432,
 * D-2433, D-2435, D-2436, D-2437, D-2441, D-2442, D-2443): adoption is the
 * version's own date, written by `adopt_document_version` alone. The owner's
 * call lands and mirrors into the policy review row (created when none
 * exists), the service role's lands, a member's and a worker's raise 42501,
 * a wrong account and a deleted account raise 42501, a version in an older
 * set raises 42501, a type with no version writes nothing without error, the
 * register cannot move a catalogue type's date (the trigger) while an
 * unchanged date passes, a facts re-render leaves "new version to adopt"
 * until the re-adopt, the summary PDF and the Start here sheet in the zip
 * read the adoption after the summary-only pass, the backfill takes the
 * seeded row's date (not a titled second row's) capped at today, and the
 * two tables' grants are read back. Skips without the Supabase variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unzipSync } from "fflate";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildSkeleton,
  type DocumentModel,
} from "@/lib/generator/document-model";
import { documentTypeById } from "@/lib/generator/catalogue";
import { buildProviderFacts } from "@/lib/generator/facts";
import { applyFacts } from "@/lib/generator/facts-fill";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { renderDocx } from "@/lib/generator/render-docx";
import { START_HERE_FILE, adoptLine } from "@/lib/generator/start-here";
import { sydneyDay } from "@/lib/metrics/counters";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { refreshSetSummary } from "@/server/generation/rerender";
import { DOCUMENTS_BUCKET } from "@/server/generation/storage";
import { documentControlForSet } from "@/server/registers/document-control-queries";
import { markAdopted } from "@/server/registers/seed";
import { listAdoptedDates, listAdoptedTypeIds } from "@/server/path/state";
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
  const email = `adopt-${label}-${randomUUID()}@example.test`;
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
      p_trading_name: `Adopt ${label}`,
      p_business_structure: "sole-trader",
      p_states: ["NSW"],
      p_abn: null,
    });
    if (rpc.error) throw rpc.error;
    accountId = rpc.data as string;
  }
  return { userId: created.data.user.id, email, client, accountId };
}

/**
 * The strings pdf-lib draws, decoded, so the summary's first page can be
 * read back. `pdf.save()` writes the page content streams FlateDecode-
 * compressed (#77's first run: no `Tj` visible raw), so each
 * `stream ... endstream` body is inflated first, the raw body kept where
 * inflate throws, and the `Tj` and `TJ` operators are scanned over the
 * result.
 */
function pdfText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const raw = buf.toString("latin1");
  const parts: string[] = [];
  const stream = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const m of raw.matchAll(stream)) {
    const start = (m.index ?? 0) + m[0].indexOf(m[1]);
    const body = buf.subarray(start, start + m[1].length);
    try {
      parts.push(inflateSync(body).toString("latin1"));
    } catch {
      parts.push(m[1]);
    }
  }
  const text = parts.join("\n");
  const out: string[] = [];
  for (const m of text.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g))
    out.push(Buffer.from(m[1], "hex").toString("latin1"));
  for (const m of text.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) out.push(m[1]);
  for (const m of text.matchAll(/\[((?:[^\]\\]|\\.)*)\]\s*TJ/g)) {
    const pieces: string[] = [];
    for (const h of m[1].matchAll(/<([0-9A-Fa-f]+)>/g))
      pieces.push(Buffer.from(h[1], "hex").toString("latin1"));
    for (const l of m[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) pieces.push(l[1]);
    out.push(pieces.join(""));
  }
  return out.join("\n");
}

const psql = (dbUrl: string, sql: string): string[] =>
  execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\n")
    .filter(Boolean);

describe.skipIf(!enabled)(
  "adoption per version (REQ-024 Session A0, AC-17)",
  () => {
    let admin: SupabaseClient;
    let owner: Person;
    let other: Person;
    let fresh: Person;
    let gone: Person;
    let member: Person;
    let worker: Person;
    const users: string[] = [];
    const objects: string[] = [];
    let setId = "";
    let olderSetId = "";
    let goneSetId = "";
    const today = sydneyDay();
    const cases = loadReferenceCases();
    const c = cases[0];
    const facts = buildProviderFacts(c.answers, c.result);
    const dataset = getStandardsDataset();
    // Two documents of the case: a policy and a register, so both cycle rules show.
    const typeA = c.result.documents.find((d) => !/register/.test(d.id))!.id;
    const typeB = c.result.documents.find((d) => /register/.test(d.id))!.id;
    const versionIds: Record<string, string> = {};
    let olderVersionId = "";
    let goneVersionId = "";

    function model(typeId: string): DocumentModel {
      const type = documentTypeById(typeId);
      if (!type) throw new Error(`no document type ${typeId}`);
      const skeleton = buildSkeleton({
        type,
        facts,
        dataset,
        result: c.result,
        version: "1",
        generatedAt: today,
      });
      return applyFacts(skeleton, {
        name: "Jane Citizen",
        role: "Owner",
        date: "16 October 2026",
      });
    }

    async function insertVersion(
      accountId: string,
      set: string,
      typeId: string,
      version: number,
      withBytes: boolean,
    ): Promise<string> {
      const m = model(typeId);
      const path = `${accountId}/${set}/${typeId}.v${version}.docx`;
      if (withBytes) {
        const up = await admin.storage
          .from(DOCUMENTS_BUCKET)
          .upload(path, new Uint8Array(await renderDocx(m)), {
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
        if (up.error) throw up.error;
        objects.push(path);
      }
      const ins = await admin
        .from("document_versions")
        .insert({
          version_set_id: set,
          account_id: accountId,
          document_type_id: typeId,
          version,
          status: "ready",
          storage_path: path,
          model: m,
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      return ins.data.id as string;
    }

    async function insertSet(
      accountId: string,
      userId: string,
      createdAt?: string,
    ): Promise<string> {
      const ins = await admin
        .from("version_sets")
        .insert({
          account_id: accountId,
          created_by: userId,
          answers_snapshot_hash: "x",
          derived_result: c.result,
          status: "ready",
          storage_prefix: "",
          ...(createdAt ? { created_at: createdAt } : {}),
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      return ins.data.id as string;
    }

    beforeAll(async () => {
      const env = readSupabaseAdminEnv();
      admin = createClient(env.url, env.secretKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      owner = await signUp(admin, env.url, env.publishableKey, "owner", true);
      other = await signUp(admin, env.url, env.publishableKey, "other", true);
      // REQ-029: an account of its own for the snapshot case, so the backfill case's second account is untouched.
      fresh = await signUp(admin, env.url, env.publishableKey, "fresh", true);
      gone = await signUp(admin, env.url, env.publishableKey, "gone", true);
      member = await signUp(
        admin,
        env.url,
        env.publishableKey,
        "member",
        false,
      );
      worker = await signUp(
        admin,
        env.url,
        env.publishableKey,
        "worker",
        false,
      );
      users.push(
        owner.userId,
        other.userId,
        gone.userId,
        member.userId,
        worker.userId,
      );
      for (const [p, role, ref] of [
        [member, "member", null],
        [worker, "worker", "W-003"],
      ] as const) {
        const m = await admin.from("memberships").insert({
          user_id: p.userId,
          account_id: owner.accountId,
          role,
          ...(ref ? { worker_ref: ref } : {}),
        });
        if (m.error) throw m.error;
      }
      // The policy review register's own writes need a subscription (REQ-009).
      const ent = await admin
        .from("entitlements")
        .insert({ account_id: owner.accountId, kind: "subscription" });
      if (ent.error) throw ent.error;
      // An older ready set, then the newest; the newest carries the bytes the
      // summary pass reads.
      olderSetId = await insertSet(
        owner.accountId,
        owner.userId,
        new Date(Date.now() - 7 * 86_400_000).toISOString(),
      );
      olderVersionId = await insertVersion(
        owner.accountId,
        olderSetId,
        typeA,
        1,
        false,
      );
      setId = await insertSet(owner.accountId, owner.userId);
      // REQ-029 D-2855: the function snapshots the approver from the account's
      // facts and refuses without a name, so the owner has one from the start.
      const seeded = await admin.from("account_facts").upsert(
        [
          { account_id: owner.accountId, key: "name", value: "Jane Citizen" },
          { account_id: owner.accountId, key: "role", value: "Owner" },
        ],
        { onConflict: "account_id,key" },
      );
      if (seeded.error) throw seeded.error;
      versionIds[typeA] = await insertVersion(
        owner.accountId,
        setId,
        typeA,
        1,
        true,
      );
      versionIds[typeB] = await insertVersion(
        owner.accountId,
        setId,
        typeB,
        1,
        true,
      );
      // A deleted account with a version of its own (D-2437: the service role is refused).
      goneSetId = await insertSet(gone.accountId, gone.userId);
      goneVersionId = await insertVersion(
        gone.accountId,
        goneSetId,
        typeA,
        1,
        false,
      );
      const del = await admin
        .from("accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", gone.accountId);
      if (del.error) throw del.error;
    });

    afterAll(async () => {
      if (objects.length)
        await admin.storage
          .from(DOCUMENTS_BUCKET)
          .remove(objects)
          .catch(() => undefined);
      for (const u of users)
        await admin.auth.admin.deleteUser(u).catch(() => undefined);
    });

    it("the owner's call dates the version today in Sydney and creates the mirror row with both dates and the cycle (D-2437, D-2443)", async () => {
      const r = await owner.client.rpc("adopt_document_version", {
        p_account: owner.accountId,
        p_version: versionIds[typeA],
      });
      expect(r.error).toBeNull();
      expect(r.data).toBe(today);
      const v = await admin
        .from("document_versions")
        .select("adopted_on, approver_name, approver_role")
        .eq("id", versionIds[typeA])
        .single();
      // REQ-029 D-2855: the approver is snapshotted from the account's facts that day.
      expect(v.data).toEqual({
        adopted_on: today,
        approver_name: "Jane Citizen",
        approver_role: "Owner",
      });
      const pr = await admin
        .from("policy_reviews")
        .select("title, adopted_on, last_reviewed_on, review_cycle_months")
        .eq("account_id", owner.accountId)
        .eq("document_type_id", typeA);
      expect(pr.data).toEqual([
        {
          title: "",
          adopted_on: today,
          last_reviewed_on: today,
          review_cycle_months: 12,
        },
      ]);
    });

    it("the service role's call lands for a register type with the 3-month cycle; a wrong account and a deleted account are refused (D-2437)", async () => {
      const r = await admin.rpc("adopt_document_version", {
        p_account: owner.accountId,
        p_version: versionIds[typeB],
      });
      expect(r.error).toBeNull();
      expect(r.data).toBe(today);
      const pr = await admin
        .from("policy_reviews")
        .select("review_cycle_months")
        .eq("account_id", owner.accountId)
        .eq("document_type_id", typeB)
        .single();
      expect(pr.data?.review_cycle_months).toBe(3);
      const wrong = await admin.rpc("adopt_document_version", {
        p_account: other.accountId,
        p_version: versionIds[typeA],
      });
      expect(wrong.error?.code).toBe("42501");
      const deleted = await admin.rpc("adopt_document_version", {
        p_account: gone.accountId,
        p_version: goneVersionId,
      });
      expect(deleted.error?.code).toBe("42501");
    });

    it("a member's and a worker's call, and another owner's, raise 42501", async () => {
      for (const p of [member, worker, other]) {
        const r = await p.client.rpc("adopt_document_version", {
          p_account: owner.accountId,
          p_version: versionIds[typeA],
        });
        expect(r.error?.code, p.email).toBe("42501");
      }
    });

    it("a version in an older ready set is refused, so a re-adopt there never moves the type's dates (finding 206)", async () => {
      const r = await owner.client.rpc("adopt_document_version", {
        p_account: owner.accountId,
        p_version: olderVersionId,
      });
      expect(r.error?.code).toBe("42501");
      const v = await admin
        .from("document_versions")
        .select("adopted_on")
        .eq("id", olderVersionId)
        .single();
      expect(v.data?.adopted_on).toBeNull();
    });

    it("markAdopted writes nothing, without error, for a type with no version; with no set named it resolves the newest ready set (finding 179)", async () => {
      const none = await markAdopted(
        admin,
        owner.accountId,
        "no-such-document-type",
        setId,
      );
      expect(none).toBeNull();
      const again = await markAdopted(admin, owner.accountId, typeA, null);
      expect(again).toBe(today);
      const adopted = await listAdoptedTypeIds(admin, owner.accountId);
      expect([...adopted].sort()).toEqual([typeA, typeB].sort());
    });

    it("the register cannot move a catalogue type's adopted date, a save with the unchanged date passes, and an other row keeps its typed date (D-2435, D-2442)", async () => {
      const row = await owner.client
        .from("policy_reviews")
        .select("id, adopted_on")
        .eq("account_id", owner.accountId)
        .eq("document_type_id", typeA)
        .single();
      expect(row.error).toBeNull();
      const moved = await owner.client
        .from("policy_reviews")
        .update({ adopted_on: "2026-01-01" })
        .eq("id", row.data!.id)
        .select("id");
      expect(moved.error?.code).toBe("42501");
      const same = await owner.client
        .from("policy_reviews")
        .update({ adopted_on: today, note: "checked" })
        .eq("id", row.data!.id)
        .select("note");
      expect(same.error).toBeNull();
      expect(same.data).toEqual([{ note: "checked" }]);
      const planted = await owner.client.from("policy_reviews").insert({
        account_id: owner.accountId,
        document_type_id: "privacy-and-dignity-policy",
        title: "",
        review_cycle_months: 12,
        adopted_on: "2026-01-01",
      });
      expect(planted.error?.code).toBe("42501");
      const otherRow = await owner.client
        .from("policy_reviews")
        .insert({
          account_id: owner.accountId,
          document_type_id: "other",
          title: "Fire plan",
          review_cycle_months: 12,
          adopted_on: "2026-01-01",
        })
        .select("adopted_on")
        .single();
      expect(otherRow.error).toBeNull();
      expect(otherRow.data?.adopted_on).toBe("2026-01-01");
    });

    it("after the summary-only pass the zip's readiness summary reads the rows as adopted and the Start here sheet's adopt lines read done (D-2441)", async () => {
      const out = await refreshSetSummary(admin, setId);
      expect(out.documents).toBe(2);
      const zip = await admin.storage
        .from(DOCUMENTS_BUCKET)
        .download(`${owner.accountId}/${setId}/set.zip`);
      expect(zip.error).toBeNull();
      objects.push(
        `${owner.accountId}/${setId}/set.zip`,
        `${owner.accountId}/${setId}/readiness-summary.pdf`,
      );
      const files = unzipSync(new Uint8Array(await zip.data!.arrayBuffer()));
      const names = Object.keys(files);
      expect(names[0]).toBe(START_HERE_FILE);
      expect(names).toContain("readiness-summary.pdf");
      const summary = pdfText(files["readiness-summary.pdf"]);
      expect(summary).toContain("document control register");
      expect(
        summary.match(new RegExp(`Adopted ${today} by Owner`, "g")),
      ).toHaveLength(2);
      expect(summary).not.toContain("Adopted not yet");
      const sheet = unzipSync(files[START_HERE_FILE]);
      const xml = Buffer.from(sheet["word/document.xml"]).toString("utf8");
      const done = adoptLine(true).slice(2);
      const open = adoptLine(false).slice(2);
      expect(xml.split(done).length - 1).toBe(2);
      expect(xml).not.toContain(open);
    });

    it("a facts re-render that writes version 2 leaves new version to adopt, with the older date and the type's review date, until the re-adopt (D-2436, D-2440)", async () => {
      versionIds[`${typeA}-v2`] = await insertVersion(
        owner.accountId,
        setId,
        typeA,
        2,
        false,
      );
      const rows = await documentControlForSet(admin, owner.accountId, setId);
      const a = rows.find((r) => r.document_type_id === typeA)!;
      expect(a).toMatchObject({
        state: "new-version",
        version: "2",
        adopted_on: today,
      });
      expect(a.next_review_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rows.find((r) => r.document_type_id === typeB)?.state).toBe(
        "adopted",
      );
      // D-2448: the path counts the first adoption, so the type stays adopted
      // for the path while the register nudges; the register's date is the
      // newest adopted version's (version 1's, today).
      const before = await listAdoptedTypeIds(admin, owner.accountId);
      expect(before.has(typeA)).toBe(true);
      expect(before.has(typeB)).toBe(true);
      expect((await listAdoptedDates(admin, owner.accountId)).get(typeA)).toBe(
        today,
      );
      // The re-adopt: the owner's call on the newest version.
      const r = await owner.client.rpc("adopt_document_version", {
        p_account: owner.accountId,
        p_version: versionIds[`${typeA}-v2`],
      });
      expect(r.error).toBeNull();
      const after = await documentControlForSet(admin, owner.accountId, setId);
      expect(after.find((r) => r.document_type_id === typeA)?.state).toBe(
        "adopted",
      );
      expect(
        (await listAdoptedTypeIds(admin, owner.accountId)).has(typeA),
      ).toBe(true);
      // The mirror keeps its first date; the review date moved to today.
      const pr = await admin
        .from("policy_reviews")
        .select("adopted_on, last_reviewed_on")
        .eq("account_id", owner.accountId)
        .eq("document_type_id", typeA)
        .eq("title", "")
        .single();
      expect(pr.data).toEqual({ adopted_on: today, last_reviewed_on: today });
    });

    it("the carried adoption keeps the earlier version's day for the service role; an owner's call is dated today whatever it passes; the mirror is unmoved (D-2449)", async () => {
      // The adopt step's own re-render writes version 3 with the dates filled
      // in; the carry adopts it with the earlier version's day.
      versionIds[`${typeA}-v3`] = await insertVersion(
        owner.accountId,
        setId,
        typeA,
        3,
        false,
      );
      const carried = await markAdopted(
        admin,
        owner.accountId,
        typeA,
        setId,
        "2026-10-01",
      );
      expect(carried).toBe("2026-10-01");
      const v3 = await admin
        .from("document_versions")
        .select("adopted_on, approver_name, approver_role")
        .eq("id", versionIds[`${typeA}-v3`])
        .single();
      // REQ-029 D-2855: a carried adoption copies the earlier version's approver, not today's facts.
      expect(v3.data).toEqual({
        adopted_on: "2026-10-01",
        approver_name: "Jane Citizen",
        approver_role: "Owner",
      });
      expect((await listAdoptedDates(admin, owner.accountId)).get(typeA)).toBe(
        "2026-10-01",
      );
      const rows = await documentControlForSet(admin, owner.accountId, setId);
      expect(rows.find((r) => r.document_type_id === typeA)).toMatchObject({
        state: "adopted",
        version: "3",
        adopted_on: "2026-10-01",
      });
      // The mirror keeps its first date and its review date never moves back.
      const pr = await admin
        .from("policy_reviews")
        .select("adopted_on, last_reviewed_on")
        .eq("account_id", owner.accountId)
        .eq("document_type_id", typeA)
        .eq("title", "")
        .single();
      expect(pr.data).toEqual({ adopted_on: today, last_reviewed_on: today });
      // An owner passing a day is dated today all the same.
      versionIds[`${typeA}-v4`] = await insertVersion(
        owner.accountId,
        setId,
        typeA,
        4,
        false,
      );
      const own = await owner.client.rpc("adopt_document_version", {
        p_account: owner.accountId,
        p_version: versionIds[`${typeA}-v4`],
        p_adopted_on: "2026-10-01",
      });
      expect(own.error).toBeNull();
      expect(own.data).toBe(today);
    });

    it("REQ-029 D-2855: no name refuses with P0004, the snapshot is fixed in place, and a re-approval's version takes the new role while the earlier keeps its own", async () => {
      const freshSet = await insertSet(fresh.accountId, fresh.userId);
      const v1 = await insertVersion(
        fresh.accountId,
        freshSet,
        typeA,
        1,
        false,
      );
      const refused = await fresh.client.rpc("adopt_document_version", {
        p_account: fresh.accountId,
        p_version: v1,
      });
      expect(refused.error?.code).toBe("P0004");
      const facts = await admin.from("account_facts").upsert(
        [
          { account_id: fresh.accountId, key: "name", value: "Sam Worker" },
          { account_id: fresh.accountId, key: "role", value: "Owner" },
        ],
        { onConflict: "account_id,key" },
      );
      expect(facts.error).toBeNull();
      const ok = await fresh.client.rpc("adopt_document_version", {
        p_account: fresh.accountId,
        p_version: v1,
      });
      expect(ok.error).toBeNull();
      // Fixed in place: not even the service role moves a written snapshot (42501).
      const moved = await admin
        .from("document_versions")
        .update({ approver_name: "Someone Else" })
        .eq("id", v1);
      expect(moved.error?.code).toBe("42501");
      // FR-6: the role changes on the account; the re-approved version carries it, the earlier keeps "Owner".
      await admin
        .from("account_facts")
        .upsert(
          { account_id: fresh.accountId, key: "role", value: "Director" },
          { onConflict: "account_id,key" },
        );
      const v2 = await insertVersion(
        fresh.accountId,
        freshSet,
        typeA,
        2,
        false,
      );
      const again = await fresh.client.rpc("adopt_document_version", {
        p_account: fresh.accountId,
        p_version: v2,
      });
      expect(again.error).toBeNull();
      const both = await admin
        .from("document_versions")
        .select("version, approver_name, approver_role")
        .in("id", [v1, v2])
        .order("version");
      expect(both.data).toEqual([
        { version: 1, approver_name: "Sam Worker", approver_role: "Owner" },
        { version: 2, approver_name: "Sam Worker", approver_role: "Director" },
      ]);
    });

    it("the backfill takes the seeded row's date onto the latest version, ignores a titled second row, caps a future date at today, and the row then reads adopted (D-2432)", async () => {
      const dbUrl = process.env.SUPABASE_DB_URL?.trim();
      if (!dbUrl) {
        expect(process.env.CI, "SUPABASE_DB_URL is not set").toBeFalsy();
        return;
      }
      // A pre-A0 account: versions without dates, policy review rows with them.
      const preSet = await insertSet(other.accountId, other.userId);
      await insertVersion(other.accountId, preSet, typeA, 1, false);
      const v2 = await insertVersion(other.accountId, preSet, typeA, 2, false);
      const vb = await insertVersion(other.accountId, preSet, typeB, 1, false);
      const seeded = await admin.from("policy_reviews").insert([
        {
          account_id: other.accountId,
          document_type_id: typeA,
          title: "",
          review_cycle_months: 12,
          adopted_on: "2026-01-10",
        },
        {
          account_id: other.accountId,
          document_type_id: typeA,
          title: "Old copy",
          review_cycle_months: 12,
          adopted_on: "2025-01-01",
        },
        {
          account_id: other.accountId,
          document_type_id: typeB,
          title: "",
          review_cycle_months: 3,
          adopted_on: "2030-01-01",
        },
      ]);
      expect(seeded.error).toBeNull();
      const migration = readFileSync(
        new URL(
          "../../supabase/migrations/20261016040000_adoption_per_version.sql",
          import.meta.url,
        ),
        "utf8",
      );
      const start = migration.indexOf(
        "select set_config('readyline.adopting', 'on', true);",
      );
      const end = migration.indexOf(
        "select set_config('readyline.adopting', '', true);",
      );
      expect(start).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(start);
      const backfill = migration.slice(
        start,
        end + "select set_config('readyline.adopting', '', true);".length,
      );
      psql(dbUrl, backfill);
      const versions = await admin
        .from("document_versions")
        .select("id, adopted_on")
        .eq("version_set_id", preSet);
      const byId = new Map(
        (versions.data as { id: string; adopted_on: string | null }[]).map(
          (r) => [r.id, r.adopted_on],
        ),
      );
      expect(byId.get(v2)).toBe("2026-01-10");
      expect(byId.get(vb)).toBe(today);
      expect([...byId.values()].filter((d) => d === "2025-01-01")).toHaveLength(
        0,
      );
      const capped = await admin
        .from("policy_reviews")
        .select("adopted_on")
        .eq("account_id", other.accountId)
        .eq("document_type_id", typeB)
        .single();
      expect(capped.data?.adopted_on).toBe(today);
      const rows = await documentControlForSet(admin, other.accountId, preSet);
      expect(rows.map((r) => r.state).sort()).toEqual(["adopted", "adopted"]);
      // Idempotent: a second run moves nothing.
      psql(dbUrl, backfill);
      const again = await admin
        .from("document_versions")
        .select("id, adopted_on")
        .eq("version_set_id", preSet);
      expect(again.data).toEqual(versions.data);
    });

    it("authenticated holds select alone on document_versions and select and delete on memberships; anon holds nothing (D-2245, finding 175)", async () => {
      const dbUrl = process.env.SUPABASE_DB_URL?.trim();
      if (!dbUrl) {
        expect(process.env.CI, "SUPABASE_DB_URL is not set").toBeFalsy();
        return;
      }
      const read = (table: string, grantee: string) =>
        psql(
          dbUrl,
          `select privilege_type from information_schema.role_table_grants where grantee = '${grantee}' and table_schema = 'public' and table_name = '${table}' order by 1`,
        );
      expect(read("document_versions", "authenticated")).toEqual(["SELECT"]);
      expect(read("memberships", "authenticated")).toEqual([
        "DELETE",
        "SELECT",
      ]);
      expect(read("document_versions", "anon")).toEqual([]);
      expect(read("memberships", "anon")).toEqual([]);
    });
  },
);

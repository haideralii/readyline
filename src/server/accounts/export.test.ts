/**
 * Retro review of REQ-004 (15 Oct 2026, finding 32): the export zip is the
 * CLAUDE.md 4.5 export and must be complete. These tests pin the file list
 * (one JSON file per owner-readable table), that every table read is scoped
 * by `account_id`, that hidden columns and document contents never reach the
 * zip, and that the README names each file. A fake Supabase client stands
 * in; the real-stack case is `tests/integration/session-c.test.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  buildAccountExport,
  buildExportZip,
  EXPORT_TABLES,
  HIDDEN_COLUMNS,
  stripHiddenColumns,
} from "./export";

type Row = Record<string, unknown>;
type Read = { table: string; select: string; filters: [string, unknown][] };

/** A thenable query builder that records what was asked and answers from a table map. */
function fakeClient(data: Record<string, Row[]>, reads: Read[]) {
  const from = (table: string) => {
    const read: Read = { table, select: "", filters: [] };
    reads.push(read);
    const rows = () =>
      (data[table] ?? []).filter((r) =>
        read.filters.every(([k, v]) => r[k] === v),
      );
    const builder = {
      select(cols: string) {
        read.select = cols;
        return builder;
      },
      eq(col: string, value: unknown) {
        read.filters.push([col, value]);
        return builder;
      },
      order() {
        return builder;
      },
      maybeSingle() {
        return Promise.resolve({ data: rows()[0] ?? null, error: null });
      },
      then(resolve: (v: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: rows(), error: null }).then(resolve);
      },
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const seed: Record<string, Row[]> = {
  accounts: [
    { id: ACCOUNT, trading_name: "Sunrise Supports", states: ["NSW"] },
    { id: OTHER, trading_name: "Other Co", states: ["VIC"] },
  ],
  memberships: [
    { account_id: ACCOUNT, user_id: "u-a", role: "owner" },
    { account_id: OTHER, user_id: "u-b", role: "owner" },
  ],
  questionnaire_drafts: [{ account_id: ACCOUNT, answers: { owner: "a" } }],
  checklist_items: [],
  audit_log: [{ account_id: ACCOUNT, id: 1, action: "account.created" }],
  incidents: [
    { account_id: ACCOUNT, id: "inc-a", reference: "INC-0001" },
    { account_id: OTHER, id: "inc-b", reference: "INC-0001" },
  ],
  document_versions: [
    {
      account_id: ACCOUNT,
      id: "dv-a",
      document_type_id: "incident-management",
      version: 1,
    },
  ],
  reminders: [
    {
      account_id: ACCOUNT,
      id: "rem-a",
      kind: "policy-review",
      token_hash: "x",
    },
  ],
};

const EXPECTED_TABLES = [
  "incidents",
  "incident_events",
  "complaints",
  "complaint_events",
  "worker_clearances",
  "policy_reviews",
  "corporate_risks",
  "participant_risks",
  "conflicts_of_interest",
  "delegations",
  "insurance_items",
  "improvements",
  "staff_matrix",
  "onboarding_checklists",
  "onboarding_ticks",
  "decisions",
  "register_events",
  "version_sets",
  "document_versions",
  "purchases",
  "subscriptions",
  "entitlements",
  "account_facts",
  "reminders",
];

describe("buildAccountExport (finding 32)", () => {
  it("covers every owner-readable table, each read scoped by account_id", async () => {
    const reads: Read[] = [];
    const data = await buildAccountExport(
      fakeClient(seed, reads),
      ACCOUNT,
      new Date("2026-10-15T00:00:00Z"),
    );
    expect(data).not.toBeNull();
    expect(EXPORT_TABLES.map((t) => t.table)).toEqual(EXPECTED_TABLES);
    expect(Object.keys(data!.tables)).toEqual(EXPECTED_TABLES);
    for (const spec of EXPORT_TABLES) {
      const read = reads.find((r) => r.table === spec.table);
      expect(read, spec.table).toBeDefined();
      expect(read!.filters).toContainEqual(["account_id", ACCOUNT]);
    }
    expect(data!.tables.incidents.map((r) => r.id)).toEqual(["inc-a"]);
    expect(JSON.stringify(data)).not.toContain(OTHER);
    expect(JSON.stringify(data)).not.toContain("inc-b");
  });

  it("never exports a hidden column or a document's contents", async () => {
    const reads: Read[] = [];
    const data = await buildAccountExport(fakeClient(seed, reads), ACCOUNT);
    expect(HIDDEN_COLUMNS).toContain("token_hash");
    expect(JSON.stringify(data)).not.toContain("token_hash");
    expect(data!.tables.reminders[0]).toEqual({
      account_id: ACCOUNT,
      id: "rem-a",
      kind: "policy-review",
    });
    const versions = reads.find((r) => r.table === "document_versions")!;
    expect(versions.select).not.toContain("*");
    expect(versions.select).not.toMatch(/\bmodel\b/);
    expect(versions.select).not.toContain("storage_path");
    const sets = reads.find((r) => r.table === "version_sets")!;
    expect(sets.select).not.toContain("*");
    expect(sets.select).not.toContain("storage_prefix");
  });

  it("returns null when the account is not visible to the session", async () => {
    const data = await buildAccountExport(
      fakeClient({ accounts: [] }, []),
      ACCOUNT,
    );
    expect(data).toBeNull();
  });

  it("stripHiddenColumns drops only the hidden keys", () => {
    expect(stripHiddenColumns({ a: 1, token_hash: "h", b: null })).toEqual({
      a: 1,
      b: null,
    });
  });
});

describe("buildExportZip (finding 32)", () => {
  it("writes account.json, one JSON file per table and a README that names each", async () => {
    const data = (await buildAccountExport(fakeClient(seed, []), ACCOUNT))!;
    const files = unzipSync(buildExportZip(data));
    expect(Object.keys(files).sort()).toEqual(
      [
        "account.json",
        "README.txt",
        ...EXPECTED_TABLES.map((t) => `${t}.json`),
      ].sort(),
    );
    const account = JSON.parse(strFromU8(files["account.json"]));
    expect(account.account.id).toBe(ACCOUNT);
    expect(account.memberships).toHaveLength(1);
    expect(account.tables).toBeUndefined();
    expect(JSON.parse(strFromU8(files["incidents.json"]))).toEqual([
      { account_id: ACCOUNT, id: "inc-a", reference: "INC-0001" },
    ]);
    expect(JSON.parse(strFromU8(files["complaints.json"]))).toEqual([]);
    const readme = strFromU8(files["README.txt"]);
    for (const table of EXPECTED_TABLES)
      expect(readme).toContain(`  ${table}.json: `);
    expect(readme).toContain("download the set's zip from your documents page");
    expect(readme).toContain("never contains participant information");
  });
});

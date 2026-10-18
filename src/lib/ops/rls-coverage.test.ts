// @vitest-environment node
/**
 * REQ-012 FR-1f, AC-4: every table with an `account_id` column has, in
 * tests/integration, a cross-tenant read, a forged insert and a cross-tenant
 * update case. The map is computed from the migrations and the test files
 * (src/lib/ops/rls-coverage.ts), so a migration that adds a table nobody
 * tests fails here naming the table and the kinds it lacks, and a deleted
 * test shows the same way. The report prints the map.
 */
import { describe, expect, it } from "vitest";
import { accountTables, accountTablesInSql } from "./account-tables";
import {
  kindsInBlock,
  rlsCoverage,
  rlsGaps,
  rlsMapLines,
  testBlocks,
} from "./rls-coverage";

/**
 * Tables allowed to lack a kind, each with a dated reason (none today: the
 * fourteen the first run found are covered by
 * tests/integration/rls-coverage-cases.test.ts).
 */
const RULED: Record<string, { missing: string[]; reason: string }> = {};

describe("row-level security coverage over every account table (REQ-012 FR-1f, AC-4)", () => {
  const tables = accountTables();
  const map = rlsCoverage({ tables });

  it("reads the migrations and the integration tests", () => {
    expect(tables.length).toBeGreaterThan(40);
    expect(Object.keys(map)).toEqual(tables);
    for (const t of ["incidents", "complaints", "auditor_links"])
      expect(map[t].read.length, t).toBeGreaterThan(0);
  });

  it("every account table has a cross-tenant read, a forged insert and a cross-tenant update case, or is ruled by name", () => {
    const gaps = rlsGaps(map).filter(
      (g) =>
        !RULED[g.table] ||
        g.missing.some((k) => !RULED[g.table].missing.includes(k)),
    );
    expect(
      gaps.map((g) => `${g.table}: ${g.missing.join(", ")}`),
      "tables lacking a case; add it to tests/integration or rule it here with a reason",
    ).toEqual([]);
  });

  it("a ruling names only tables and kinds that exist", () => {
    for (const [table, r] of Object.entries(RULED)) {
      expect(tables, table).toContain(table);
      expect(r.reason.length).toBeGreaterThan(10);
      for (const k of r.missing)
        expect(["read", "insert", "update"]).toContain(k);
    }
  });

  it("AC-4: a fixture migration adding public.widgets with an account_id fails naming widgets and all three kinds", () => {
    const fixture = `create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null
);`;
    expect(accountTablesInSql(fixture)).toEqual(["widgets"]);
    const gaps = rlsGaps(rlsCoverage({ tables: ["widgets"] }));
    expect(gaps).toEqual([
      { table: "widgets", missing: ["read", "insert", "update"] },
    ]);
  });

  it("a block proves a kind by naming the table, doing the operation and asserting a denial, or by calling threeCases for it", () => {
    const read =
      'it("x", async () => { const r = await b.from("widgets").select("id").eq("account_id", a); expect(r.data ?? []).toEqual([]); });';
    expect(kindsInBlock("widgets", read)).toEqual(["read"]);
    const noDenial =
      'it("x", async () => { const r = await b.from("widgets").insert({}); expect(r.error).toBeNull(); });';
    expect(kindsInBlock("widgets", noDenial)).toEqual([]);
    const otherTable =
      'it("x", async () => { const r = await b.from("gadgets").update({}).select(); expect(r.error?.code).toBe("42501"); });';
    expect(kindsInBlock("widgets", otherTable)).toEqual([]);
    const three =
      'it("widgets: …", () => threeCases("widgets", { seed: null, forged: {}, change: {} }));';
    expect(kindsInBlock("widgets", three)).toEqual([
      "read",
      "insert",
      "update",
    ]);
    expect(kindsInBlock("gadgets", three)).toEqual([]);
  });

  it("the block splitter finds each it() with its title and body", () => {
    const blocks = testBlocks(
      `it("first", async () => { await a.from("x").select(); expect(r.data).toEqual([]); });\n  it('second', () => {});`,
    );
    expect(blocks.map((b) => b.title)).toEqual(["first", "second"]);
    expect(blocks[0].body).toContain('from("x")');
    expect(blocks[1].body).not.toContain('from("x")');
  });

  it("the map prints one line per table with a case per kind", () => {
    const lines = rlsMapLines(map);
    expect(lines).toHaveLength(tables.length);
    expect(lines.some((l) => l.includes("GAP"))).toBe(false);
  });
});

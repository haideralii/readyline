import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { accountTables } from "./account-tables";

/**
 * REQ-012 FR-1f, AC-4: the table-to-test map for row-level security. For
 * every table with an `account_id` column, the integration tests are read
 * for the three cases the threat model asks of a tenant table: a
 * cross-tenant read that returns nothing, a forged insert that is refused,
 * and a cross-tenant update or delete that writes nothing. A case is found
 * when one `it(...)` block names the table, performs that operation and
 * asserts a denial (42501, an empty result, a null row, a refused error);
 * or when the block calls `threeCases("<table>", …)`, the helper in
 * tests/integration/rls-coverage-cases.test.ts that runs all three. The map
 * is computed, never typed, so a new table or a deleted test shows at once;
 * the report prints it.
 */

export type RlsKind = "read" | "insert" | "update";
export type RlsCase = { file: string; title: string };
export type RlsCoverage = Record<RlsKind, RlsCase[]>;

const KINDS: RlsKind[] = ["read", "insert", "update"];
/**
 * A denial: the policy's code, an empty or null result, a refused error. An
 * accepted error (\`expect(r.error).toBeNull()\`) is not one.
 */
const DENIAL =
  /42501|toEqual\(\[\]\)|toHaveLength\(0\)|error\)\.not\.toBeNull|error\?\.code\)\.toBe|data\)\.toBeNull\(\)|data\?\.\w+\)\.toBeUndefined\(\)/;
const OPERATION: Record<RlsKind, RegExp> = {
  read: /\.select\(/,
  insert: /\.insert\(/,
  update: /\.update\(|\.delete\(/,
};
const THREE_CASES = /threeCases\(\s*"([a-z_]+)"/g;

/** Splits a test file into its `it(...)` blocks: the title and the text up to the next block. */
export function testBlocks(text: string): { title: string; body: string }[] {
  const re = /\bit\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
  const starts: { title: string; at: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) starts.push({ title: m[2], at: m.index });
  return starts.map((s, i) => ({
    title: s.title,
    body: text.slice(s.at, starts[i + 1]?.at ?? text.length),
  }));
}

/** The kinds one block proves for one table. */
export function kindsInBlock(table: string, body: string): RlsKind[] {
  const three = [...body.matchAll(THREE_CASES)].some((m) => m[1] === table);
  if (three) return [...KINDS];
  if (!body.includes(`"${table}"`) || !DENIAL.test(body)) return [];
  return KINDS.filter((kind) => OPERATION[kind].test(body));
}

/** The map for every account table, from the migrations and the integration tests on disk. */
export function rlsCoverage(
  options: {
    migrationsDir?: string;
    testsDir?: string;
    tables?: string[];
  } = {},
): Record<string, RlsCoverage> {
  const testsDir = options.testsDir ?? join("tests", "integration");
  const tables = options.tables ?? accountTables(options.migrationsDir);
  const files = readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.ts"))
    .map((f) => ({
      file: f,
      blocks: testBlocks(readFileSync(join(testsDir, f), "utf8")),
    }));
  const map: Record<string, RlsCoverage> = {};
  for (const table of tables) {
    const cases: RlsCoverage = { read: [], insert: [], update: [] };
    for (const { file, blocks } of files)
      for (const b of blocks)
        for (const kind of kindsInBlock(table, b.body))
          cases[kind].push({ file, title: b.title });
    map[table] = cases;
  }
  return map;
}

/** The tables missing a kind, each with the kinds missing. */
export function rlsGaps(
  map: Record<string, RlsCoverage>,
): { table: string; missing: RlsKind[] }[] {
  return Object.entries(map)
    .map(([table, cases]) => ({
      table,
      missing: KINDS.filter((k) => cases[k].length === 0),
    }))
    .filter((g) => g.missing.length > 0);
}

/** The map as the report prints it: one line per table, the first case of each kind. */
export function rlsMapLines(map: Record<string, RlsCoverage>): string[] {
  const one = (c: RlsCase[]) =>
    c.length
      ? `${c[0].file.replace(/\.test\.ts$/, "")} "${c[0].title.slice(0, 50)}"${c.length > 1 ? ` (+${c.length - 1})` : ""}`
      : "GAP";
  return Object.entries(map).map(
    ([table, c]) =>
      `| ${table} | ${one(c.read)} | ${one(c.insert)} | ${one(c.update)} |`,
  );
}

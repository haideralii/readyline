import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every `create table public.<name> (...)` in the migrations whose body names
 * an `account_id` column: the tables that hold a provider's own rows. Read
 * from the SQL itself so a new table is seen by its migration, never by a
 * list someone must remember. Shared by the data-promises coverage test
 * (REQ-030 FR-5, AC-8) and the RLS coverage test (REQ-012 FR-1f, AC-4).
 */
export function accountTables(dir = "supabase/migrations"): string[] {
  const out = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, file), "utf8");
    const re =
      /create table (?:if not exists )?public\.([a-z_]+)\s*\(([\s\S]*?)\);/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      if (/\baccount_id\b/.test(m[2])) out.add(m[1]);
    }
  }
  return [...out].sort();
}

/** The same scan over one SQL text, for fixtures (AC-8, AC-4's throwaway red). */
export function accountTablesInSql(sql: string): string[] {
  const re =
    /create table (?:if not exists )?public\.([a-z_]+)\s*\(([\s\S]*?)\);/gi;
  return [...sql.matchAll(re)]
    .filter((m) => /\baccount_id\b/.test(m[2]))
    .map((m) => m[1]);
}

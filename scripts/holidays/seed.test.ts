// @vitest-environment node
/**
 * REQ-032 FR-1 (D-2915): the migration's seed is the fixture's rows, as
 * scripts/holidays/seed.mjs prints them, so SQL and TypeScript count the
 * same days; the years the script sees are the loader's years.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOLIDAY_ROWS, HOLIDAY_YEARS } from "@/lib/registers/public-holidays";
import { holidayFiles, seedRows, seedSql } from "./seed.mjs";

const MIGRATION = readdirSync("supabase/migrations")
  .filter((f) => /_public_holidays\.sql$/.test(f))
  .map((f) => `supabase/migrations/${f}`);

describe("the public holiday seed (REQ-032 FR-1)", () => {
  it("one migration carries exactly the rows the fixture holds", () => {
    expect(MIGRATION).toHaveLength(1);
    const sql = readFileSync(MIGRATION[0], "utf8").replace(/\r\n/g, "\n");
    const seed = (seedSql() as string).replace(/\r\n/g, "\n");
    expect(sql).toContain(seed);
    expect((seedRows() as unknown[]).length).toBe(HOLIDAY_ROWS.length);
    expect(
      (holidayFiles() as string[]).map((f) => Number(f.replace(".json", ""))),
    ).toEqual([...HOLIDAY_YEARS]);
  });
});

/**
 * REQ-032 (#119's restore red), D-2952: reference tables seeded by a
 * migration are not backup data. The dump leaves their rows out, or the
 * restore onto a freshly migrated stack collides on the seeded keys
 * (`public_holidays_pkey` on `(2026-01-01, NSW)`). The list is pinned here,
 * the script carries one `--exclude-table-data` per entry and no other, and
 * the runbook's restore step names the exclusion and why.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The tables a migration seeds in full; a new one joins here and in `backup.sh` together. */
export const SEEDED_REFERENCE_TABLES = ["public.public_holidays"] as const;

describe("the backup dump and the seeded reference tables (D-2952)", () => {
  const script = readFileSync("scripts/ops/backup.sh", "utf8");
  const runbook = readFileSync("product/ops/INCIDENTS.md", "utf8");

  it("excludes exactly the seeded reference tables' data from the dump", () => {
    const excluded = [...script.matchAll(/--exclude-table-data=(\S+)/g)].map(
      (m) => m[1].replace(/^['"]|['"]$/g, ""),
    );
    expect(excluded.sort()).toEqual([...SEEDED_REFERENCE_TABLES].sort());
    // Still a data-only dump of every other table in public and of auth.users.
    expect(script).toContain("--data-only");
    expect(script).toContain("-t 'public.*' -t 'auth.users'");
  });

  it("the runbook's restore step names the exclusion and why", () => {
    for (const table of SEEDED_REFERENCE_TABLES)
      expect(runbook).toContain(`\`${table}\``);
    expect(runbook).toContain("D-2952");
    expect(runbook).toMatch(/seeds? it|seeded by/);
  });
});

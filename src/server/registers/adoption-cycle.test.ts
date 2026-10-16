// @vitest-environment node
/**
 * REQ-024 A0 (D-2443 as amended; finding 232): the review cycle a seeded
 * policy review row takes is one rule in two languages, `seed.ts` for the
 * register's first visit and `adopt_document_version` for the tick that
 * comes before it. This test reads both sources and fails when either moves.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(new URL("./seed.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20261016040000_adoption_per_version.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("the seeded review cycle rule (REQ-024 A0, D-2443)", () => {
  it("seed.ts and adopt_document_version give registers 3 months and every other document 12", () => {
    expect(seed).toContain("/register/.test(id) ? 3 : 12");
    expect(migration).toContain(
      "case when v_row.document_type_id ~ 'register' then 3 else 12 end",
    );
  });

  it("the function alone dates a version, in Sydney, and clears the guard it sets", () => {
    expect(migration).toContain(
      "v_today date := (now() at time zone 'Australia/Sydney')::date",
    );
    expect(migration).toContain(
      "perform set_config('readyline.adopting', 'on', true);",
    );
    expect(migration).toContain(
      "perform set_config('readyline.adopting', '', true);",
    );
    expect(migration).toContain(
      "create trigger policy_reviews_adopted_on_guard",
    );
    expect(migration).toMatch(
      /before insert or update on public\.policy_reviews/,
    );
    // D-2243, D-2245: the two tables' revokes come before their grants.
    expect(
      migration.indexOf("revoke all on public.document_versions"),
    ).toBeLessThan(
      migration.indexOf("grant select on public.document_versions"),
    );
    expect(migration.indexOf("revoke all on public.memberships")).toBeLessThan(
      migration.indexOf("grant select, delete on public.memberships"),
    );
  });
});

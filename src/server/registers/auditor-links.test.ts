// @vitest-environment node
/**
 * The purge of the signed-out tokens (REQ-020 Data: "tokens are deleted on
 * revoke or expiry plus 30 days"; retro review finding 27): auditor links
 * by expiry and revocation, invitations by acceptance, revocation and
 * expiry, report links by revocation, every one against the same cutoff,
 * through one delete statement per ended-state column. The client is a
 * fake that records each statement.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

const {
  purgeCutoff,
  purgeOldAuditorLinks,
  purgeOldInvitations,
  purgeOldReportLinks,
} = await import("./auditor-links");

type Statement = { table: string; column: string; cutoff: string };

function fakeAdmin(counts: Record<string, number> = {}) {
  const statements: Statement[] = [];
  const admin = {
    from(table: string) {
      return {
        delete() {
          return {
            lt: async (column: string, cutoff: string) => {
              statements.push({ table, column, cutoff });
              return {
                count: counts[`${table}.${column}`] ?? 0,
                error: null,
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { admin, statements };
}

const now = new Date("2026-10-15T10:00:00Z");
const cutoff = "2026-09-15T10:00:00.000Z";

describe("the purge of ended links, invitations and report links", () => {
  it("the cutoff is thirty days before now", () => {
    expect(purgeCutoff(now)).toBe(cutoff);
  });

  it("auditor links go by expiry and by revocation", async () => {
    const { admin, statements } = fakeAdmin({
      "auditor_links.expires_at": 2,
      "auditor_links.revoked_at": 1,
    });
    expect(await purgeOldAuditorLinks(admin, now)).toBe(3);
    expect(statements).toEqual([
      { table: "auditor_links", column: "expires_at", cutoff },
      { table: "auditor_links", column: "revoked_at", cutoff },
    ]);
  });

  it("invitations go thirty days after they were accepted, revoked or expired", async () => {
    const { admin, statements } = fakeAdmin({
      "invitations.accepted_at": 1,
      "invitations.expires_at": 4,
    });
    expect(await purgeOldInvitations(admin, now)).toBe(5);
    expect(statements).toEqual([
      { table: "invitations", column: "accepted_at", cutoff },
      { table: "invitations", column: "revoked_at", cutoff },
      { table: "invitations", column: "expires_at", cutoff },
    ]);
  });

  it("report links go thirty days after revocation, and a live one never does", async () => {
    const { admin, statements } = fakeAdmin({ "report_links.revoked_at": 1 });
    expect(await purgeOldReportLinks(admin, now)).toBe(1);
    expect(statements).toEqual([
      { table: "report_links", column: "revoked_at", cutoff },
    ]);
  });
});

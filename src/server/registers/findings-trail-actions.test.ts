// @vitest-environment node
/**
 * REQ-033 FR-5, SR-3 (D-2935): addressing a finding writes its day and role,
 * closes its improvement row, and leaves a trail line and an audit line;
 * verification needs an addressed finding and records the auditor's date;
 * a finding that is not open, or not the caller's, is refused in words.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const writes: { table: string; op: string; row: Record<string, unknown> }[] =
  [];
let updateRows: Record<string, unknown>[] = [
  { id: "f-1", improvement_id: "imp-1" },
];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logging/logger", () => ({
  log: { info: () => {}, warn: () => {} },
}));
vi.mock("@/server/accounts/queries", () => ({
  getViewer: async () => ({
    account: { id: "acc-1" },
    deleted: null,
    user: { id: "user-1" },
  }),
}));
vi.mock("@/server/auth/rate-limit", () => ({
  checkRegisterWriteAllowed: async () => true,
}));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      const api = {
        update(row: Record<string, unknown>) {
          writes.push({ table, op: "update", row });
          return api;
        },
        insert(row: Record<string, unknown>) {
          writes.push({ table, op: "insert", row });
          return api;
        },
        eq() {
          return api;
        },
        is() {
          return api;
        },
        select() {
          return api;
        },
        then(resolve: (v: unknown) => void) {
          resolve({
            data: table === "findings" ? updateRows : null,
            error: null,
          });
        },
      };
      return api;
    },
  }),
}));

const { addressFindingAction, verifyFindingAction } =
  await import("./findings-trail-actions");

beforeEach(() => {
  writes.length = 0;
  updateRows = [{ id: "f-1", improvement_id: "imp-1" }];
});

const ID = "11111111-1111-4111-8111-111111111111";

describe("the finding's trail (REQ-033 FR-5)", () => {
  it("addresses an open finding with the day and the role, closes its improvement row, and writes the trail and audit lines", async () => {
    const r = await addressFindingAction({
      id: ID,
      addressedOn: "2026-10-02",
      role: "Owner",
    });
    expect(r).toEqual({ ok: true });
    expect(writes.map((w) => `${w.table}:${w.op}`)).toEqual([
      "findings:update",
      "improvements:update",
      "register_events:insert",
      "audit_log:insert",
    ]);
    expect(writes[0].row).toEqual({
      status: "addressed",
      addressed_on: "2026-10-02",
      addressed_by_role: "Owner",
    });
    expect(writes[1].row).toEqual({ done_on: "2026-10-02" });
    expect(writes[3].row).toMatchObject({
      action: "register.findings.addressed",
      actor_user_id: "user-1",
    });
  });

  it("records the auditor's verification on an addressed finding, and refuses it on one that is not", async () => {
    const r = await verifyFindingAction({ id: ID, verifiedOn: "2026-10-09" });
    expect(r).toEqual({ ok: true });
    expect(writes[0]).toMatchObject({
      table: "findings",
      row: { status: "verified", verified_on: "2026-10-09" },
    });
    updateRows = [];
    const refused = await verifyFindingAction({
      id: ID,
      verifiedOn: "2026-10-09",
    });
    expect(refused).toEqual({
      ok: false,
      message:
        "Mark the finding as addressed first; the auditor verifies a change you have made.",
    });
  });

  it("refuses a bad date or an empty role in words, and a finding that is not open", async () => {
    const bad = await addressFindingAction({
      id: ID,
      addressedOn: "soon",
      role: "Owner",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toBe("Enter the date it was addressed");
    updateRows = [];
    const gone = await addressFindingAction({
      id: ID,
      addressedOn: "2026-10-02",
      role: "Owner",
    });
    expect(gone).toEqual({
      ok: false,
      message: "This finding is not open, or is not yours.",
    });
  });
});

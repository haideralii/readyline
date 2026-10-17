// @vitest-environment node
/**
 * REQ-024 SR-7 and SR-8, the handler (AC-12, AC-16): a marked value typed
 * into the fill is in the response body and in no line the logger wrote
 * and no row the handler inserted; the response is an attachment under
 * no-store; a refused submission (over the limit, or the tick unset)
 * returns the form with the value still in the page, under no-store, and
 * writes the count-only line; a post from elsewhere is refused.
 */
import { describe, expect, it, vi } from "vitest";
import type { StaffMatrixRow } from "@/lib/registers/audit-day-types";
import type { WorkerExportSnapshot } from "@/lib/registers/worker-exports";

vi.mock("server-only", () => ({}));

const logLines: string[] = [];
vi.mock("@/lib/logging/logger", async () => {
  const actual = await vi.importActual<typeof import("@/lib/logging/logger")>(
    "@/lib/logging/logger",
  );
  return {
    ...actual,
    log: actual.createLogger({
      minLevel: "debug",
      sink: (_level, line) => logLines.push(line),
    }),
  };
});

const inserted: Record<string, unknown>[] = [];
const fakeSupabase = {
  from: (table: string) => ({
    insert: async (row: Record<string, unknown>) => {
      inserted.push({ table, ...row });
      return { error: null };
    },
    select: () => ({
      eq: () => ({
        order: async () => ({
          data: [{ worker_ref: "W-001", ended_on: null }],
          error: null,
        }),
        not: async () => ({ data: [], error: null }),
      }),
    }),
  }),
};
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => fakeSupabase,
}));

let viewer: Record<string, unknown> | null = {
  user: { id: "user-1" },
  account: { id: "acc-1", trading_name: "Sunrise Supports" },
  deleted: null,
  worker: null,
};
vi.mock("@/server/accounts/queries", () => ({
  getViewer: async () => viewer,
}));

let allowed = true;
vi.mock("@/server/auth/rate-limit", () => ({
  checkFillAllowed: async () => allowed,
}));

const ACC = "acc-1";
const row: StaffMatrixRow = {
  id: "row-1",
  account_id: ACC,
  worker_ref: "W-001",
  role_label: "Support worker",
  qualifications: "",
  risk_assessed: true,
  started_on: "2024-01-01",
  last_supervision_on: null,
  last_appraisal_on: null,
  onboarding_signed_on: null,
  note: "",
  role: "support-worker",
  states: ["NSW"],
  works_with_children: false,
  may_use_restrictive_practice: false,
  ended_on: null,
  role_ref: null,
  risk_assessed_from: "2024-01-01",
  risk_paragraph: "b",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};
const snapshot: WorkerExportSnapshot = {
  asAt: "2026-10-17",
  rows: [row],
  checklists: [],
  items: [],
  clearances: [],
  roles: [],
  exceptions: [],
  events: [],
  states: new Map(),
  itemsByRef: new Map(),
};
vi.mock("./worker-exports", () => ({
  loadWorkerExportSnapshot: async (
    _s: unknown,
    _a: string,
    input: { asAt?: string },
  ) => ({ ...snapshot, asAt: input.asAt ?? snapshot.asAt }),
  part4SectionFor: () => null,
}));
vi.mock("./worker-onboarding", () => ({ todaySydney: () => "2026-10-17" }));

const { makeFillHandler: make } = await import("./fill-route");
const { strictObject } = await import("@/lib/validation");
const makeFillHandler = (
  kind: "screening-list" | "risk-assessed-roles" | "workers",
) => make(kind, strictObject({}));

const MARK = "Zq Marked Value Xy";
const ORIGIN = "https://readyline.example";

function post(
  kind: "screening-list" | "risk-assessed-roles" | "workers",
  fields: Record<string, string>,
  headers: Record<string, string> = {},
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new Request(`${ORIGIN}/registers/staff/export/${kind}`, {
    method: "POST",
    body: form,
    headers: {
      origin: ORIGIN,
      referer: `${ORIGIN}/registers/staff-matrix/export`,
      ...headers,
    },
  });
}

describe("the fill handler (SR-7, SR-8)", () => {
  it("sends the filled screening list as an attachment under no-store, the value in the body and nowhere else", async () => {
    logLines.length = 0;
    inserted.length = 0;
    allowed = true;
    const res = await makeFillHandler("screening-list")(
      post("screening-list", {
        fill: "on",
        told: "on",
        "name:W-001": MARK,
        "dob:W-001": "1990-01-02",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="screening-list-2026-10-17\.csv"$/,
    );
    const body = await res.text();
    expect(body).toContain(MARK);
    expect(body).toContain("1990-01-02");
    expect(logLines.join("\n")).not.toContain(MARK);
    expect(logLines.join("\n")).not.toContain("1990-01-02");
    expect(JSON.stringify(inserted)).not.toContain(MARK);
    expect(inserted).toEqual([
      {
        table: "audit_log",
        account_id: "acc-1",
        actor_user_id: "user-1",
        action: "exports.screening-list.filled",
        target: "acc-1",
      },
    ]);
    expect(logLines.some((l) => l.includes('"event":"exports.fill"'))).toBe(
      true,
    );
  });

  it("unticked, the typed value is not read and the file carries bracket text (SR-8(c), (j))", async () => {
    inserted.length = 0;
    const res = await makeFillHandler("screening-list")(
      post("screening-list", { "name:W-001": MARK }),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain(MARK);
    expect(body).toContain("[Full name]");
    expect(inserted[0]).toMatchObject({
      action: "exports.screening-list.unfilled",
    });
  });

  it("over the limit, returns the form with the value still in the page, under no-store, with the count-only line (finding 76, 123)", async () => {
    logLines.length = 0;
    inserted.length = 0;
    allowed = false;
    const res = await makeFillHandler("workers")(
      post("workers", { fill: "on", told: "on", "name:W-001": MARK }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain(MARK);
    expect(html).toContain("several filled files in the last hour");
    expect(html).toContain('http-equiv="refresh"');
    expect(logLines.join("\n")).not.toContain(MARK);
    expect(inserted).toEqual([
      {
        table: "audit_log",
        account_id: "acc-1",
        actor_user_id: "user-1",
        action: "exports.workers.refused",
        target: "acc-1",
      },
    ]);
    allowed = true;
  });

  it("ticked without the told line is refused with the form and the fixed sentence (AC-16)", async () => {
    const res = await makeFillHandler("screening-list")(
      post("screening-list", { fill: "on", "name:W-001": MARK }),
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Tick the line about telling your workers");
    expect(html).toContain(MARK);
  });

  it("refuses a post from another origin or another page, and a signed-out post goes to sign-in (SR-8(a))", async () => {
    const other = await makeFillHandler("screening-list")(
      post("screening-list", {}, { origin: "https://evil.example" }),
    );
    expect(other.status).toBe(403);
    const elsewhere = await makeFillHandler("screening-list")(
      post("screening-list", {}, { referer: `${ORIGIN}/registers` }),
    );
    expect(elsewhere.status).toBe(403);
    viewer = null;
    const out = await makeFillHandler("screening-list")(
      post("screening-list", {}),
    );
    expect(out.status).toBe(303);
    expect(out.headers.get("location")).toContain("/sign-in?next=");
    viewer = {
      user: { id: "user-1" },
      account: { id: "acc-1", trading_name: "Sunrise Supports" },
      deleted: null,
      worker: null,
    };
  });
});

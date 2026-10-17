import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { StaffMatrixRow } from "./audit-day-types";
import {
  FILL_COPY,
  FILL_LIMITS,
  FILL_PREFERRED_REGION,
  buildFillFile,
  parseFill,
  stripBom,
} from "./fill";
import type { WorkerClearanceRow } from "./types";
import type { WorkerExportSnapshot } from "./worker-exports";

/**
 * REQ-024 A3, the one-time fill (FR-6b; SR-8(c), (e), (g)): what the form
 * says and accepts, and what each file carries filled and unfilled.
 */
const ACC = "11111111-1111-4111-8111-111111111111";

const staff = (ref: string, extra: Partial<StaffMatrixRow> = {}) =>
  ({
    id: `row-${ref}`,
    account_id: ACC,
    worker_ref: ref,
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
    role_ref: "r-1",
    risk_assessed_from: "2024-01-01",
    risk_paragraph: "b",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...extra,
  }) as StaffMatrixRow;

const clearance: WorkerClearanceRow = {
  id: "c-1",
  account_id: ACC,
  worker_ref: "W-001",
  role_label: "Support worker",
  clearance_kind: "ndis-worker-screening",
  clearance_number: "WWC1234567",
  application_number: "APP-9",
  issued_on: "2025-01-10",
  expires_on: "2030-01-09",
  verified_in_database_on: null,
  decision_code: null,
  decision_on: null,
  state: "NSW",
  note: "",
  created_at: "2025-01-10T00:00:00Z",
  updated_at: "2025-01-10T00:00:00Z",
};

const snapshot: WorkerExportSnapshot = {
  asAt: "2026-10-17",
  rows: [staff("W-001"), staff("W-002", { ended_on: "2026-03-31" })],
  checklists: [],
  items: [],
  clearances: [clearance],
  roles: [
    {
      id: "r-1",
      account_id: ACC,
      title: "Support worker",
      paragraphs: ["b"],
      description: "",
      assessed_on: "2026-02-01",
      assessor_ref: "KP-1",
      first_held_on: "2026-01-01",
      seed_code: "support-worker",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  exceptions: [],
  entries: [],
  events: [],
  states: new Map(),
  itemsByRef: new Map(),
};

const entries = (o: Record<string, string>) => Object.entries(o);

describe("parseFill (FR-6b, SR-8)", () => {
  it("unticked, reads no value and builds for brackets", () => {
    const r = parseFill("screening-list", entries({ "name:W-001": "Ignored" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.submission.fill).toBe(false);
      expect(r.submission.values.workers).toEqual({});
    }
  });

  it("ticked without the told line is refused in the fixed words (AC-16)", () => {
    const r = parseFill("screening-list", entries({ fill: "on" }));
    expect(r).toEqual({ ok: false, message: FILL_COPY.tickRequired });
  });

  it("ticked and told, keeps the typed values by worker code, the supervisor and the assessor", () => {
    const r = parseFill(
      "screening-list",
      entries({
        fill: "on",
        told: "on",
        as_at: "2026-09-30",
        "name:W-001": " Marked Value ",
        "dob:W-001": "1990-01-02",
        "address:W-001": "1 Example Street",
        "name:W-002": "",
        "supervisor:W-007": "Super Visor",
        assessor_name: "Owner Name, director",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.submission.asAt).toBe("2026-09-30");
      expect(r.submission.values).toEqual({
        workers: {
          "W-001": {
            full_name: "Marked Value",
            date_of_birth: "1990-01-02",
            address: "1 Example Street",
          },
        },
        supervisors: { "W-007": "Super Visor" },
        assessor_name: "Owner Name, director",
      });
    }
  });

  it("refuses an NDIS number, an over-long value, a bad date, a file and an unknown field", () => {
    const base = { fill: "on", told: "on" };
    expect(
      parseFill("workers", entries({ ...base, "name:W-001": "431234567" })).ok,
    ).toBe(false);
    expect(
      parseFill(
        "workers",
        entries({
          ...base,
          "address:W-001": "x".repeat(FILL_LIMITS.address + 1),
        }),
      ).ok,
    ).toBe(false);
    expect(
      parseFill("workers", entries({ ...base, "dob:W-001": "02/01/1990" })).ok,
    ).toBe(false);
    expect(
      parseFill("workers", entries({ ...base, "name:not-a-code": "x" })).ok,
    ).toBe(false);
    expect(parseFill("workers", entries({ ...base, extra: "x" })).ok).toBe(
      false,
    );
    const file = parseFill("workers", [
      ["name:W-001", new File(["x"], "a.txt")],
    ]);
    expect(file.ok).toBe(false);
  });
});

describe("buildFillFile (FR-6a, FR-6b; AC-12)", () => {
  it("unticked, the screening list carries the bracket text and the two first lines", () => {
    const f = buildFillFile(snapshot, {
      kind: "screening-list",
      fill: false,
      asAt: null,
      values: { workers: {}, supervisors: {} },
    });
    expect(f.fileName).toBe("screening-list-2026-10-17.csv");
    expect(f.contentType).toBe("text/csv; charset=utf-8");
    const text = stripBom(Buffer.from(f.body).toString("utf8"));
    const [first, header] = text.split("\r\n");
    expect(first).toContain("This is a draft of the information");
    expect(first).toContain("bracketed cells are for you to complete");
    expect(header.split(",")).toEqual(
      expect.arrayContaining(["full_name", "date_of_birth", "address"]),
    );
    expect(text).toContain("[Full name]");
    expect(text).toContain("WWC1234567");
    // W-002 ended in March, so as at today the s 18 list holds W-001 alone.
    expect(f.count).toBe(1);
    expect(text).not.toContain("W-002");
  });

  it("ticked, the values are in the file and an empty cell keeps its bracket", () => {
    const f = buildFillFile(snapshot, {
      kind: "screening-list",
      fill: true,
      asAt: null,
      values: {
        workers: { "W-001": { full_name: "Marked Value" } },
        supervisors: {},
      },
    });
    const text = stripBom(Buffer.from(f.body).toString("utf8"));
    expect(text).toContain("Marked Value");
    expect(text).toContain("[Date of birth]");
    expect(text).toContain("[Address]");
  });

  it("the roles list fills the assessor from the one field", () => {
    const f = buildFillFile(snapshot, {
      kind: "risk-assessed-roles",
      fill: true,
      asAt: null,
      values: {
        workers: {},
        supervisors: {},
        assessor_name: "Owner Name, director",
      },
    });
    const text = stripBom(Buffer.from(f.body).toString("utf8"));
    expect(text).toContain("Owner Name, director");
    expect(text).not.toContain("[Assessor");
    expect(f.fileName).toBe("risk-assessed-roles-2026-10-17.csv");
  });

  it("the workers zip holds the index and one file per worker, the worker row carrying the fill (finding 77)", () => {
    const f = buildFillFile(snapshot, {
      kind: "workers",
      fill: true,
      asAt: "2026-09-30",
      values: {
        workers: { "W-002": { full_name: "Past Worker" } },
        supervisors: {},
      },
    });
    expect(f.fileName).toBe("workers-2026-09-30.zip");
    expect(f.contentType).toBe("application/zip");
    const files = unzipSync(f.body);
    expect(Object.keys(files).sort()).toEqual([
      "workers/W-001.csv",
      "workers/W-002.csv",
      "workers/index.csv",
    ]);
    const w2 = Buffer.from(files["workers/W-002.csv"]).toString("utf8");
    expect(w2).toContain("Past Worker");
    const w1 = Buffer.from(files["workers/W-001.csv"]).toString("utf8");
    expect(w1).toContain("[Full name]");
    expect(f.count).toBe(2);
  });

  it("pins the handler to Sydney and names no code in the printable notice", () => {
    expect(FILL_PREFERRED_REGION).toBe("syd1");
    const notice = FILL_COPY.notice(
      "https://example.test/legal/privacy",
      "2026-10-17",
    );
    expect(notice).toContain("the provider you work for");
    expect(notice).not.toMatch(/employer/);
    expect(notice).toContain("https://example.test/legal/privacy");
    expect(notice).toContain("2026-10-17");
    expect(notice).not.toMatch(/W-\d/);
  });
});

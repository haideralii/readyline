import { describe, expect, it } from "vitest";
import type {
  OnboardingChecklistRow,
  OnboardingItemRow,
  RegisterEventRow,
  RiskAssessedRoleRow,
  ScreeningExceptionRow,
  StaffMatrixRow,
  SupervisionEntryRow,
} from "./audit-day-types";
import { CSV_COLUMNS, toCsv } from "./csv";
import type { WorkerOnboardingItem } from "./onboarding-items";
import type { WorkerClearanceRow } from "./types";
import type { WorkerState } from "./worker-state";
import {
  FILL_BRACKETS,
  clearanceOutcome,
  exceptionPart4,
  fillFirstLine,
  itemState,
  onScreeningList,
  parseRoleChange,
  riskAssessedRolesRows,
  riskSegments,
  rulesListFirstLine,
  screeningListRows,
  packWorkerFiles,
  workerFileRows,
  workersIndexRows,
  type WorkerExportSnapshot,
} from "./worker-exports";

/**
 * REQ-024 A3 (FR-6, FR-6a; AC-5, AC-10, AC-12, AC-13): the rows the pack,
 * the auditor link and the account export share, from one snapshot.
 */
const ACC = "11111111-1111-4111-8111-111111111111";

function staff(
  ref: string,
  extra: Partial<StaffMatrixRow> = {},
): StaffMatrixRow {
  return {
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
    note: "a private note",
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
    ...extra,
  };
}

function clearance(
  ref: string,
  extra: Partial<WorkerClearanceRow> = {},
): WorkerClearanceRow {
  return {
    id: `c-${ref}-${extra.clearance_kind ?? "ndis"}`,
    account_id: ACC,
    worker_ref: ref,
    role_label: "Support worker",
    clearance_kind: "ndis-worker-screening",
    clearance_number: "WWC1234567",
    application_number: "APP-9",
    issued_on: "2025-01-10",
    expires_on: "2030-01-09",
    verified_in_database_on: "2025-01-11",
    decision_code: null,
    decision_on: null,
    state: "NSW",
    note: "",
    created_at: "2025-01-10T00:00:00Z",
    updated_at: "2025-01-10T00:00:00Z",
    ...extra,
  };
}

function event(
  rowId: string,
  kind: RegisterEventRow["kind"],
  note: string,
  at: string,
  register: RegisterEventRow["register"] = "staff_matrix",
): RegisterEventRow {
  return {
    id: `e-${rowId}-${at}`,
    account_id: ACC,
    register,
    row_id: rowId,
    at,
    actor_user_id: null,
    kind,
    note,
  };
}

const state = (label: string, outstanding: string[] = []): WorkerState => ({
  key: "outstanding",
  label,
  next: null,
  outstanding,
  expiring: [],
  roleAssessmentToRecord: false,
  statesMissing: false,
  exceptionRunning: false,
  supervisorClearanceEndedOn: null,
});

const item = (id: string, who: WorkerOnboardingItem["who"]) =>
  ({
    id,
    text: `Do ${id}`,
    who,
    counts: "date",
    beforeFirstShift: true,
    ask: `Show me ${id}`,
    source: { title: "Rules", status: "verified" },
  }) as WorkerOnboardingItem;

function snapshot(
  partial: Partial<WorkerExportSnapshot>,
): WorkerExportSnapshot {
  return {
    asAt: "2026-10-17",
    rows: [],
    checklists: [],
    items: [],
    clearances: [],
    roles: [],
    exceptions: [],
    entries: [],
    events: [],
    states: new Map(),
    itemsByRef: new Map(),
    ...partial,
  };
}

describe("the s 20 reconstruction (AC-13)", () => {
  // W-002 in a risk assessed role from 2024-03-01 to 2025-06-30 (ended);
  // W-003 from 2025-01-01 (current); W-005 an admin from 2024-06-01
  // reclassified into a risk assessed role on 2025-03-01, the event recorded
  // a week later with the fixed note.
  const w2 = staff("W-002", {
    risk_assessed_from: "2024-03-01",
    started_on: "2024-03-01",
    ended_on: "2025-06-30",
  });
  const w3 = staff("W-003", {
    risk_assessed_from: "2025-01-01",
    started_on: "2025-01-01",
  });
  const w5 = staff("W-005", {
    started_on: "2024-06-01",
    risk_assessed_from: "2025-03-01",
  });
  const events = [
    event(
      w5.id,
      "role-changed",
      "from=admin to=support-worker on=2025-03-01",
      "2025-03-08T02:00:00Z",
    ),
  ];
  const listed = (asAt: string) =>
    screeningListRows(snapshot({ asAt, rows: [w2, w3, w5], events })).map(
      (r) => r.worker_ref,
    );

  it("lists the workers in a risk assessed role on each day the REQ names", () => {
    expect(listed("2025-01-15")).toEqual(["W-002", "W-003"]);
    expect(listed("2025-03-02")).toEqual(["W-002", "W-003", "W-005"]);
    expect(listed("2025-07-01")).toEqual(["W-003", "W-005"]);
    expect(listed("2024-02-28")).toEqual([]);
    expect(listed("2025-02-01")).toEqual(["W-002", "W-003"]);
  });

  it("reads the fixed note and nothing looser", () => {
    expect(
      parseRoleChange("from=admin to=support-worker on=2025-03-01"),
    ).toEqual({ from: "admin", to: "support-worker", on: "2025-03-01" });
    expect(parseRoleChange("role changed to support worker")).toBeNull();
  });

  it("closes a segment when the worker leaves a risk assessed role and keeps the earlier days", () => {
    const row = staff("W-009", {
      risk_assessed: false,
      risk_assessed_from: null,
      started_on: "2024-01-01",
    });
    const trail = [
      event(
        row.id,
        "role-changed",
        "from=admin to=team-leader on=2024-02-01",
        "2024-02-01T00:00:00Z",
      ),
      event(
        row.id,
        "role-changed",
        "from=team-leader to=admin on=2024-09-30",
        "2024-09-30T00:00:00Z",
      ),
    ];
    expect(riskSegments(row, trail)).toEqual([
      { start: "2024-02-01", end: "2024-09-30" },
    ]);
    expect(onScreeningList(row, trail, "2024-05-01")).toBe(true);
    expect(onScreeningList(row, trail, "2024-10-01")).toBe(false);
  });
});

describe("the screening list's columns (FR-6a, AC-5, AC-12)", () => {
  const w1 = staff("W-001");
  const w4 = staff("W-004", { risk_assessed: false, risk_assessed_from: null });
  const exception: ScreeningExceptionRow = {
    id: "x-1",
    account_id: ACC,
    worker_ref: "W-001",
    clearance_id: null,
    code: "s14-1b",
    part4_state: "NSW",
    started_on: "2025-11-01",
    verified_on: null,
    notice_seen_on: null,
    supervisor_ref: "W-007",
    declaration_on: null,
    plan_version_id: null,
    plan_register_date: null,
    ended_on: "2026-01-31",
    end_code: "clearance-issued",
    created_at: "2025-11-01T00:00:00Z",
    updated_at: "2026-01-31T00:00:00Z",
  } as ScreeningExceptionRow;
  const s = snapshot({
    rows: [w1, w4],
    clearances: [clearance("W-001")],
    exceptions: [exception],
  });

  it("holds the risk assessed worker with numbers and codes and not the other, and never a name column", () => {
    const rows = screeningListRows(s, { sectionFor: () => "23(7)" });
    expect(rows.map((r) => r.worker_ref)).toEqual(["W-001"]);
    const r = rows[0];
    expect(r.application_number).toBe("APP-9");
    expect(r.clearance_number).toBe("WWC1234567");
    expect(r.outcome).toBe("clearance");
    expect(r.exception_code).toBe("s14-1b");
    expect(r.exception_end_code).toBe("clearance-issued");
    expect(r.exception_part4).toBe("s 14(1)(b), Part 4 s 23(7) (NSW)");
    expect(Object.keys(r)).toEqual([...CSV_COLUMNS.screening_list]);
    for (const c of CSV_COLUMNS.screening_list)
      expect(c).not.toMatch(/name|birth|address/);
    const csv = toCsv(CSV_COLUMNS.screening_list, rows);
    expect(csv).not.toContain("[Full name]");
    expect(csv).not.toContain("a private note");
  });

  it("with the fill, carries the typed values and the bracket text for an empty cell (AC-12)", () => {
    const rows = screeningListRows(s, {
      fill: {
        workers: { "W-001": { full_name: "Marked Value", address: "" } },
        supervisors: {},
      },
    });
    expect(rows[0].full_name).toBe("Marked Value");
    expect(rows[0].date_of_birth).toBe(FILL_BRACKETS.date_of_birth);
    expect(rows[0].address).toBe(FILL_BRACKETS.address);
    expect(rows[0].supervisor_name).toBe(FILL_BRACKETS.supervisor_name);
  });

  it("derives the outcome from the row (finding 120)", () => {
    expect(clearanceOutcome(null)).toBe("");
    expect(
      clearanceOutcome({
        clearance_number: "",
        issued_on: null,
        decision_code: null,
      }),
    ).toBe("");
    expect(
      clearanceOutcome({
        clearance_number: "WWC1",
        issued_on: "2025-01-01",
        decision_code: null,
      }),
    ).toBe("clearance");
    expect(
      clearanceOutcome({
        clearance_number: "",
        issued_on: null,
        decision_code: "excluded",
      }),
    ).toBe("excluded");
    expect(
      exceptionPart4({ code: "s14-1a", part4_state: null }, () => "1"),
    ).toBe("");
  });

  it("words the first lines as a draft, never as the list", () => {
    for (const line of [
      rulesListFirstLine("s17", "2026-10-17"),
      rulesListFirstLine("s18", "2026-10-17"),
      fillFirstLine("s18"),
    ]) {
      expect(line).toContain("Readyline does not keep a copy");
      expect(line).not.toMatch(/you have the list|is the list/i);
    }
    expect(rulesListFirstLine("s18", "2026-10-17")).toContain(
      "as at 2026-10-17",
    );
    expect(rulesListFirstLine("s17", "2026-10-17")).toContain("s 17(1)");
  });
});

describe("the roles list (FR-6a, AC-5, finding 80)", () => {
  const roles: RiskAssessedRoleRow[] = ["support-worker", "admin"].map(
    (code) => ({
      id: `r-${code}`,
      account_id: ACC,
      title: code,
      paragraphs: code === "admin" ? [] : ["b", "c"],
      description: "",
      assessed_on: code === "admin" ? null : "2026-02-01",
      assessor_ref: "KP-1",
      first_held_on: "2026-01-01",
      seed_code: code,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }),
  );
  it("lists the held or assessed roles with the assessor's code and leaves the unheld seeded one off", () => {
    const rows = riskAssessedRolesRows(
      snapshot({
        rows: [staff("W-001", { role_ref: "r-support-worker" })],
        roles,
      }),
    );
    expect(rows.map((r) => r.title)).toEqual(["support-worker"]);
    expect(rows[0].assessor_ref).toBe("KP-1");
    expect(rows[0].paragraphs).toBe("b c");
    expect(Object.keys(rows[0])).toEqual([...CSV_COLUMNS.risk_assessed_roles]);
    const filled = riskAssessedRolesRows(
      snapshot({
        rows: [staff("W-001", { role_ref: "r-support-worker" })],
        roles,
      }),
      { fill: { workers: {}, supervisors: {} } },
    );
    expect(filled[0].assessor_name).toBe(FILL_BRACKETS.assessor_name);
  });
});

describe("the workers index and a worker's file (FR-6, AC-5, AC-10)", () => {
  const current = staff("W-001");
  const past = staff("W-002", { ended_on: "2026-06-30" });
  const list: OnboardingChecklistRow = {
    id: "list-1",
    account_id: ACC,
    kind: "worker",
    subject_ref: "W-001",
    started_on: "2026-01-01",
    completed_on: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const items: OnboardingItemRow[] = [
    {
      id: "i-1",
      account_id: ACC,
      checklist_id: "list-1",
      item_id: "w3-code-of-conduct",
      owner_role: "both",
      done_on: "2026-01-02",
      confirmed_on: null,
      recorded_by_owner: false,
      note: "",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    },
  ];
  const s = snapshot({
    rows: [past, current],
    checklists: [list],
    items,
    clearances: [clearance("W-001")],
    events: [
      event(current.id, "created", "", "2026-01-01T00:00:00Z"),
      event(
        "i-1",
        "updated",
        "item recorded",
        "2026-01-10T00:00:00Z",
        "onboarding_items",
      ),
    ],
    states: new Map([
      ["W-001", state("Items outstanding", ["w1-clearance"])],
      ["W-002", state("Every item recorded")],
    ]),
    itemsByRef: new Map([
      [
        "W-001",
        [item("w1-clearance", "owner"), item("w3-code-of-conduct", "both")],
      ],
    ]),
  });

  it("puts current workers first, past workers after them with the end date, each with its file", () => {
    const rows = workersIndexRows(s);
    expect(rows.map((r) => [r.section, r.worker_ref, r.ended_on])).toEqual([
      ["current", "W-001", ""],
      ["past", "W-002", "2026-06-30"],
    ]);
    expect(rows[0].file).toBe("workers/W-001.csv");
    expect(rows[0].outstanding).toBe(1);
    expect(Object.keys(rows[0])).toEqual([...CSV_COLUMNS.workers_index]);
  });

  it("writes the items with their state, the clearance with its numbers and the trail, and no note from the row", () => {
    const rows = workerFileRows(s, "W-001");
    expect(rows.map((r) => r.kind)).toEqual([
      "item",
      "item",
      "clearance",
      "event",
      "event",
    ]);
    expect(rows[0]).toMatchObject({
      item_id: "w1-clearance",
      state: "outstanding",
    });
    expect(rows[1]).toMatchObject({
      item_id: "w3-code-of-conduct",
      state: "done, waiting for confirmation",
      done_on: "2026-01-02",
    });
    expect(rows[2]).toMatchObject({
      clearance_number: "WWC1234567",
      application_number: "APP-9",
      state: "clearance",
    });
    expect(rows[3].event).toBe("staff_matrix: created");
    expect(rows[4].event).toBe("onboarding_items: updated");
    for (const r of rows)
      expect(Object.keys(r)).toEqual([...CSV_COLUMNS.worker_file]);
    expect(toCsv(CSV_COLUMNS.worker_file, rows)).not.toContain(
      "a private note",
    );
    expect(workerFileRows(s, "W-404")).toEqual([]);
  });

  it("words an item's state from its row", () => {
    expect(itemState({ who: "owner" }, null)).toBe("outstanding");
    expect(
      itemState(
        { who: "owner" },
        { done_on: "2026-01-01", confirmed_on: null },
      ),
    ).toBe("done");
    expect(
      itemState({ who: "both" }, { done_on: "2026-01-01", confirmed_on: null }),
    ).toBe("done, waiting for confirmation");
    expect(
      itemState(
        { who: "both" },
        { done_on: "2026-01-01", confirmed_on: "2026-01-02" },
      ),
    ).toBe("confirmed");
  });
});

describe("the pack's worker files (AC-5, finding 114)", () => {
  it("names the index, one file per worker and the two lists, every header inside csv.ts and no fill column", () => {
    const s = snapshot({
      rows: [staff("W-001"), staff("W-002", { ended_on: "2026-06-30" })],
      clearances: [clearance("W-001")],
      // REQ-024 C (FR-11): an entry rides the worker file in the pinned columns, for the owner's pack and the link's alike.
      entries: [
        {
          id: "e-1",
          account_id: ACC,
          worker_ref: "W-001",
          kind: "supervision",
          held_on: "2026-09-01",
          by_ref: "KP-1",
          note: "Covered the roster.",
          outcome: null,
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
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
    });
    const files = packWorkerFiles(s, "2026-10-17", () => "23(7)");
    expect(Object.keys(files).sort()).toEqual([
      "risk-assessed-roles-2026-10-17.csv",
      "screening-list-2026-10-17.csv",
      "workers/W-001.csv",
      "workers/W-002.csv",
      "workers/index.csv",
    ]);
    const lists = Object.values(CSV_COLUMNS).flat() as string[];
    for (const [name, csv] of Object.entries(files)) {
      const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
      const header = (name.startsWith("workers/") ? lines[0] : lines[1]).split(
        ",",
      );
      for (const h of header) {
        expect(lists, `${name}: ${h}`).toContain(h);
        expect(h, name).not.toMatch(/name|birth|address/);
      }
      if (!name.startsWith("workers/"))
        expect(lines[0]).toContain("This is a draft of the information");
    }
    expect(files["screening-list-2026-10-17.csv"]).toContain("WWC1234567");
    expect(files["screening-list-2026-10-17.csv"]).not.toContain("[Full name]");
    expect(files["workers/W-001.csv"]).toContain(
      "supervision,supervision,,KP-1,,2026-09-01",
    );
    expect(files["workers/W-002.csv"]).not.toContain("supervision,");
  });
});

describe("the supervision entries in a worker's file (REQ-024 C, FR-11, AC-9)", () => {
  const entry = (
    id: string,
    extra: Partial<SupervisionEntryRow>,
  ): SupervisionEntryRow => ({
    id,
    account_id: ACC,
    worker_ref: "W-003",
    kind: "supervision",
    held_on: "2026-09-01",
    by_ref: "KP-1",
    note: "Covered the roster.",
    outcome: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...extra,
  });
  const w3 = staff("W-003", { last_supervision_on: "2026-10-05" });
  const s = snapshot({
    rows: [w3, staff("W-004")],
    entries: [
      entry("e1", {}),
      entry("e2", {
        kind: "probation-review",
        held_on: "2026-10-05",
        by_ref: "W-002",
        note: "",
        outcome: "continued",
      }),
      entry("e3", { worker_ref: "W-004", held_on: "2026-10-02" }),
    ],
    events: [
      event(
        "e2",
        "created",
        "probation-review on 2026-10-05 by W-002",
        "2026-10-05T03:00:00Z",
        "supervision_entries",
      ),
    ],
  });

  it("both entries appear with kind, date and supervisor code, oldest first, and the row's date is the later one", () => {
    const rows = workerFileRows(s, "W-003").filter(
      (r) => r.kind === "supervision",
    );
    expect(
      rows.map((r) => [r.item_id, r.done_on, r.who, r.state, r.note]),
    ).toEqual([
      ["supervision", "2026-09-01", "KP-1", "", "Covered the roster."],
      ["probation-review", "2026-10-05", "W-002", "continued", ""],
    ]);
    expect(w3.last_supervision_on).toBe("2026-10-05");
    // The other worker's entry stays in the other worker's file.
    expect(
      workerFileRows(s, "W-004").filter((r) => r.kind === "supervision"),
    ).toHaveLength(1);
  });

  it("the entries' trail lines join the worker's file and the columns stay the pinned list", () => {
    const rows = workerFileRows(s, "W-003");
    expect(rows.filter((r) => r.kind === "event").map((r) => r.event)).toEqual([
      "supervision_entries: created",
    ]);
    for (const r of rows)
      expect(Object.keys(r).sort()).toEqual(
        [...CSV_COLUMNS.worker_file].sort(),
      );
    const files = packWorkerFiles(s, "2026-10-18");
    expect(files["workers/W-003.csv"]).toContain("probation-review,");
  });
});

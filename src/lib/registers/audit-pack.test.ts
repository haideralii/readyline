// @vitest-environment node
/** REQ-020 FR-1, FR-10: the pack's columns, dates, states, names and cover sheet. */
import { describe, expect, it } from "vitest";
import {
  PACK_HIDDEN_COLUMNS,
  auditPackFileName,
  auditorVisibleIncidents,
  lastEntryDate,
  packColumns,
  packIntro,
  packLine,
  packStateWord,
  trailRows,
} from "./audit-pack";
import { CSV_COLUMNS, toCsv } from "./csv";
import { renderCoverSheet } from "./audit-pack-pdf";

describe("the audit pack's rules", () => {
  it("words the three states without a score or a promise", () => {
    expect(packStateWord("filled")).toBe("present");
    expect(packStateWord("overdue")).toBe("incomplete");
    expect(packStateWord("missing")).toBe("missing");
  });

  it("exports every stored column but the hidden ones, in the stored order", () => {
    const rows = [
      {
        id: "1",
        account_id: "a",
        created_by: "u",
        title: "x",
        review_on: "2026-01-01",
      },
    ];
    expect(packColumns(rows)).toEqual(["title", "review_on"]);
    expect(packColumns([])).toEqual([]);
  });

  // Retro review of REQ-018 to 021, finding 35 (PO decision 35; D-2407 as
  // amended): the worker checks file in the pack and the auditor's view (both
  // read `CSV_COLUMNS.worker_clearances`) carry the check number, because the
  // Worker Screening Rules s 18(3)(d) list it and it is not a name; the
  // worker stays a code and no name column exists to leak.
  it("carries the worker check number to the pack and the auditor, with the worker's code and never a name", () => {
    const columns = CSV_COLUMNS.worker_clearances;
    expect(columns).toContain("clearance_number");
    expect(columns).toContain("worker_ref");
    expect(PACK_HIDDEN_COLUMNS).not.toContain("clearance_number");
    for (const c of columns) expect(c).not.toMatch(/name|email|phone|dob/);
    const csv = toCsv(columns, [
      {
        id: "11111111-1111-4111-8111-111111111111",
        account_id: "a",
        worker_ref: "W-1",
        role_label: "Support worker",
        clearance_kind: "ndis-worker-screening",
        clearance_number: "WWC1234567",
        issued_on: "2026-01-01",
        expires_on: "2031-01-01",
        state: "NSW",
        status: "current",
        note: "",
        created_at: "2026-01-01T03:00:00Z",
        updated_at: "2026-01-01T03:00:00Z",
      },
    ]);
    expect(csv).toContain("clearance_number");
    expect(csv).toContain(
      "W-1,Support worker,ndis-worker-screening,WWC1234567",
    );
    expect(csv).not.toContain("11111111-1111");
  });

  it("finds the latest date on any row, by the date columns a register carries", () => {
    expect(
      lastEntryDate([
        { occurred_on: "2026-10-01", created_at: "2026-10-02T03:00:00Z" },
        { occurred_on: "2026-10-09", created_at: "2026-10-09T03:00:00Z" },
      ]),
    ).toBe("2026-10-09");
    expect(lastEntryDate([{ note: "no dates" }])).toBeNull();
    expect(lastEntryDate([])).toBeNull();
  });

  it("names the record from the audit-day list and counts its rows", () => {
    const l = packLine("incidents", [{ occurred_on: "2026-10-09" }], "filled");
    expect(l).toEqual({
      id: "incidents",
      name: "Incident register",
      rows: 1,
      lastEntry: "2026-10-09",
      state: "present",
    });
    expect(packLine("nope", [], "missing").name).toBe("nope");
  });

  it("names the zip from the trading name and the date, and says what the pack is", () => {
    expect(auditPackFileName("Sunrise Supports & Co.", "2026-10-15")).toBe(
      "audit-pack-sunrise-supports-co-2026-10-15.zip",
    );
    expect(auditPackFileName("!!!", "2026-10-15")).toBe(
      "audit-pack-provider-2026-10-15.zip",
    );
    expect(packIntro("Sunrise Supports", "2026-10-15")).toMatch(
      /^Audit pack for Sunrise Supports, prepared on 2026-10-15\./,
    );
  });

  it("renders a cover sheet as a PDF, paginating a long table", async () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({
      id: `r${i}`,
      name: `Record ${i}`,
      rows: i,
      lastEntry: null,
      state: "missing" as const,
    }));
    const pdf = await renderCoverSheet({
      tradingName: "Sunrise Supports",
      date: "2026-10-15",
      lines,
      files: ["incidents-2026-10-15.csv"],
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  });

  // Retro review of REQ-020, finding 30: what an auditor sees is the
  // register, and a draft or rejected report is not in it (FR-5, D-2231).
  it("keeps a draft and a rejected report out of the auditor's incidents", () => {
    const rows = [
      { reference: "INC-0001", status: "open" },
      { reference: "INC-0002", status: "draft" },
      { reference: "INC-0003", status: "rejected" },
      { reference: "INC-0004", status: "closed" },
      { reference: "INC-0005", status: "under-review" },
    ];
    expect(auditorVisibleIncidents(rows).map((r) => r.reference)).toEqual([
      "INC-0001",
      "INC-0004",
      "INC-0005",
    ]);
    expect(auditorVisibleIncidents([])).toEqual([]);
  });

  // Retro finding 25: the audit-day registers' shared trail is one file in
  // the pack, each line naming its register and the row as its list does;
  // the row id never leaves the server.
  it("writes the shared trail with the register's title and the row's label, never the row id", () => {
    const events = [
      {
        register: "corporate_risks",
        row_id: "11111111-1111-4111-8111-111111111111",
        at: "2026-10-14T03:00:00Z",
        kind: "created",
        note: "",
      },
      {
        register: "corporate_risks",
        row_id: "11111111-1111-4111-8111-111111111111",
        at: "2026-10-15T03:00:00Z",
        kind: "reviewed",
        note: "Checked the generator.",
      },
      {
        register: "staff_matrix",
        row_id: "22222222-2222-4222-8222-222222222222",
        at: "2026-10-15T04:00:00Z",
        kind: "note",
        note: "Row since deleted.",
      },
    ];
    const labels = new Map([
      [
        "corporate_risks",
        new Map([["11111111-1111-4111-8111-111111111111", "Power failure"]]),
      ],
      ["staff_matrix", new Map<string, string>()],
    ]);
    const titles = new Map([
      ["corporate_risks", "Corporate risks"],
      ["staff_matrix", "Staff matrix"],
    ]);
    const rows = trailRows(events, labels, titles);
    expect(rows).toEqual([
      {
        register: "Corporate risks",
        row: "Power failure",
        at: "2026-10-14T03:00:00Z",
        kind: "created",
        note: "",
      },
      {
        register: "Corporate risks",
        row: "Power failure",
        at: "2026-10-15T03:00:00Z",
        kind: "reviewed",
        note: "Checked the generator.",
      },
      {
        register: "Staff matrix",
        row: "",
        at: "2026-10-15T04:00:00Z",
        kind: "note",
        note: "Row since deleted.",
      },
    ]);
    const csv = toCsv(CSV_COLUMNS.register_events, rows);
    expect(csv).toContain("register,row,at,kind,note");
    expect(csv).not.toContain("11111111-1111");
  });
});

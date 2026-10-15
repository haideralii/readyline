// @vitest-environment node
/**
 * Spreadsheet import rules (REQ-020 FR-8, FR-12, SR-3): the template is
 * our export's header; the CSV parser takes quotes, doubled quotes, CRLF
 * and a byte-order mark; the preview runs every row through the form's
 * schema and the participant-data detector, lists each failure with its
 * row number and reason, refuses the whole file when the columns are
 * wrong or more than half the rows fail, and never writes.
 */
import { describe, expect, it } from "vitest";
import { lintText } from "@/lib/copy-lint/rules";
import {
  IMPORT_COLUMNS,
  IMPORT_LIMITS,
  IMPORT_REGISTERS,
  IMPORT_SLUGS,
  MOST_ROWS_FAILED,
  canUndoImport,
  importTemplate,
  parseCsv,
  previewImport,
} from "./import";

const INCIDENT_HEADER = IMPORT_COLUMNS.incidents.join(",");
const incident = (over: Partial<Record<string, string>> = {}) => {
  const cells: Record<string, string> = {
    occurred_on: "2026-09-01",
    reported_on: "2026-09-01",
    category: "near-miss",
    severity: "low",
    participant_ref: "P-014",
    worker_ref: "W-3",
    summary: "Wet floor by the back door; nobody fell.",
    actions_taken: "Sign put out and the mop moved.",
    reportable: "false",
    reportable_notified_on: "",
    commission_reference: "",
    status: "open",
    closed_on: "",
    ...over,
  };
  return IMPORT_COLUMNS.incidents.map((c) => cells[c] ?? "").join(",");
};

describe("the template and the parser", () => {
  it("every register's template is the header row in our export's column names, with a byte-order mark for spreadsheets", () => {
    for (const r of IMPORT_REGISTERS) {
      const t = importTemplate(r);
      expect(t.startsWith("﻿"), r).toBe(true);
      expect(t.replace(/^﻿/, "").trim(), r).toBe(IMPORT_COLUMNS[r].join(","));
      expect(IMPORT_SLUGS[r], r).toMatch(/^[a-z-]+$/);
    }
  });

  it("parses quoted commas, doubled quotes, line breaks inside a field, CRLF and a BOM, and drops a trailing blank line", () => {
    const text =
      '﻿a,b,c\r\n1,"two, with comma","say ""hi"""\r\n"multi\nline",,x\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["1", "two, with comma", 'say "hi"'],
      ["multi\nline", "", "x"],
    ]);
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("a,b\n")).toEqual([["a", "b"]]);
  });
});

describe("the preview (FR-8)", () => {
  it("imports every row of a file in our column names and maps each cell to the database row", () => {
    const text = `${INCIDENT_HEADER}\n${incident()}\n${incident({
      occurred_on: "2026-09-02",
      reported_on: "2026-09-03",
      category: "medication",
      severity: "medium",
      reportable: "yes",
      reportable_notified_on: "2026-09-03",
      status: "closed",
      closed_on: "2026-09-10",
    })}\n`;
    const p = previewImport("incidents", text);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.passed).toBe(2);
    expect(p.failed).toBe(0);
    expect(p.rows.map((r) => r.n)).toEqual([1, 2]);
    expect(p.rows[0].row).toMatchObject({
      occurred_on: "2026-09-01",
      aware_on: "2026-09-01",
      category: "near-miss",
      participant_ref: "P-014",
      worker_ref: "W-3",
      reportable: false,
      reportable_notified_on: null,
      closed_on: null,
      status: "open",
    });
    expect(p.rows[1].row).toMatchObject({
      reportable: true,
      reportable_notified_on: "2026-09-03",
      status: "closed",
      closed_on: "2026-09-10",
    });
    expect(p.rows[0].label).toBe("2026-09-01");
  });

  it("a name in a free-text field fails that row with its reason and the other rows pass (AC-5, SR-3)", () => {
    const text = `${INCIDENT_HEADER}\n${incident()}\n${incident({
      summary: "Jane Citizen slipped in the kitchen.",
    })}\n${incident({ occurred_on: "2026-09-05", reported_on: "2026-09-05" })}\n`;
    const p = previewImport("incidents", text);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.passed).toBe(2);
    expect(p.failed).toBe(1);
    const bad = p.rows.find((r) => !r.ok)!;
    expect(bad.n).toBe(2);
    expect(bad.row).toBeNull();
    expect(bad.reasons).toEqual([
      "summary: looks like a name, a date of birth, an NDIS number or an address; use a code",
    ]);
  });

  it("a schema failure names the column and the form's plain message; an NDIS number fails too", () => {
    const text = `${INCIDENT_HEADER}\n${incident({
      reported_on: "2026-08-30",
    })}\n${incident()}\n${incident({ summary: "Participant 430123456 fell." })}\n${incident()}\n`;
    const p = previewImport("incidents", text);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.failed).toBe(2);
    expect(p.rows[0].reasons).toContain(
      "reported_on: The report date cannot be before the date it happened",
    );
    expect(p.rows[2].reasons.join(" ")).toMatch(/NDIS/);
    const choice = previewImport(
      "incidents",
      `${INCIDENT_HEADER}\n${incident({ category: "fall" })}\n${incident()}\n`,
    );
    expect(choice.ok && choice.rows[0].reasons).toEqual([
      "category: Choose what happened",
    ]);
    for (const r of [...p.rows, ...(choice.ok ? choice.rows : [])])
      for (const reason of r.reasons)
        expect(lintText(reason, { block: true }), reason).toEqual([]);
  });

  it("refuses the whole file when the columns do not match the template (FR-12)", () => {
    const wrong = `date,what\n2026-09-01,fell\n`;
    const p = previewImport("incidents", wrong);
    expect(p.ok).toBe(false);
    if (p.ok) return;
    expect(p.message.startsWith(MOST_ROWS_FAILED)).toBe(true);
    expect(p.message).toMatch(/missing occurred_on/);
    expect(p.message).toMatch(/unexpected date, what/);
    // Our own export carries a header in another case: accepted.
    const upper = `${INCIDENT_HEADER.toUpperCase()}\n${incident()}\n`;
    expect(previewImport("incidents", upper).ok).toBe(true);
  });

  it("refuses the whole file when more than half the rows fail, so a wrong spreadsheet never imports a handful of garbage rows (FR-12)", () => {
    const text = `${INCIDENT_HEADER}\n${incident({ category: "x" })}\n${incident(
      {
        category: "y",
      },
    )}\n${incident()}\n`;
    const p = previewImport("incidents", text);
    expect(p).toEqual({ ok: false, message: `${MOST_ROWS_FAILED}.` });
    // Exactly half failing is allowed through with the failures listed.
    const half = `${INCIDENT_HEADER}\n${incident({ category: "x" })}\n${incident()}\n`;
    expect(previewImport("incidents", half).ok).toBe(true);
  });

  it("refuses an empty file, a header with nothing under it, and more than the row and size limits", () => {
    expect(previewImport("incidents", "").ok).toBe(false);
    expect(previewImport("incidents", `${INCIDENT_HEADER}\n`).ok).toBe(false);
    const many = `${INCIDENT_HEADER}\n${Array.from(
      { length: IMPORT_LIMITS.rows + 1 },
      () => incident(),
    ).join("\n")}\n`;
    const p = previewImport("incidents", many);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toMatch(/501 rows; the limit is 500/);
    const big = "x".repeat(IMPORT_LIMITS.bytes + 1);
    expect(previewImport("incidents", big)).toMatchObject({ ok: false });
  });

  it("the other three registers round-trip one row each through their own schema", () => {
    const complaints = `${IMPORT_COLUMNS.complaints.join(",")}\n2026-09-01,phone,FAM-2,Pickup was late twice.,Roster changed.,2026-09-02,2026-09-05,resolved\n`;
    const c = previewImport("complaints", complaints);
    expect(c.ok && c.rows[0].row).toMatchObject({
      received_on: "2026-09-01",
      channel: "phone",
      from_ref: "FAM-2",
      status: "resolved",
      resolved_on: "2026-09-05",
    });
    const checks = `${IMPORT_COLUMNS.worker_clearances.join(",")}\nw-3,support worker,wwcc,WWC1234567E,2025-01-10,2030-01-10,NSW,\n`;
    const w = previewImport("worker_clearances", checks);
    expect(w.ok && w.rows[0].row).toMatchObject({
      worker_ref: "W-3",
      clearance_kind: "wwcc",
      clearance_number: "WWC1234567E",
      state: "NSW",
      note: "",
    });
    const risks = `${IMPORT_COLUMNS.corporate_risks.join(",")}\nfinance,A claim for a support not delivered.,low,Claims match the notes.,Owner,2027-03-01\n`;
    const r = previewImport("corporate_risks", risks);
    expect(r.ok && r.rows[0].row).toMatchObject({
      area: "finance",
      likelihood: "low",
      owner_role: "Owner",
      review_on: "2027-03-01",
    });
    expect(r.ok && r.rows[0].label).toBe("finance");
  });
});

describe("undo (FR-12)", () => {
  it("is open for an hour from the import and closed after", () => {
    const at = "2026-10-15T09:00:00.000Z";
    expect(canUndoImport(at, new Date("2026-10-15T09:59:59Z"))).toBe(true);
    expect(canUndoImport(at, new Date("2026-10-15T10:00:00Z"))).toBe(true);
    expect(canUndoImport(at, new Date("2026-10-15T10:00:01Z"))).toBe(false);
  });
});

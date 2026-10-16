/**
 * CSV for the register exports (REQ-009 FR-6): UTF-8 with a byte-order mark
 * so Excel opens it with the right encoding, CRLF line ends, every field
 * quoted when it needs to be, dates as YYYY-MM-DD (never reformatted), and
 * a leading apostrophe stripped so a cell can never become a formula.
 */
export const CSV_BOM = "﻿";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  // A cell that starts with =, +, -, @ would run as a formula in a spreadsheet.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  columns: readonly string[],
  rows: readonly Record<string, unknown>[],
): string {
  const lines = [columns.map(cell).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

/** The column order per register; the same names as the database columns, references first. */
export const CSV_COLUMNS = {
  incidents: [
    "reference",
    "occurred_on",
    "reported_on",
    "category",
    "severity",
    "participant_ref",
    "worker_ref",
    "summary",
    "actions_taken",
    "reportable",
    "notify_by",
    "reportable_notified_on",
    "commission_reference",
    "reported_via",
    "logged_by_ref",
    "aware_at",
    "status",
    "closed_on",
    "created_at",
    "updated_at",
  ],
  incident_events: ["reference", "at", "kind", "note"],
  complaints: [
    "reference",
    "received_on",
    "channel",
    "from_ref",
    "summary",
    "outcome",
    "acknowledged_on",
    "resolved_on",
    "status",
    "created_at",
    "updated_at",
  ],
  complaint_events: ["reference", "at", "kind", "note"],
  /** The audit-day registers' shared trail in the pack (REQ-020 FR-1; retro finding 25): the register, the row as its list names it, then the line. */
  register_events: ["register", "row", "at", "kind", "note"],
  worker_clearances: [
    "worker_ref",
    "role_label",
    "clearance_kind",
    // Retro review of REQ-018 to 021, finding 35 (PO decision 35; D-2407 as
    // amended): the check number travels in the owner's export, the audit
    // pack and the auditor's view, because the Worker Screening Rules
    // s 18(3)(d) list it and it is not a name. Names never do; the worker is
    // its code.
    "clearance_number",
    "issued_on",
    "expires_on",
    "state",
    "status",
    "note",
    "created_at",
    "updated_at",
  ],
  policy_reviews: [
    "document_type_id",
    "title",
    "adopted_on",
    "review_cycle_months",
    "last_reviewed_on",
    "next_review_on",
    "status",
    "reviewer_ref",
    "note",
    "created_at",
    "updated_at",
  ],
} as const;

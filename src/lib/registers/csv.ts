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

/**
 * REQ-024 FR-6a: a file whose first line is a sentence (the draft notice the
 * Rules lists carry), then the header and the rows. The sentence is one
 * quoted cell so a spreadsheet shows it whole on its own row.
 */
export function toCsvWithFirstLine(
  firstLine: string,
  columns: readonly string[],
  rows: readonly Record<string, unknown>[],
  labels: Readonly<Record<string, string>> = {},
): string {
  const body = toCsv(columns, rows, labels).slice(CSV_BOM.length);
  return `${CSV_BOM}${cell(firstLine)}\r\n${body}`;
}

export function toCsv(
  columns: readonly string[],
  rows: readonly Record<string, unknown>[],
  /** A header shown under another name than its column (`CSV_HEADER_LABELS`). */
  labels: Readonly<Record<string, string>> = {},
): string {
  const lines = [columns.map((c) => cell(labels[c] ?? c)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

/**
 * REQ-024 A0 (D-2432, findings 234 and 244): the policy review row's
 * `adopted_on` is the type's first adoption (the function's upsert keeps
 * it), while the version column and the document control file carry the
 * latest adopted version's day, so the two dates in one zip are each named.
 */
export const CSV_HEADER_LABELS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  policy_reviews: { adopted_on: "first adopted on" },
};

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
    // REQ-024 A1 (D-2419; finding 109): the application number, s 18(3)(d)(i), and the day the database was checked.
    "application_number",
    "verified_in_database_on",
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
  // REQ-024 A3 (FR-6, FR-6a, FR-6c; finding 114): the worker tables and the
  // two Rules lists. No column is a name, a date of birth or an address: the
  // fill (FR-6b) adds its columns to a direct download only, never here.
  staff_matrix: [
    "worker_ref",
    "role",
    "role_label",
    "states",
    "risk_assessed",
    "risk_assessed_from",
    "risk_paragraph",
    "works_with_children",
    "may_use_restrictive_practice",
    "started_on",
    "ended_on",
    "qualifications",
    "last_supervision_on",
    "last_appraisal_on",
    "onboarding_signed_on",
    "role_ref",
  ],
  onboarding_checklists: ["subject_ref", "kind", "started_on", "completed_on"],
  onboarding_items: [
    "worker_ref",
    "item_id",
    "owner_role",
    "done_on",
    "confirmed_on",
    "recorded_by_owner",
  ],
  onboarding_ticks: ["worker_ref", "item_id", "ticked_on", "ticked_by_ref"],
  risk_assessed_roles: [
    "title",
    "paragraphs",
    "description",
    "assessed_on",
    "assessor_ref",
    "first_held_on",
    "seed_code",
  ],
  screening_exceptions: [
    "worker_ref",
    "code",
    "part4_state",
    "started_on",
    "verified_on",
    "notice_seen_on",
    "supervisor_ref",
    "declaration_on",
    "plan_register_date",
    "ended_on",
    "end_code",
  ],
  // FR-6a, s 18: one row per risk assessed worker as at the date, numbers and codes only.
  screening_list: [
    "worker_ref",
    "role",
    "role_label",
    "risk_assessed_from",
    "ended_on",
    "application_number",
    "clearance_number",
    "outcome",
    "issued_on",
    "expires_on",
    "verified_in_database_on",
    "decision_code",
    "decision_on",
    "exception_code",
    "exception_started_on",
    "exception_ended_on",
    "exception_end_code",
    "exception_supervisor_ref",
    "exception_part4",
  ],
  // FR-6: one worker file, items, clearances, exceptions and the trail as rows of one table.
  worker_file: [
    "kind",
    "item_id",
    "text",
    "who",
    "state",
    "done_on",
    "confirmed_on",
    "recorded_by_owner",
    "clearance_kind",
    "application_number",
    "clearance_number",
    "issued_on",
    "expires_on",
    "verified_in_database_on",
    "decision_code",
    "decision_on",
    "at",
    "event",
    "note",
  ],
  workers_index: [
    "section",
    "worker_ref",
    "role",
    "role_label",
    "states",
    "risk_assessed",
    "started_on",
    "ended_on",
    "state",
    "outstanding",
    "file",
  ],
} as const;

/**
 * Spreadsheet import for four registers (REQ-020 FR-8, FR-12, SR-3): a CSV
 * whose header row uses exactly our export's column names becomes rows
 * through the same zod schemas and the same participant-data detector as
 * the forms. Pure: parse, map, validate; the server action writes what
 * passes. Limits: 500 rows, 1 MB, and the whole file is refused when more
 * than half of its rows fail (a wrong-column spreadsheet never imports a
 * handful of garbage rows).
 */
import { z } from "zod";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import {
  CommissionChangeForm,
  CorporateRiskForm,
  StaffMatrixForm,
} from "./audit-day-forms";
import { ComplaintForm, IncidentForm, WorkerCheckForm } from "./forms";

export const IMPORT_REGISTERS = [
  "incidents",
  "complaints",
  "worker_clearances",
  "corporate_risks",
  // REQ-023 FR-10 (Session D).
  "commission_changes",
  // REQ-024 Session C (FR-13; D-2285): the staff matrix with its A1 columns; items are derived after the import, never imported.
  "staff_matrix",
] as const;
export type ImportRegister = (typeof IMPORT_REGISTERS)[number];

/** The register slug in the URL for each importable table. */
export const IMPORT_SLUGS: Record<ImportRegister, string> = {
  incidents: "incidents",
  complaints: "complaints",
  worker_clearances: "worker-checks",
  corporate_risks: "corporate-risks",
  commission_changes: "commission-changes",
  staff_matrix: "staff-matrix",
};

export const IMPORT_LIMITS = {
  rows: 500,
  bytes: 1_000_000,
  /** Imports an hour per account (SR-4). */
  perHour: 5,
  /** The owner can undo an import for this long (FR-12). */
  undoHours: 1,
} as const;

export const MOST_ROWS_FAILED =
  "Most rows did not pass; check the column names against the template";
/** REQ-024 FR-13: a worker code once per file (the register keys on it). */
export const DUPLICATE_CODE_IN_FILE =
  "this worker code is on an earlier row of the file";

/** The columns a file carries, by register: our export's names, minus what the system fills (references, computed dates, timestamps). */
export const IMPORT_COLUMNS: Record<ImportRegister, readonly string[]> = {
  incidents: [
    "occurred_on",
    "reported_on",
    "category",
    "severity",
    "participant_ref",
    "worker_ref",
    "summary",
    "actions_taken",
    "reportable",
    "reportable_notified_on",
    "commission_reference",
    "status",
    "closed_on",
  ],
  complaints: [
    "received_on",
    "channel",
    "from_ref",
    "summary",
    "outcome",
    "acknowledged_on",
    "resolved_on",
    "status",
  ],
  worker_clearances: [
    "worker_ref",
    "role_label",
    "clearance_kind",
    "clearance_number",
    "issued_on",
    "expires_on",
    "state",
    "note",
    // REQ-024 A1 (finding 109): the template follows the register's columns; the two new ones come last so a spreadsheet made from the old template still imports.
    "application_number",
    "verified_in_database_on",
  ],
  corporate_risks: [
    "area",
    "what_could_happen",
    "likelihood",
    "controls",
    "owner_role",
    "review_on",
  ],
  // REQ-024 FR-13 (D-2830): the export's columns minus what the system fills (role_ref, risk_assessed_from); states as "NSW;VIC" or "NSW,VIC"; note and qualifications imported, capped and refused on a participant shape.
  staff_matrix: [
    "worker_ref",
    "role",
    "role_label",
    "states",
    "risk_assessed",
    "risk_paragraph",
    "works_with_children",
    "may_use_restrictive_practice",
    "started_on",
    "ended_on",
    "qualifications",
    "last_supervision_on",
    "last_appraisal_on",
    "onboarding_signed_on",
    "note",
  ],
  // REQ-023 FR-10: the register's own columns, less the code and the timestamps the system fills.
  commission_changes: [
    "kind",
    "change_type",
    "happened_on",
    "aware_on",
    "notified_on",
    "channel",
    "approved_form",
    "applied_on",
    "decided_on",
    "effective_on",
    "commission_reference",
    "note",
  ],
};

/** The free-text columns the detector reads (a name, a date of birth, an NDIS number or an address fails the row). */
const FREE_TEXT: Record<ImportRegister, readonly string[]> = {
  incidents: ["summary", "actions_taken"],
  complaints: ["summary", "outcome"],
  worker_clearances: ["role_label", "note"],
  corporate_risks: ["what_could_happen", "controls", "owner_role"],
  // REQ-023 SR-1: the refusal rule applies to both fields.
  commission_changes: ["commission_reference", "note"],
  staff_matrix: ["role_label", "qualifications", "note"],
};

/**
 * REQ-024 FR-13 (D-2285): a role title or a qualification reads like a name
 * to the detector's capitalised-words rule ("Cert III Individual Support"),
 * so those two columns are read for a date of birth, an NDIS number, an
 * address and health words alone; the note is read for everything.
 */
const NAME_RULE_OFF: Partial<Record<ImportRegister, readonly string[]>> = {
  staff_matrix: ["role_label", "qualifications"],
};

/** The empty template: the header row only. */
export function importTemplate(register: ImportRegister): string {
  return `﻿${IMPORT_COLUMNS[register].join(",")}\r\n`;
}

/**
 * RFC 4180 as spreadsheets write it: comma-separated, fields quoted when
 * they hold a comma, a quote or a line break, a doubled quote inside a
 * quoted field, CRLF or LF line ends, an optional byte-order mark.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // CRLF: the LF closes the row.
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // A trailing empty line is not a row.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export type ImportRowResult = {
  /** 1-based data row number (the header is row 0). */
  n: number;
  ok: boolean;
  /** The database row to insert (account_id added by the action). */
  row: Record<string, unknown> | null;
  /** One line per problem, "column: reason". */
  reasons: string[];
  /** A short label for the preview: the first column that names the row. */
  label: string;
};

export type ImportPreview =
  | {
      ok: true;
      rows: ImportRowResult[];
      passed: number;
      failed: number;
    }
  | { ok: false; message: string };

const bool = (v: string) => /^(true|yes|y|1)$/i.test(v.trim());

/** CSV cells (our export's names) to the form's values, per register. */
function toFormValues(
  register: ImportRegister,
  cells: Record<string, string>,
): Record<string, unknown> {
  const s = (k: string) => (cells[k] ?? "").trim();
  switch (register) {
    case "incidents":
      return {
        occurredOn: s("occurred_on"),
        reportedOn: s("reported_on"),
        category: s("category"),
        severity: s("severity"),
        participantRef: s("participant_ref"),
        workerRef: s("worker_ref"),
        summary: s("summary"),
        actionsTaken: s("actions_taken"),
        reportable: bool(s("reportable")),
        reportableNotifiedOn: s("reportable_notified_on"),
        commissionReference: s("commission_reference"),
        status: s("status") || "open",
        closedOn: s("closed_on"),
        // Session B's aware date: the form defaults it to the occurred date (retro finding 23).
        awareOn: "",
      };
    case "complaints":
      return {
        receivedOn: s("received_on"),
        channel: s("channel"),
        fromRef: s("from_ref"),
        summary: s("summary"),
        outcome: s("outcome"),
        acknowledgedOn: s("acknowledged_on"),
        resolvedOn: s("resolved_on"),
        status: s("status") || "received",
      };
    case "worker_clearances":
      return {
        workerRef: s("worker_ref"),
        roleLabel: s("role_label"),
        clearanceKind: s("clearance_kind"),
        clearanceNumber: s("clearance_number"),
        applicationNumber: s("application_number"),
        verifiedInDatabaseOn: s("verified_in_database_on"),
        issuedOn: s("issued_on"),
        expiresOn: s("expires_on"),
        state: s("state"),
        note: s("note"),
      };
    case "corporate_risks":
      return {
        area: s("area"),
        what_could_happen: s("what_could_happen"),
        likelihood: s("likelihood"),
        controls: s("controls"),
        owner_role: s("owner_role"),
        review_on: s("review_on"),
      };
    case "commission_changes":
      return Object.fromEntries(
        IMPORT_COLUMNS.commission_changes.map((c) => [c, s(c)]),
      );
    case "staff_matrix":
      return {
        worker_ref: s("worker_ref"),
        role: s("role"),
        role_label: s("role_label"),
        qualifications: s("qualifications"),
        risk_assessed: bool(s("risk_assessed")),
        risk_paragraph: s("risk_paragraph"),
        // The export writes the array as "NSW,VIC"; a spreadsheet may give "NSW;VIC" or "NSW VIC".
        states: s("states").replace(/[;\s]+/g, ","),
        works_with_children: bool(s("works_with_children")),
        may_use_restrictive_practice: bool(s("may_use_restrictive_practice")),
        is_me: false,
        started_on: s("started_on"),
        ended_on: s("ended_on"),
        last_supervision_on: s("last_supervision_on"),
        last_appraisal_on: s("last_appraisal_on"),
        onboarding_signed_on: s("onboarding_signed_on"),
        note: s("note"),
      };
  }
}

/** The parsed form values as the database row the save actions write. */
function toRow(
  register: ImportRegister,
  v: Record<string, unknown>,
): Record<string, unknown> {
  switch (register) {
    case "incidents":
      return {
        occurred_on: v.occurredOn,
        reported_on: v.reportedOn,
        category: v.category,
        severity: v.severity,
        participant_ref: v.participantRef,
        worker_ref: v.workerRef,
        summary: v.summary,
        actions_taken: v.actionsTaken,
        reportable: v.reportable,
        reportable_notified_on: v.reportableNotifiedOn,
        commission_reference: v.commissionReference,
        status: v.status,
        closed_on: v.closedOn,
        aware_on: v.awareOn,
      };
    case "complaints":
      return {
        received_on: v.receivedOn,
        channel: v.channel,
        from_ref: v.fromRef,
        summary: v.summary,
        outcome: v.outcome,
        acknowledged_on: v.acknowledgedOn,
        resolved_on: v.resolvedOn,
        status: v.status,
      };
    case "worker_clearances":
      return {
        worker_ref: v.workerRef,
        role_label: v.roleLabel,
        clearance_kind: v.clearanceKind,
        clearance_number: v.clearanceNumber,
        application_number: v.applicationNumber,
        verified_in_database_on: v.verifiedInDatabaseOn || null,
        issued_on: v.issuedOn || null,
        expires_on: v.expiresOn,
        state: v.state,
        note: v.note,
      };
    case "corporate_risks":
      return { ...v };
    case "commission_changes":
      return { ...v };
    case "staff_matrix": {
      // "This row is me" is the form's alone (FR-1); the import links nobody.
      const { is_me: _isMe, ...row } = v as Record<string, unknown> & {
        is_me?: boolean;
      };
      void _isMe;
      return row;
    }
  }
}

const SCHEMAS: Record<ImportRegister, z.ZodType> = {
  incidents: IncidentForm,
  complaints: ComplaintForm,
  worker_clearances: WorkerCheckForm,
  corporate_risks: CorporateRiskForm,
  commission_changes: CommissionChangeForm,
  staff_matrix: StaffMatrixForm,
};

const LABEL_COLUMN: Record<ImportRegister, string> = {
  incidents: "occurred_on",
  complaints: "received_on",
  worker_clearances: "worker_ref",
  corporate_risks: "area",
  commission_changes: "change_type",
  staff_matrix: "worker_ref",
};

/** The form field a CSV column maps to, for the reasons list. */
function columnOfPath(register: ImportRegister, path: string): string {
  const snake = path.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return IMPORT_COLUMNS[register].includes(snake) ? snake : path;
}

/** Parses, maps and validates one file; never writes. */
export function previewImport(
  register: ImportRegister,
  text: string,
): ImportPreview {
  if (text.length > IMPORT_LIMITS.bytes)
    return {
      ok: false,
      message: "The file is over 1 MB. Split it and try again.",
    };
  const parsed = parseCsv(text);
  if (parsed.length === 0)
    return {
      ok: false,
      message: "The file is empty. Download the template and fill it in.",
    };
  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const expected = IMPORT_COLUMNS[register];
  const missing = expected.filter((c) => !header.includes(c));
  const extra = header.filter((h) => h && !expected.includes(h));
  if (missing.length > 0 || extra.length > 0)
    return {
      ok: false,
      message: `${MOST_ROWS_FAILED}: ${missing.length ? `missing ${missing.join(", ")}` : ""}${missing.length && extra.length ? "; " : ""}${extra.length ? `unexpected ${extra.join(", ")}` : ""}.`,
    };
  const data = parsed.slice(1);
  if (data.length === 0)
    return {
      ok: false,
      message: "The file has the header row and nothing else.",
    };
  if (data.length > IMPORT_LIMITS.rows)
    return {
      ok: false,
      message: `The file has ${data.length} rows; the limit is ${IMPORT_LIMITS.rows}. Split it and try again.`,
    };
  const seenCodes = new Set<string>();
  const rows: ImportRowResult[] = data.map((cellsArray, i) => {
    const cells: Record<string, string> = {};
    header.forEach((h, j) => {
      cells[h] = cellsArray[j] ?? "";
    });
    const values = toFormValues(register, cells);
    const reasons: string[] = [];
    // FR-13: the staff matrix keys on the code, so a code twice in one file fails its second row here rather than the whole insert.
    if (register === "staff_matrix") {
      const code = (cells.worker_ref ?? "")
        .trim()
        .toUpperCase()
        .replace(/^W-?/, "W-");
      if (code && seenCodes.has(code))
        reasons.push(`worker_ref: ${DUPLICATE_CODE_IN_FILE}`);
      seenCodes.add(code);
    }
    const result = SCHEMAS[register].safeParse(values);
    if (!result.success)
      for (const issue of result.error.issues)
        reasons.push(
          `${columnOfPath(register, String(issue.path[0] ?? ""))}: ${issue.message}`,
        );
    for (const col of FREE_TEXT[register]) {
      const value = cells[col] ?? "";
      const namesOff = NAME_RULE_OFF[register]?.includes(col) ?? false;
      const hits = value
        ? detectParticipantData(value).filter(
            (w) => !(namesOff && w.kind === "name"),
          )
        : [];
      if (hits.length > 0)
        reasons.push(
          `${col}: looks like a name, a date of birth, an NDIS number or an address; use a code`,
        );
    }
    return {
      n: i + 1,
      ok: reasons.length === 0,
      row:
        reasons.length === 0 && result.success
          ? toRow(register, result.data as Record<string, unknown>)
          : null,
      reasons,
      label: (cells[LABEL_COLUMN[register]] ?? "").trim() || `row ${i + 1}`,
    };
  });
  const failed = rows.filter((r) => !r.ok).length;
  // FR-12: more than half failing means the columns are wrong, not the rows.
  if (failed * 2 > rows.length)
    return { ok: false, message: `${MOST_ROWS_FAILED}.` };
  return { ok: true, rows, passed: rows.length - failed, failed };
}

/** True while the owner may still undo an import (FR-12). */
export function canUndoImport(createdAt: string, now: Date): boolean {
  return (
    now.getTime() - Date.parse(createdAt) <= IMPORT_LIMITS.undoHours * 3_600_000
  );
}

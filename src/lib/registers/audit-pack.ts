/**
 * The audit pack's rules (REQ-020 FR-1, FR-10), pure: what goes in the zip
 * and under which names, which columns a register's rows export, the last
 * entry date of a register, and the cover sheet's table (each record with
 * its row count, last entry and state, in the audit-day order). No scores,
 * no "ready", no promise about the outcome (FR-10).
 */
import { AUDIT_DAY_RECORDS } from "./names";

export type PackState = "present" | "incomplete" | "missing";

export type PackLine = {
  id: string;
  name: string;
  rows: number;
  lastEntry: string | null;
  state: PackState;
};

/** The audit-day ask states as the cover sheet words them. */
export function packStateWord(
  askState: "filled" | "missing" | "overdue",
): PackState {
  if (askState === "filled") return "present";
  if (askState === "overdue") return "incomplete";
  return "missing";
}

/**
 * Columns never written to a pack file or shown to an auditor: the ids and
 * the creator. The worker check number is not one of them (retro review of
 * REQ-018 to 021, finding 35; D-2407 as amended): the Worker Screening Rules
 * s 18(3)(d) list it and it is not a name, so the pack and the auditor's
 * view carry it with the worker's code.
 */
export const PACK_HIDDEN_COLUMNS: readonly string[] = [
  "id",
  "account_id",
  "created_by",
  "version_set_id",
  "version_id",
];

/** The columns of a register's rows in their stored order, minus the hidden ones. */
export function packColumns(
  rows: readonly Record<string, unknown>[],
): string[] {
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first).filter((k) => !PACK_HIDDEN_COLUMNS.includes(k));
}

const DATE_KEYS = [
  "occurred_on",
  "received_on",
  "issued_on",
  "decided_on",
  "started_on",
  "completed_on",
  "created_at",
  "updated_at",
];

/** The latest date on any row, as YYYY-MM-DD, or null for an empty register. */
export function lastEntryDate(
  rows: readonly Record<string, unknown>[],
): string | null {
  let best: string | null = null;
  for (const r of rows)
    for (const k of DATE_KEYS) {
      const v = r[k];
      if (typeof v !== "string" || !v) continue;
      const d = v.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      if (!best || d > best) best = d;
    }
  return best;
}

export function packLine(
  id: string,
  rows: readonly Record<string, unknown>[],
  askState: "filled" | "missing" | "overdue",
): PackLine {
  return {
    id,
    name: AUDIT_DAY_RECORDS.find((r) => r.id === id)?.name ?? id,
    rows: rows.length,
    lastEntry: lastEntryDate(rows),
    state: packStateWord(askState),
  };
}

/** The file name of the zip: the trading name as a slug and the date. */
export function auditPackFileName(tradingName: string, stamp: string): string {
  const slug =
    tradingName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "provider";
  return `audit-pack-${slug}-${stamp}.zip`;
}

/** The sentence the cover sheet and the auditor page open with. */
export function packIntro(tradingName: string, date: string): string {
  return `Audit pack for ${tradingName}, prepared on ${date}. Every register as a file, the document control register, the readiness summary and the adopted documents.`;
}

/**
 * Retro review of REQ-020, finding 30: a report through the link is a draft
 * until the owner confirms it and a rejected one never joins the register
 * (FR-5, D-2231), so neither reaches the auditor's view or the pack. The
 * overview and the register totals apply the same rule.
 */
export const INCIDENT_STATUSES_NOT_IN_REGISTER: readonly string[] = [
  "draft",
  "rejected",
];

export function auditorVisibleIncidents<T extends { status: string }>(
  rows: readonly T[],
): T[] {
  return rows.filter(
    (r) => !INCIDENT_STATUSES_NOT_IN_REGISTER.includes(r.status),
  );
}

export type TrailEvent = {
  register: string;
  row_id: string;
  at: string;
  kind: string;
  note: string;
};

export type TrailRow = {
  register: string;
  row: string;
  at: string;
  kind: string;
  note: string;
};

/**
 * The shared trail as the pack's `register-events` file (FR-1 "including
 * the events trails"; retro finding 25): one line per event with the
 * register's name and the row as its own list names it, because the row's
 * id never leaves the server (`PACK_HIDDEN_COLUMNS`). `labels` maps a
 * register's stored name to each row id's label; an event whose row is gone
 * keeps an empty row label rather than being dropped.
 */
export function trailRows(
  events: readonly TrailEvent[],
  labels: ReadonlyMap<string, ReadonlyMap<string, string>>,
  titles: ReadonlyMap<string, string>,
): TrailRow[] {
  return events.map((e) => ({
    register: titles.get(e.register) ?? e.register,
    row: labels.get(e.register)?.get(e.row_id) ?? "",
    at: e.at,
    kind: e.kind,
    note: e.note,
  }));
}

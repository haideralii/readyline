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

/** Columns never written to a pack file or shown to an auditor. */
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

/**
 * REQ-032 FR-5 (D-2921): where a five-business-day window landed past a
 * public holiday, the date line says which holiday moved it, in brackets,
 * one sentence; past the table's last year it says holidays are not yet
 * counted (FR-6). The 24-hour kinds carry no bracket, since no holiday
 * moves them (D-2920). One helper, so the register, the row page, the
 * account page's due-soon line and the auditor's view read the same words.
 */
import {
  addBusinessDaysDetailed,
  businessDaysBracket,
} from "./public-holidays";
import { HARM_SEVERITIES, RESTRICTIVE_PRACTICE_BUSINESS_DAYS } from "./status";
import {
  INCIDENT_CATEGORIES_5BD,
  type IncidentCategory,
  type IncidentSeverity,
} from "./types";

export type NotifyByRow = {
  occurred_on: string;
  aware_on?: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  reportable: boolean;
  notify_by: string | null;
};

/** The day the clock runs from: the later of the event and the day the provider became aware. */
export function notifyClockFrom(
  row: Pick<NotifyByRow, "occurred_on" | "aware_on">,
): string {
  return row.aware_on && row.aware_on > row.occurred_on
    ? row.aware_on
    : row.occurred_on;
}

/** The bracket for the row's notify-by date, or null when nothing moved it or the window is 24 hours. */
export function notifyByBracket(
  row: NotifyByRow,
  states: readonly string[],
): string | null {
  if (!row.reportable || !row.notify_by) return null;
  if (!INCIDENT_CATEGORIES_5BD.includes(row.category)) return null;
  if (HARM_SEVERITIES.includes(row.severity)) return null;
  return businessDaysBracket(
    addBusinessDaysDetailed(
      notifyClockFrom(row),
      RESTRICTIVE_PRACTICE_BUSINESS_DAYS,
      states,
    ),
  );
}

/** "13 Apr 2026 (Good Friday and Easter Monday do not count)": the date as the caller formats it, then the bracket. */
export function notifyByWords(
  row: NotifyByRow,
  states: readonly string[],
  format: (iso: string) => string = (iso) => iso,
): string {
  if (!row.notify_by) return "";
  const bracket = notifyByBracket(row, states);
  return `${format(row.notify_by)}${bracket ? ` ${bracket}` : ""}`;
}

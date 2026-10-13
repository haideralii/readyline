/**
 * Pure status rules for the registers (REQ-009 FR-2), the same arithmetic as
 * the status views and the `incident_notify_by` function in
 * supabase/migrations/20261013000000_registers.sql, so a page can show a
 * status without a round trip and a reminder job can reason about dates.
 *
 * Dates are ISO `YYYY-MM-DD` strings and all arithmetic is in UTC on
 * calendar days, so daylight-saving changes never move a boundary.
 */
import {
  INCIDENT_CATEGORIES_5BD,
  INCIDENT_CATEGORIES_24H,
  type IncidentCategory,
  type IncidentSeverity,
} from "./types";

/** Severities that count as harm to the participant for the restrictive-practice window (batch 26 item 2). */
export const HARM_SEVERITIES: readonly IncidentSeverity[] = ["medium", "high"];

export type ClearanceStatus = "valid" | "expiring" | "expired";
export type ReviewStatus = "not-adopted" | "current" | "due-soon" | "overdue";
export type IncidentNotificationStatus =
  "not-reportable" | "notification-due" | "overdue-notification" | "notified";

/** Days before expiry at which a clearance counts as expiring (FR-2). */
export const CLEARANCE_EXPIRING_DAYS = 90;
/** Days before the review date at which a policy review counts as due soon (FR-2). */
export const REVIEW_DUE_SOON_DAYS = 60;
/** Business days the Commission allows for an unauthorised restrictive practice (Rules s 21). */
export const RESTRICTIVE_PRACTICE_BUSINESS_DAYS = 5;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD` to a UTC day number; throws on anything else. */
export function parseIsoDate(value: string): number {
  const m = ISO_DATE.exec(value);
  if (!m) throw new Error(`Not an ISO date: ${value}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d
  )
    throw new Error(`Not a calendar date: ${value}`);
  return Math.floor(ms / 86_400_000);
}

export function formatIsoDate(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return parseIsoDate(to) - parseIsoDate(from);
}

export function addDays(date: string, days: number): string {
  return formatIsoDate(parseIsoDate(date) + days);
}

/**
 * `date` plus `days` business days, Monday to Friday, matching the SQL
 * `add_business_days`: a weekend start counts from the next Monday; public
 * holidays are not modelled.
 */
export function addBusinessDays(date: string, days: number): string {
  if (!Number.isInteger(days) || days < 0)
    throw new Error("addBusinessDays: days must be a whole number >= 0");
  let day = parseIsoDate(date);
  let left = days;
  while (left > 0) {
    day += 1;
    // Day 0 (1970-01-01) was a Thursday; weekday 0 = Sunday.
    const weekday = (((day + 4) % 7) + 7) % 7;
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return formatIsoDate(day);
}

/**
 * The date by which the Commission must be told, as the database generates
 * it: the next day for the five 24-hour kinds; for an unauthorised
 * restrictive practice the next day when it caused harm (severity medium or
 * high) and five business days when low (Commission page, verified 13 Oct
 * 2026, D-902); null when not reportable or when the category has no window.
 */
export function incidentNotifyBy(
  occurredOn: string,
  category: IncidentCategory,
  reportable: boolean,
  severity: IncidentSeverity,
): string | null {
  if (!reportable) return null;
  if (INCIDENT_CATEGORIES_24H.includes(category)) return addDays(occurredOn, 1);
  if (INCIDENT_CATEGORIES_5BD.includes(category))
    return HARM_SEVERITIES.includes(severity)
      ? addDays(occurredOn, 1)
      : addBusinessDays(occurredOn, RESTRICTIVE_PRACTICE_BUSINESS_DAYS);
  return null;
}

/** `expired` after the expiry date, `expiring` from 90 days before it to the day itself, else `valid`; no expiry is always valid. */
export function clearanceStatus(
  expiresOn: string | null,
  today: string,
): ClearanceStatus {
  if (expiresOn === null) return "valid";
  const left = daysBetween(today, expiresOn);
  if (left < 0) return "expired";
  if (left <= CLEARANCE_EXPIRING_DAYS) return "expiring";
  return "valid";
}

/** `overdue` after the review date, `due-soon` from 60 days before it to the day itself, else `current`; `not-adopted` without a date. */
export function reviewStatus(
  nextReviewOn: string | null,
  today: string,
): ReviewStatus {
  if (nextReviewOn === null) return "not-adopted";
  const left = daysBetween(today, nextReviewOn);
  if (left < 0) return "overdue";
  if (left <= REVIEW_DUE_SOON_DAYS) return "due-soon";
  return "current";
}

/** Where a reportable incident stands with the Commission (FR-2 `overdue-notification`). */
export function incidentNotificationStatus(
  incident: {
    reportable: boolean;
    notify_by: string | null;
    reportable_notified_on: string | null;
  },
  today: string,
): IncidentNotificationStatus {
  if (!incident.reportable || incident.notify_by === null)
    return "not-reportable";
  if (incident.reportable_notified_on !== null) return "notified";
  return daysBetween(today, incident.notify_by) < 0
    ? "overdue-notification"
    : "notification-due";
}

/** The FR-2 rules under one name. */
export const registerStatus = {
  clearance: clearanceStatus,
  review: reviewStatus,
  incident: incidentNotificationStatus,
  notifyBy: incidentNotifyBy,
} as const;

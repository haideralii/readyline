import {
  addBusinessDays,
  addDays,
  formatIsoDate,
  parseIsoDate,
} from "@/lib/registers/status";

/**
 * Dates a signed-in spec types, computed from the runner's day in the
 * product's calendar, Australia/Sydney (D-2242), never fixed: a fixed date
 * near the day the spec was written expires when the calendar passes it
 * (`registers.spec.ts` typed 9 October 2026 and read "Notify by 16 October"
 * until the morning of 17 October, when the row was overdue; #87 run
 * 38985514628, D-2272). The arithmetic is the product's own
 * (`src/lib/registers/status.ts`): calendar days in UTC on ISO dates,
 * business days Monday to Friday with no public holidays.
 */
export { addBusinessDays, addDays };

export function todaySydney(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** `iso` less `days` business days: the day a spec says something happened, so its notify-by lands ahead of today. */
export function minusBusinessDays(iso: string, days: number): string {
  let day = parseIsoDate(iso);
  let left = days;
  while (left > 0) {
    day -= 1;
    // Day 0 (1 January 1970) was a Thursday; weekday 0 is Sunday.
    const weekday = (((day + 4) % 7) + 7) % 7;
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return formatIsoDate(day);
}

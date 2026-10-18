/**
 * Public holidays in the business-day count (REQ-032; D-2914 to D-2918).
 * The Acts Interpretation Act 1901 s 2B reads a business day as a day that
 * is not a Saturday, a Sunday or a public holiday "in the place concerned";
 * the place is the account's states, and with more than one a day counts
 * as a holiday only when it is one in every state named (D-2916, the safe
 * side). The table is data/public-holidays/<year>.json, typed from the
 * eight government pages named in source.json; the loader refuses a row
 * outside the closed list (SR-2). Past the table's last year the count is
 * weekends only and says so (FR-6).
 */
import { z } from "zod";
import holidays2026 from "../../../data/public-holidays/2026.json";
import holidays2027 from "../../../data/public-holidays/2027.json";
import sourceJson from "../../../data/public-holidays/source.json";
import { formatIsoDate, parseIsoDate } from "./iso-date";

export const JURISDICTIONS = [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "ACT",
  "NT",
] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const HolidayRow = z
  .object({
    date: z.string().regex(ISO),
    jurisdiction: z.enum(JURISDICTIONS),
    name: z.string().min(1).max(80),
    note: z.string().max(240).optional(),
  })
  .strict();
export type HolidayRow = z.infer<typeof HolidayRow>;

const YearFile = z
  .object({
    year: z.number().int().min(2020).max(2100),
    holidays: z.array(HolidayRow),
  })
  .strict()
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.holidays.forEach((row, i) => {
      if (!row.date.startsWith(`${file.year}-`))
        ctx.addIssue({
          code: "custom",
          path: ["holidays", i, "date"],
          message: `not in ${file.year}`,
        });
      const day = parseIsoDate(row.date);
      if (formatIsoDate(day) !== row.date)
        ctx.addIssue({
          code: "custom",
          path: ["holidays", i, "date"],
          message: "not a calendar date",
        });
      const key = `${row.date}|${row.jurisdiction}`;
      if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["holidays", i],
          message: "repeated date and jurisdiction",
        });
      seen.add(key);
    });
  });
export type HolidayYearFile = z.infer<typeof YearFile>;

/** Parses one year file; throws with the row named when the file is not the table's shape (SR-2). */
export function parseHolidayYear(input: unknown): HolidayYearFile {
  return YearFile.parse(input);
}

/** The table, every year file parsed at load (SR-2), oldest year first. */
export const PUBLIC_HOLIDAYS: readonly HolidayYearFile[] = [
  holidays2026,
  holidays2027,
]
  .map((f) => parseHolidayYear(f))
  .sort((a, b) => a.year - b.year);

export const HOLIDAY_YEARS: readonly number[] = PUBLIC_HOLIDAYS.map(
  (f) => f.year,
);
export const FIRST_HOLIDAY_YEAR = HOLIDAY_YEARS[0];
export const LAST_HOLIDAY_YEAR = HOLIDAY_YEARS[HOLIDAY_YEARS.length - 1];

/** source.json as data: the pages, the licences, the read dates, what was left out and what is UNVERIFIED. */
export const PUBLIC_HOLIDAY_SOURCE = sourceJson;

/** Every row across the years, in date order. */
export const HOLIDAY_ROWS: readonly HolidayRow[] = PUBLIC_HOLIDAYS.flatMap(
  (f) => f.holidays,
);

/** date -> jurisdiction -> name. */
const BY_DATE: ReadonlyMap<string, ReadonlyMap<Jurisdiction, string>> = (() => {
  const m = new Map<string, Map<Jurisdiction, string>>();
  for (const r of HOLIDAY_ROWS) {
    const inner = m.get(r.date) ?? new Map<Jurisdiction, string>();
    inner.set(r.jurisdiction, r.name);
    m.set(r.date, inner);
  }
  return m;
})();

export function isJurisdiction(value: string): value is Jurisdiction {
  return (JURISDICTIONS as readonly string[]).includes(value);
}

/** The account's states that are jurisdictions in the table, in the table's order, each once. */
export function holidayStates(states: readonly string[]): Jurisdiction[] {
  const set = new Set(
    states.map((s) => s.toUpperCase()).filter(isJurisdiction),
  );
  return JURISDICTIONS.filter((j) => set.has(j));
}

/** True when the table covers the day's year. */
export function holidaysKnownFor(date: string): boolean {
  const year = Number(date.slice(0, 4));
  return HOLIDAY_YEARS.includes(year);
}

/**
 * The holiday's name when `date` is a public holiday in every one of
 * `states` (D-2916), named as the first state names it; null when it is not,
 * when `states` names no jurisdiction, or when the year is outside the table.
 */
export function publicHolidayIn(
  date: string,
  states: readonly string[],
): string | null {
  const js = holidayStates(states);
  if (js.length === 0) return null;
  const onDay = BY_DATE.get(date);
  if (!onDay) return null;
  for (const j of js) if (!onDay.has(j)) return null;
  return onDay.get(js[0]) ?? null;
}

export type BusinessDaysResult = {
  /** The date reached. */
  date: string;
  /** The public holidays skipped on the way, in date order (FR-5). */
  skipped: { date: string; name: string }[];
  /** True when a day stepped over lies past the table's last year, so its holidays were not counted (FR-6). */
  beyondTable: boolean;
};

/**
 * `date` plus `days` business days: Monday to Friday, less the public
 * holidays of `states` (none when `states` names no jurisdiction), matching
 * the SQL `add_business_days(p_date, p_days, p_states)`. A weekend or
 * holiday start counts from the next business day.
 */
export function addBusinessDaysDetailed(
  date: string,
  days: number,
  states: readonly string[] = [],
): BusinessDaysResult {
  if (!Number.isInteger(days) || days < 0)
    throw new Error("addBusinessDays: days must be a whole number >= 0");
  const js = holidayStates(states);
  let day = parseIsoDate(date);
  let left = days;
  const skipped: { date: string; name: string }[] = [];
  let beyondTable = false;
  while (left > 0) {
    day += 1;
    const iso = formatIsoDate(day);
    // Day 0 (1970-01-01) was a Thursday; weekday 0 = Sunday.
    const weekday = (((day + 4) % 7) + 7) % 7;
    if (weekday === 0 || weekday === 6) continue;
    if (js.length > 0) {
      if (!holidaysKnownFor(iso)) {
        if (Number(iso.slice(0, 4)) > LAST_HOLIDAY_YEAR) beyondTable = true;
      } else {
        const name = publicHolidayIn(iso, js);
        if (name) {
          skipped.push({ date: iso, name });
          continue;
        }
      }
    }
    left -= 1;
  }
  return { date: formatIsoDate(day), skipped, beyondTable };
}

/** "Good Friday and Easter Monday" from the skipped list, each name once, in order. */
export function skippedNames(skipped: readonly { name: string }[]): string {
  const names = [...new Set(skipped.map((s) => s.name))];
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * FR-5 and FR-6: the bracket after a date line, or null when nothing moved
 * it. One sentence: the holidays that did not count, or, past the table,
 * that holidays after its last year are not yet counted.
 */
export function businessDaysBracket(r: BusinessDaysResult): string | null {
  if (r.beyondTable)
    return `(public holidays after ${LAST_HOLIDAY_YEAR} are not yet counted)`;
  if (r.skipped.length === 0) return null;
  const names = skippedNames(r.skipped);
  const plural = new Set(r.skipped.map((s) => s.name)).size > 1;
  return `(${names} ${plural ? "do" : "does"} not count)`;
}

/** The day from which the next year's table is due (FR-6, D-2918): 1 October of the table's last year. */
export const HOLIDAY_TABLE_DUE_FROM = `${LAST_HOLIDAY_YEAR}-10-01`;

/** True from 1 October of the table's last year, so a test fails before the year runs out (FR-6). */
export function holidayTableRunsOut(today: string): boolean {
  return today >= HOLIDAY_TABLE_DUE_FROM;
}

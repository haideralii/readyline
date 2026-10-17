/**
 * The period filter (REQ-023 Session B, FR-5, SR-3; D-2340), pure and free
 * of server imports so the proxy can run it at the edge: one query shape for
 * the four REQ-009 registers, their exports, the audit pack, the audit-day
 * page and the auditor link. The shape is a closed list, `all`, `period`
 * (from the current registration period's first day), `since-last-audit`
 * (from the last-audit date) and `custom` with two ISO dates, `from` not
 * after `to` and at most ten years apart; anything else is refused with no
 * echo. Nothing here is stored (FR-5). Bounds are inclusive calendar days.
 */
import { addMonths, formatLongDate } from "./status";

export const PERIOD_KINDS = [
  "all",
  "period",
  "since-last-audit",
  "custom",
] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

/** A custom range spans at most this many years (FR-5). */
export const PERIOD_MAX_YEARS = 10;
/** The query parameters the filter reads; every other parameter belongs to the page. */
export const PERIOD_PARAM_KEYS = ["period", "from", "to"] as const;

/** The date column the period reads per register (the Data table of REQ-023). */
export const PERIOD_COLUMNS = {
  incidents: "occurred_on",
  complaints: "received_on",
  worker_clearances: "issued_on",
  policy_reviews: "last_reviewed_on",
  // REQ-024 Session C (FR-11; D-2832): the supervision history in the pack's workers folder.
  supervision_entries: "held_on",
} as const;
export type PeriodRegister = keyof typeof PERIOD_COLUMNS;

/** The paths whose pages and routes take the period; a malformed one answers 400 at the proxy (SR-3, AC-9). */
export const PERIOD_ROUTES = [
  "/registers",
  "/path/audit-day",
  "/auditor",
] as const;

export function periodGuarded(pathname: string): boolean {
  return PERIOD_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export type PeriodSelection =
  | { kind: "all" | "period" | "since-last-audit" }
  | { kind: "custom"; from: string; to: string };

export type PeriodRefusal =
  "kind" | "dates" | "order" | "span" | "extra" | "repeat";

export type PeriodParse =
  | { ok: true; selection: PeriodSelection | null }
  | { ok: false; reason: PeriodRefusal };

/** The raw search parameters as Next.js hands them to a page. */
export type RawPeriodParams = Record<string, string | string[] | undefined>;

/** A real calendar day as YYYY-MM-DD (30 February is refused). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === m - 1 &&
    t.getUTCDate() === d
  );
}

/**
 * The shape alone, no account context: `selection` is null when the query
 * names no period (the surface's default applies), a refusal otherwise.
 */
export function parsePeriodParams(params: RawPeriodParams): PeriodParse {
  const { period, from, to } = params;
  if ([period, from, to].some((v) => Array.isArray(v)))
    return { ok: false, reason: "repeat" };
  if (period === undefined)
    return from === undefined && to === undefined
      ? { ok: true, selection: null }
      : { ok: false, reason: "extra" };
  if (!(PERIOD_KINDS as readonly string[]).includes(period as string))
    return { ok: false, reason: "kind" };
  const kind = period as PeriodKind;
  if (kind !== "custom")
    return from === undefined && to === undefined
      ? { ok: true, selection: { kind } }
      : { ok: false, reason: "extra" };
  if (!isIsoDate(from) || !isIsoDate(to)) return { ok: false, reason: "dates" };
  if (from > to) return { ok: false, reason: "order" };
  if (to > addMonths(from, PERIOD_MAX_YEARS * 12))
    return { ok: false, reason: "span" };
  return { ok: true, selection: { kind: "custom", from, to } };
}

/** The same parse over a URL's search parameters (the proxy and the routes). */
export function parsePeriodSearch(search: URLSearchParams): PeriodParse {
  const raw: RawPeriodParams = {};
  for (const key of PERIOD_PARAM_KEYS) {
    const all = search.getAll(key);
    if (all.length > 1) raw[key] = all;
    else if (all.length === 1) raw[key] = all[0];
  }
  return parsePeriodParams(raw);
}

/** What the account knows: the current period's first day and its last-audit date, or null. */
export type PeriodContext = {
  periodStart: string | null;
  lastAuditOn: string | null;
};

/** The resolved period the queries read: inclusive bounds, either side open. */
export type Period = {
  kind: PeriodKind;
  from: string | null;
  to: string | null;
};

export const ALL_PERIOD: Period = { kind: "all", from: null, to: null };

/** The surface's default when the query names no period: the register pages "all"; the pack, the audit-day page and the auditor page "period" (D-2305). */
export type PeriodDefault = "all" | "period";

export type ResolvedPeriod = {
  period: Period;
  /** Set when the query asked for a date the account has not entered; the period then falls back to "all" and the page says so. */
  unavailable: "period" | "since-last-audit" | null;
};

export function resolvePeriod(
  selection: PeriodSelection | null,
  ctx: PeriodContext,
  fallback: PeriodDefault,
): ResolvedPeriod {
  const kind = selection?.kind ?? fallback;
  if (kind === "all") return { period: ALL_PERIOD, unavailable: null };
  if (kind === "custom" && selection?.kind === "custom")
    return {
      period: { kind, from: selection.from, to: selection.to },
      unavailable: null,
    };
  if (kind === "period") {
    if (!ctx.periodStart)
      return { period: ALL_PERIOD, unavailable: selection ? "period" : null };
    return {
      period: { kind, from: ctx.periodStart, to: null },
      unavailable: null,
    };
  }
  if (!ctx.lastAuditOn)
    return {
      period: ALL_PERIOD,
      unavailable: selection ? "since-last-audit" : null,
    };
  return {
    period: { kind: "since-last-audit", from: ctx.lastAuditOn, to: null },
    unavailable: null,
  };
}

/** Parse and resolve in one call for a page or a route; `ok: false` is the malformed query (400). */
export function periodFromParams(
  params: RawPeriodParams,
  ctx: PeriodContext,
  fallback: PeriodDefault,
): ({ ok: true } & ResolvedPeriod) | { ok: false; reason: PeriodRefusal } {
  const parsed = parsePeriodParams(params);
  if (!parsed.ok) return parsed;
  return { ok: true, ...resolvePeriod(parsed.selection, ctx, fallback) };
}

/** The context the pages build from the current `registration_periods` row, or none. */
export function periodContextFrom(
  period: { period_starts_on: string; last_audit_on: string | null } | null,
): PeriodContext {
  return {
    periodStart: period?.period_starts_on ?? null,
    lastAuditOn: period?.last_audit_on ?? null,
  };
}

/**
 * Whether a row's date falls in the period (the pure twin of the query's
 * filter, for the "what changed" summary and the tests). D-2340 A: a row with
 * no date in the column stays in every view, since it has no date to fall
 * outside; the selector says how many (`periodUndatedLine`).
 */
export function inPeriod(date: string | null | undefined, p: Period): boolean {
  if (p.kind === "all" || !date) return true;
  const d = date.slice(0, 10);
  if (p.from && d < p.from) return false;
  if (p.to && d > p.to) return false;
  return true;
}

/** The PostgREST filter the queries apply, or null for "all": `col.is.null,and(col.gte.from,col.lte.to)`. */
export function periodFilter(column: string, p: Period): string | null {
  if (p.kind === "all") return null;
  if (p.from && !isIsoDate(p.from))
    throw new Error("period from is not a date");
  if (p.to && !isIsoDate(p.to)) throw new Error("period to is not a date");
  if (p.from && p.to)
    return `${column}.is.null,and(${column}.gte.${p.from},${column}.lte.${p.to})`;
  if (p.from) return `${column}.is.null,${column}.gte.${p.from}`;
  if (p.to) return `${column}.is.null,${column}.lte.${p.to}`;
  return null;
}

/** The words of each choice on the selector. */
export const PERIOD_CHOICE_LABELS: Record<PeriodKind, string> = {
  all: "All",
  period: "This registration period",
  "since-last-audit": "Since the last audit",
  custom: "Choose dates",
};

/** "Showing: <label>" on every filtered surface, the file name's cover sheet and the auditor page. */
export function periodLabel(p: Period): string {
  switch (p.kind) {
    case "all":
      return "All entries";
    case "period":
      return `This registration period (from ${formatLongDate(p.from!)})`;
    case "since-last-audit":
      return `Since the last audit (from ${formatLongDate(p.from!)})`;
    case "custom":
      return `${formatLongDate(p.from!)} to ${formatLongDate(p.to!)}`;
  }
}

/** The line on the cover sheet and the auditor page (FR-5: the cover sheet states the period). */
export function periodShownLine(p: Period): string {
  return `Period shown: ${periodLabel(p)}.`;
}

/** What the export's and the pack's file name carries after the date stamp; nothing for "all". */
export function periodFileSuffix(p: Period): string {
  switch (p.kind) {
    case "all":
      return "";
    case "period":
      return `-this-period-from-${p.from}`;
    case "since-last-audit":
      return `-since-audit-${p.from}`;
    case "custom":
      return `-${p.from}-to-${p.to}`;
  }
}

/**
 * The query string a link carries, "?period=..." or "" for "all" where the
 * surface's default is "all"; a surface whose default is the registration
 * period asks for "all" explicitly (`explicitAll`).
 */
export function periodQuery(
  p: Period,
  options: { explicitAll?: boolean } = {},
): string {
  if (p.kind === "all") return options.explicitAll ? "?period=all" : "";
  if (p.kind === "custom") return `?period=custom&from=${p.from}&to=${p.to}`;
  return `?period=${p.kind}`;
}

/**
 * The one small line under the selector and under a filtered table (D-2318
 * A, the PO's words): the count of rows with no date in the period's column,
 * which stay in every view; no line at zero.
 */
export function periodUndatedLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? "1 entry has no date in this column and is always shown."
    : `${count} entries have no date in this column and are always shown.`;
}

/** The rows of a register with no date in the period's column, for that line. */
export function undatedCount(
  rows: readonly Record<string, unknown>[],
  column: string,
): number {
  return rows.filter((r) => r[column] === null || r[column] === undefined)
    .length;
}

/** D-2318 B: the cover sheet's line under "Period shown". */
export const PERIOD_COUNTS_LINE =
  "The row counts and last entries in the table below are the rows in this period; each record's state is the whole register's.";

/** The line when the URL asked for a date the account has not entered (the period then shows all entries). */
export function periodUnavailableLine(
  which: "period" | "since-last-audit",
): string {
  return which === "since-last-audit"
    ? '"Since the last audit" needs the date of your last audit; enter it on the account page. Showing all entries.'
    : '"This registration period" needs your registration dates; enter them on the account page. Showing all entries.';
}

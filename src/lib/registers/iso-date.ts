/**
 * ISO `YYYY-MM-DD` day arithmetic in UTC (REQ-009), on its own so the
 * public-holiday table (REQ-032) and the status rules can both use it
 * without one importing the other. `status.ts` re-exports both names.
 */
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

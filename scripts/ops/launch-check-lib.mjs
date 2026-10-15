/**
 * Pure helpers for scripts/ops/launch-check.mjs (REQ-022 FR-2), unit tested
 * in launch-check.test.ts. Nothing here prints; the script decides the
 * wording and never includes a value from the environment.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "AUD 399" or "AUD 1,249" to cents; null for anything else. */
export function parseAudCents(text) {
  const m = /AUD\s+([\d,]+)(?:\.(\d{2}))?/.exec(text ?? "");
  if (!m) return null;
  const whole = Number(m[1].replace(/,/g, ""));
  const frac = m[2] ? Number(m[2]) : 0;
  if (!Number.isInteger(whole)) return null;
  return whole * 100 + frac;
}

/** The text inside the first element carrying data-testid="<id>", tags stripped; null when absent. */
export function textOfTestId(html, id) {
  const re = new RegExp(
    `data-testid="${id}"[^>]*>([\\s\\S]*?)<\\/[a-z0-9]+>`,
    "i",
  );
  const m = re.exec(html ?? "");
  if (!m) return null;
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Last updated 12 October 2026" to days before `now`; null when unreadable. */
export function daysSinceUpdated(text, now = new Date()) {
  const m = /(\d{1,2}) ([A-Z][a-z]+) (\d{4})/.exec(text ?? "");
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]);
  if (month < 0) return null;
  const t = Date.UTC(Number(m[3]), month, Number(m[1]));
  return (now.getTime() - t) / 86_400_000;
}

/** True when a response is a permanent redirect from the alias to the same path on the base. */
export function redirectsToBase(status, location, base, path) {
  if (status !== 301 && status !== 308) return false;
  if (!location) return false;
  try {
    const target = new URL(location, base);
    const want = new URL(path, base);
    return target.origin === want.origin && target.pathname === want.pathname;
  } catch {
    return false;
  }
}

/** The checks in the order the script runs them; the names are what it prints. */
export const CHECK_NAMES = [
  "health",
  "csp",
  "legal pages' dates",
  "sign-in form",
  "pricing shows the pack price",
  "pack price equals Stripe's unit_amount",
  "alias redirects to the domain",
];

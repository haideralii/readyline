/**
 * Pure helpers shared by the auth route and actions; unit-tested.
 */

/** Only same-origin absolute paths are accepted as a post-sign-in destination (no open redirects). */
export function safeNextPath(
  value: string | null | undefined,
  fallback = "/account",
): string {
  if (!value) return fallback;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  )
    return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}

/** First address from a forwarded-for list, or null. Used only as a rate-limit key. */
export function clientIp(headers: {
  get(name: string): string | null;
}): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = headers.get("x-real-ip");
  return real ? real.trim().slice(0, 64) : null;
}

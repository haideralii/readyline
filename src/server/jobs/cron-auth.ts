/**
 * Vercel Cron authenticates by sending `Authorization: Bearer <CRON_SECRET>`.
 * The comparison is constant-time and an unset secret means nobody is
 * authorised, so the route is inert until the variable exists (REQ-004 FR-6,
 * Dev response Q3).
 */
import { timingSafeEqual } from "node:crypto";

export function isAuthorisedCronRequest(
  authorizationHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 16) return false;
  const expected = `Bearer ${secret}`;
  const given = authorizationHeader ?? "";
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

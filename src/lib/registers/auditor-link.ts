/**
 * The auditor link's rules (REQ-020 FR-2, SR-1), pure: a 256-bit random
 * token shown to the owner once, stored only as its SHA-256 hex, compared in
 * constant time; an expiry of 24, 48 or 72 hours (72 the default); live
 * means neither revoked nor expired; the banner the signed-out page shows.
 * Nothing here names, lists or recommends an auditor (FR-3, CLAUDE.md 4.4).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const AUDITOR_LINK_HOURS = [24, 48, 72] as const;
export type AuditorLinkHours = (typeof AUDITOR_LINK_HOURS)[number];
export const AUDITOR_LINK_DEFAULT_HOURS: AuditorLinkHours = 72;
export const AUDITOR_TOKEN_BYTES = 32;
/** 32 random bytes as base64url: 43 characters, no padding. */
export const AUDITOR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** Days a revoked or expired row stays before the purge job removes it. */
export const AUDITOR_LINK_RETENTION_DAYS = 30;

export function generateAuditorToken(
  bytes: Uint8Array = randomBytes(AUDITOR_TOKEN_BYTES),
): string {
  return Buffer.from(bytes).toString("base64url");
}

export function hashAuditorToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time equality of two hashes (same length by construction). */
export function hashesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isAuditorLinkHours(value: unknown): value is AuditorLinkHours {
  return (AUDITOR_LINK_HOURS as readonly number[]).includes(Number(value));
}

export function auditorLinkExpiry(now: Date, hours: AuditorLinkHours): Date {
  return new Date(now.getTime() + hours * 3_600_000);
}

export function auditorLinkIsLive(
  row: { expires_at: string; revoked_at: string | null },
  now: Date,
): boolean {
  if (row.revoked_at) return false;
  const t = Date.parse(row.expires_at);
  return Number.isFinite(t) && t > now.getTime();
}

export function auditorLinkPath(token: string): string {
  return `/auditor/${token}`;
}

/** "18 October 2026, 3:04 pm" in Sydney time, the way the banner says it. */
export function formatLinkTime(at: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(at)
    .replace(" at ", ", ");
}

export function auditorBanner(tradingName: string, expiresAt: Date): string {
  return `Read-only view shared by ${tradingName} for its audit; it expires on ${formatLinkTime(expiresAt)}.`;
}

/** The page and the pack route's answer once one address has opened the link sixty times in an hour (retro review of REQ-020, finding 21). */
export const AUDITOR_OPEN_LIMITED_LINE =
  "This link has been opened many times from your connection in the last hour. Wait an hour and open it again.";

/** A viewer's address for the audit log: hashed, never in clear (FR-2). */
export function hashAddress(address: string): string {
  return createHash("sha256")
    .update(address.trim(), "utf8")
    .digest("hex")
    .slice(0, 16);
}

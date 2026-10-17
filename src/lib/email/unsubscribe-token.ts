import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * REQ-022 FR-7, SR-6: the one-click unsubscribe token on a reminder email.
 * Derived, not stored in clear: HMAC-SHA256 of the account id under
 * HASH_PEPPER (256 bits, 64 hex characters), so every reminder carries the
 * same link and the database keeps only its SHA-256. A pepper change
 * orphans the links, as it does the invitations' hashes (D-2238); the next
 * reminder carries the new one. An unknown token answers 404.
 */
export const UNSUBSCRIBE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function unsubscribeToken(accountId: string, pepper: string): string {
  return createHmac("sha256", pepper)
    .update(`unsubscribe:${accountId}`, "utf8")
    .digest("hex");
}

export function hashUnsubscribeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time equality of two 64-character hashes. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function unsubscribeUrl(token: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/email/unsubscribe/${token}`;
}

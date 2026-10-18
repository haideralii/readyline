import "server-only";
/**
 * Our own limiter in front of Supabase's built-in limits (REQ-004 FR-1, SR-3;
 * Dev response Q2, accepted): 5 magic-link requests per email per rolling
 * hour, 20 per IP per rolling hour, and 5 exports per account per hour.
 * Keys never contain an email; the email is hashed under HASH_PEPPER
 * (src/lib/peppered-hash.ts, retro finding 34). Counting happens in one
 * database statement, so two concurrent requests cannot both slip through.
 */
import { hashAddress } from "@/lib/registers/auditor-link";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export { emailHash } from "@/lib/peppered-hash";

export const MAGIC_LINK_LIMITS = {
  perEmail: { limit: 5, windowSeconds: 3600 },
  perIp: { limit: 20, windowSeconds: 3600 },
} as const;

export const EXPORT_LIMIT = { limit: 5, windowSeconds: 3600 } as const;

/** One hit against a key; true while the count for the rolling window is within the limit. */
export async function hitRateLimit(
  key: string,
  limit: { limit: number; windowSeconds: number },
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const r = await admin.rpc("auth_rate_limit_hit", {
    p_key: key,
    p_limit: limit.limit,
    p_window_seconds: limit.windowSeconds,
  });
  if (r.error) throw r.error;
  return r.data !== false;
}

export type RateLimitDecision = { allowed: boolean; reason?: "email" | "ip" };

export async function checkMagicLinkAllowed(input: {
  emailHash: string;
  ip: string | null;
}): Promise<RateLimitDecision> {
  if (
    !(await hitRateLimit(
      `email:${input.emailHash}`,
      MAGIC_LINK_LIMITS.perEmail,
    ))
  )
    return { allowed: false, reason: "email" };
  if (
    input.ip &&
    !(await hitRateLimit(`ip:${input.ip}`, MAGIC_LINK_LIMITS.perIp))
  )
    return { allowed: false, reason: "ip" };
  return { allowed: true };
}

export async function checkExportAllowed(accountId: string): Promise<boolean> {
  return hitRateLimit(`export:${accountId}`, EXPORT_LIMIT);
}

/** REQ-009 SR-3: five register exports per account per rolling hour; sixty register writes per user per minute. */
export const REGISTER_EXPORT_LIMIT = { limit: 5, windowSeconds: 3600 } as const;
export const REGISTER_WRITE_LIMIT = { limit: 60, windowSeconds: 60 } as const;

export async function checkRegisterExportAllowed(
  accountId: string,
): Promise<boolean> {
  return hitRateLimit(`register-export:${accountId}`, REGISTER_EXPORT_LIMIT);
}

export async function checkRegisterWriteAllowed(
  userId: string,
): Promise<boolean> {
  return hitRateLimit(`register-write:${userId}`, REGISTER_WRITE_LIMIT);
}

/** REQ-024 FR-6b (finding 76): ten one-time fills per account per rolling hour, a bucket of its own beside the register export limit the pack and the link spend. */
export const FILL_LIMIT = { limit: 10, windowSeconds: 3600 } as const;

export async function checkFillAllowed(accountId: string): Promise<boolean> {
  return hitRateLimit(`fill:${accountId}`, FILL_LIMIT);
}

/** REQ-033 Session B SR-B3: ten section redrafts per account per rolling hour, beside the daily generation quota each one also spends. */
export const REDRAFT_LIMIT = { limit: 10, windowSeconds: 3600 } as const;

export async function checkRedraftAllowed(accountId: string): Promise<boolean> {
  return hitRateLimit(`redraft:${accountId}`, REDRAFT_LIMIT);
}

/** REQ-007 SR-4: five Checkout Sessions per account per rolling hour. */
export const CHECKOUT_LIMIT = { limit: 5, windowSeconds: 3600 } as const;

export async function checkCheckoutAllowed(
  accountId: string,
): Promise<boolean> {
  return hitRateLimit(`checkout:${accountId}`, CHECKOUT_LIMIT);
}

/**
 * REQ-020 SR-2 (retro review, finding 21): the auditor page and its pack
 * route are signed-out GETs that write a row on every open, so one viewer
 * address gets sixty opens of one link per rolling hour. The key carries
 * the link id and the address's hash (the same hash the audit line holds),
 * never the address itself.
 */
export const AUDITOR_OPEN_LIMIT = { limit: 60, windowSeconds: 3600 } as const;

export function auditorOpenKey(linkId: string, address: string | null) {
  return `auditor-open:${linkId}:${address ? hashAddress(address) : "unknown"}`;
}

export async function checkAuditorOpenAllowed(
  linkId: string,
  address: string | null,
): Promise<boolean> {
  return hitRateLimit(auditorOpenKey(linkId, address), AUDITOR_OPEN_LIMIT);
}

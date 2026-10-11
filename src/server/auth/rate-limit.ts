import "server-only";
/**
 * Our own limiter in front of Supabase's built-in limits (REQ-004 FR-1, SR-3;
 * Dev response Q2, accepted): 5 magic-link requests per email per rolling
 * hour, 20 per IP per rolling hour, and 5 exports per account per hour.
 * Keys never contain an email; the email is hashed. Counting happens in one
 * database statement, so two concurrent requests cannot both slip through.
 */
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const MAGIC_LINK_LIMITS = {
  perEmail: { limit: 5, windowSeconds: 3600 },
  perIp: { limit: 20, windowSeconds: 3600 },
} as const;

export const EXPORT_LIMIT = { limit: 5, windowSeconds: 3600 } as const;

export function emailHash(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}

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

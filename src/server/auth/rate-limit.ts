import "server-only";
/**
 * Our own magic-link limiter in front of Supabase's built-in limits
 * (REQ-004 FR-1, SR-3; Dev response Q2, accepted): 5 requests per email per
 * rolling hour and 20 per IP per rolling hour. Keys never contain an email;
 * the email is hashed. Counting happens in one database statement, so two
 * concurrent requests cannot both slip through.
 */
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const MAGIC_LINK_LIMITS = {
  perEmail: { limit: 5, windowSeconds: 3600 },
  perIp: { limit: 20, windowSeconds: 3600 },
} as const;

export function emailHash(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export type RateLimitDecision = { allowed: boolean; reason?: "email" | "ip" };

export async function checkMagicLinkAllowed(input: {
  emailHash: string;
  ip: string | null;
}): Promise<RateLimitDecision> {
  const admin = createSupabaseAdminClient();
  const email = await admin.rpc("auth_rate_limit_hit", {
    p_key: `email:${input.emailHash}`,
    p_limit: MAGIC_LINK_LIMITS.perEmail.limit,
    p_window_seconds: MAGIC_LINK_LIMITS.perEmail.windowSeconds,
  });
  if (email.error) throw email.error;
  if (email.data === false) return { allowed: false, reason: "email" };
  if (input.ip) {
    const ip = await admin.rpc("auth_rate_limit_hit", {
      p_key: `ip:${input.ip}`,
      p_limit: MAGIC_LINK_LIMITS.perIp.limit,
      p_window_seconds: MAGIC_LINK_LIMITS.perIp.windowSeconds,
    });
    if (ip.error) throw ip.error;
    if (ip.data === false) return { allowed: false, reason: "ip" };
  }
  return { allowed: true };
}

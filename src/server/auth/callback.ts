/**
 * The magic-link callback's two paths (REQ-004 FR-9a), decided by a pure
 * function so both are unit-tested without Supabase:
 * - token hash: the email template links to
 *   /auth/callback?token_hash=...&type=magiclink; `verifyOtp` turns the hash
 *   into a session in whichever browser opens it (any device);
 * - code (legacy, until 2026-10-13): the PKCE exchange, which only works in
 *   the browser that requested the link. Remove with D-423.
 */
import { z } from "zod";
import { parseInput, strictObject } from "@/lib/validation";

export const LEGACY_CODE_PATH_UNTIL = "2026-10-13T23:59:59+11:00";

const TokenHashQuery = strictObject({
  token_hash: z.string().min(16).max(512),
  type: z.enum(["magiclink", "email", "signup", "recovery"]),
  next: z.string().max(512).optional(),
});

const CodeQuery = strictObject({
  code: z.string().min(8).max(512),
  next: z.string().max(512).optional(),
});

export type CallbackDecision =
  | {
      kind: "token_hash";
      tokenHash: string;
      type: "magiclink" | "email" | "signup" | "recovery";
      next?: string;
    }
  | { kind: "code"; code: string; next?: string }
  | { kind: "invalid"; reason: "missing" | "malformed" | "legacy-expired" };

/** Picks the path from the query string; the token-hash path wins when both are present. */
export function decideCallback(
  params: Record<string, string | undefined>,
  now: Date = new Date(),
): CallbackDecision {
  const next = params.next ? { next: params.next } : {};
  if (params.token_hash !== undefined || params.type !== undefined) {
    const parsed = parseInput(TokenHashQuery, {
      token_hash: params.token_hash,
      type: params.type,
      ...next,
    });
    return parsed.ok
      ? {
          kind: "token_hash",
          tokenHash: parsed.data.token_hash,
          type: parsed.data.type,
          ...(parsed.data.next ? { next: parsed.data.next } : {}),
        }
      : { kind: "invalid", reason: "malformed" };
  }
  if (params.code !== undefined) {
    if (now.getTime() > new Date(LEGACY_CODE_PATH_UNTIL).getTime())
      return { kind: "invalid", reason: "legacy-expired" };
    const parsed = parseInput(CodeQuery, { code: params.code, ...next });
    return parsed.ok
      ? {
          kind: "code",
          code: parsed.data.code,
          ...(parsed.data.next ? { next: parsed.data.next } : {}),
        }
      : { kind: "invalid", reason: "malformed" };
  }
  return { kind: "invalid", reason: "missing" };
}

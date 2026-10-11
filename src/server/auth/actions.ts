"use server";
/**
 * Sign-in and sign-out (REQ-004 FR-1, FR-8). The magic-link request returns
 * the same message whether the address is known, unknown or rate limited
 * (AC-1, AC-6), and nothing that reaches a log contains the email.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { SupabaseEnvError } from "@/server/supabase/env";
import { checkMagicLinkAllowed, emailHash } from "./rate-limit";
import { clientIp, safeNextPath } from "./paths";

const RequestSchema = strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter the email address you use for your business")
    .max(254),
  next: z.string().max(512).optional(),
});

const GENERIC_MESSAGE =
  "If that address can sign in, a link is on its way. Check your inbox and spam folder; the link works once and expires.";

export type RequestMagicLinkResponse =
  | { ok: true; message: string }
  | { ok: false; fieldErrors: Record<string, string[]>; formErrors: string[] };

export async function requestMagicLink(
  input: unknown,
): Promise<RequestMagicLinkResponse> {
  const parsed = parseInput(RequestSchema, input);
  if (!parsed.ok)
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };

  const hash = emailHash(parsed.data.email);
  const ip = clientIp(await headers());
  try {
    const decision = await checkMagicLinkAllowed({ emailHash: hash, ip });
    if (!decision.allowed) {
      log.warn("auth.magic-link.rate-limited", {
        emailHash: hash,
        reason: decision.reason,
      });
      return { ok: true, message: GENERIC_MESSAGE };
    }
    const supabase = await createSupabaseServerClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const next = safeNextPath(parsed.data.next);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });
    if (error)
      log.warn("auth.magic-link.failed", {
        emailHash: hash,
        code: error.code ?? error.name,
      });
    else log.info("auth.magic-link.sent", { emailHash: hash });
  } catch (e) {
    if (e instanceof SupabaseEnvError) {
      return {
        ok: false,
        fieldErrors: {},
        formErrors: ["Sign-in is not available in this environment yet."],
      };
    }
    log.error("auth.magic-link.error", { emailHash: hash, error: e });
  }
  return { ok: true, message: GENERIC_MESSAGE };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function signOutEverywhere(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/");
}

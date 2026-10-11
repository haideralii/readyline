"use server";
/**
 * TOTP enrolment and verification for the admin role (REQ-004 FR-7). Runs
 * with the cookie-bound server client, so a successful verify writes the
 * aal2 session back into the cookies and no Supabase call happens in the
 * browser. Every step is recorded in audit_log.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { readAdminContext, writeAdminAudit } from "./access";

export type EnrolResponse =
  | { ok: true; factorId: string; qrCodeSvg: string; secret: string }
  | { ok: false; message: string };

export async function startTotpEnrolment(): Promise<EnrolResponse> {
  const ctx = await readAdminContext();
  if (!ctx) return { ok: false, message: "Not available." };
  // Drop abandoned, unverified factors so the enrolment starts clean.
  const factors = await ctx.supabase.auth.mfa.listFactors();
  for (const f of factors.data?.totp ?? []) {
    if (f.status !== "verified")
      await ctx.supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const enrol = await ctx.supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Readyline admin",
  });
  if (enrol.error || !enrol.data) {
    log.warn("admin.mfa.enrol.failed", {
      userId: ctx.user.id,
      code: enrol.error?.code ?? "unknown",
    });
    return {
      ok: false,
      message:
        "Could not start enrolment. Check that TOTP is enabled for the project.",
    };
  }
  await writeAdminAudit(
    ctx.user.id,
    "admin.mfa.enrolment-started",
    enrol.data.id,
  );
  return {
    ok: true,
    factorId: enrol.data.id,
    qrCodeSvg: enrol.data.totp.qr_code,
    secret: enrol.data.totp.secret,
  };
}

const VerifySchema = strictObject({
  factorId: z.string().min(1).max(128),
  code: z
    .string()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

export type VerifyResponse = { ok: false; message: string } | never;

export async function verifyTotp(input: unknown): Promise<VerifyResponse> {
  const parsed = parseInput(VerifySchema, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: parsed.fieldErrors.code?.[0] ?? "Check the code and try again.",
    };
  const ctx = await readAdminContext();
  if (!ctx) return { ok: false, message: "Not available." };

  const challenge = await ctx.supabase.auth.mfa.challenge({
    factorId: parsed.data.factorId,
  });
  if (challenge.error || !challenge.data)
    return { ok: false, message: "Could not start the check. Try again." };
  const verify = await ctx.supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: challenge.data.id,
    code: parsed.data.code,
  });
  if (verify.error) {
    log.warn("admin.mfa.verify.failed", {
      userId: ctx.user.id,
      code: verify.error.code ?? verify.error.name,
    });
    await writeAdminAudit(
      ctx.user.id,
      "admin.mfa.verify-failed",
      parsed.data.factorId,
    );
    return {
      ok: false,
      message:
        "That code was not accepted. Codes change every 30 seconds; try the current one.",
    };
  }
  await writeAdminAudit(
    ctx.user.id,
    "admin.mfa.verified",
    parsed.data.factorId,
  );
  redirect("/admin");
}

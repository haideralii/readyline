"use server";
/**
 * The owner's team actions (REQ-020 FR-4, FR-5, FR-11, SR-4, SR-5): invite
 * a worker (the invitation goes by email through the provider and is shown
 * once on the page, because the provider only logs until REQ-022 Session
 * B), revoke an invitation, remove a worker, and turn the report link on,
 * regenerate it or turn it off. Every step writes its audit line; tokens
 * are stored hashed and never logged.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  generateAuditorToken,
  hashAuditorToken,
} from "@/lib/registers/auditor-link";
import {
  InviteForm,
  invitationExpiry,
  invitePath,
  reportPath,
} from "@/lib/registers/worker";
import { siteUrl } from "@/lib/site";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { emailHash } from "@/server/auth/rate-limit";
import { createEmailProvider } from "@/server/email/provider";
import { workerInvitationEmail } from "@/server/email/templates";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { liveReportLink } from "./team-queries";

export type TeamActionResult =
  | { ok: true; url?: string; message?: string }
  | { ok: false; message: string };

const NOT_OWNER = "Only the account's owner can do that.";

async function owner() {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return null;
  return {
    viewer,
    accountId: viewer.account.id,
    tradingName: viewer.account.trading_name,
    supabase: await createSupabaseServerClient(),
  };
}

export async function inviteWorkerAction(
  _previous: TeamActionResult | null,
  formData: FormData,
): Promise<TeamActionResult> {
  const parsed = parseInput(InviteForm, {
    email: formData.get("email"),
    workerRef: formData.get("workerRef"),
  });
  if (!parsed.ok) {
    const first = Object.values(parsed.fieldErrors)[0]?.[0];
    return { ok: false, message: first ?? "Check the email and the worker code." };
  }
  const o = await owner();
  if (!o) return { ok: false, message: "Sign in to invite a worker." };
  const now = new Date();
  const token = generateAuditorToken();
  const expiresAt = invitationExpiry(now);
  const ins = await o.supabase
    .from("invitations")
    .insert({
      account_id: o.accountId,
      email_hash: emailHash(parsed.data.email),
      role: "worker",
      worker_ref: parsed.data.workerRef,
      token_hash: hashAuditorToken(token),
      expires_at: expiresAt.toISOString(),
      created_by: o.viewer.user.id,
    })
    .select("id")
    .single();
  if (ins.error) {
    log.warn("team.invite-failed", { accountId: o.accountId, code: ins.error.code });
    return { ok: false, message: NOT_OWNER };
  }
  const url = `${siteUrl()}${invitePath(token)}`;
  const expiresOn = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(expiresAt);
  await createEmailProvider().send(
    workerInvitationEmail({
      to: parsed.data.email,
      tradingName: o.tradingName,
      workerRef: parsed.data.workerRef,
      url,
      expiresOn,
    }),
  );
  await o.supabase.from("audit_log").insert({
    account_id: o.accountId,
    actor_user_id: o.viewer.user.id,
    action: "invitation.created",
    target: `${ins.data.id as string} ${parsed.data.workerRef}`,
  });
  return { ok: true, url };
}

const IdInput = strictObject({ id: z.string().uuid() });

export async function revokeInvitationAction(
  _previous: TeamActionResult | null,
  formData: FormData,
): Promise<TeamActionResult> {
  const parsed = parseInput(IdInput, { id: formData.get("id") });
  if (!parsed.ok) return { ok: false, message: "That invitation was not found." };
  const o = await owner();
  if (!o) return { ok: false, message: "Sign in first." };
  const r = await o.supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("account_id", o.accountId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (r.error || !r.data?.length) return { ok: false, message: NOT_OWNER };
  await o.supabase.from("audit_log").insert({
    account_id: o.accountId,
    actor_user_id: o.viewer.user.id,
    action: "invitation.revoked",
    target: parsed.data.id,
  });
  return { ok: true, message: "Invitation revoked." };
}

const UserInput = strictObject({ userId: z.string().uuid() });

/** FR-4, FR-11: the worker's rows stay; their access ends on the next request. */
export async function removeWorkerAction(
  _previous: TeamActionResult | null,
  formData: FormData,
): Promise<TeamActionResult> {
  const parsed = parseInput(UserInput, { userId: formData.get("userId") });
  if (!parsed.ok) return { ok: false, message: "That worker was not found." };
  const o = await owner();
  if (!o) return { ok: false, message: "Sign in first." };
  const r = await o.supabase
    .from("memberships")
    .delete()
    .eq("account_id", o.accountId)
    .eq("user_id", parsed.data.userId)
    .eq("role", "worker")
    .select("user_id");
  if (r.error || !r.data?.length) return { ok: false, message: NOT_OWNER };
  await o.supabase.from("audit_log").insert({
    account_id: o.accountId,
    actor_user_id: o.viewer.user.id,
    action: "worker.removed",
    target: parsed.data.userId,
  });
  return { ok: true, message: "Worker removed. What they logged stays in the register." };
}

/** FR-5: turn the report link on, or regenerate it (the old one stops working at once). */
export async function createReportLinkAction(
  _previous: TeamActionResult | null,
  _formData: FormData,
): Promise<TeamActionResult> {
  void _formData;
  void parseInput(strictObject({}), {});
  const o = await owner();
  if (!o) return { ok: false, message: "Sign in first." };
  const current = await liveReportLink(o.supabase, o.accountId);
  if (current) {
    const r = await o.supabase
      .from("report_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", current.id)
      .eq("account_id", o.accountId)
      .select("id");
    if (r.error || !r.data?.length) return { ok: false, message: NOT_OWNER };
  }
  const token = generateAuditorToken();
  const ins = await o.supabase
    .from("report_links")
    .insert({
      account_id: o.accountId,
      token_hash: hashAuditorToken(token),
      created_by: o.viewer.user.id,
    })
    .select("id")
    .single();
  if (ins.error) {
    log.warn("team.report-link-failed", { accountId: o.accountId, code: ins.error.code });
    return { ok: false, message: NOT_OWNER };
  }
  await o.supabase.from("audit_log").insert({
    account_id: o.accountId,
    actor_user_id: o.viewer.user.id,
    action: current ? "report_link.regenerated" : "report_link.created",
    target: ins.data.id as string,
  });
  return { ok: true, url: `${siteUrl()}${reportPath(token)}` };
}

export async function revokeReportLinkAction(
  _previous: TeamActionResult | null,
  formData: FormData,
): Promise<TeamActionResult> {
  const parsed = parseInput(IdInput, { id: formData.get("id") });
  if (!parsed.ok) return { ok: false, message: "That link was not found." };
  const o = await owner();
  if (!o) return { ok: false, message: "Sign in first." };
  const r = await o.supabase
    .from("report_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("account_id", o.accountId)
    .is("revoked_at", null)
    .select("id");
  if (r.error || !r.data?.length) return { ok: false, message: NOT_OWNER };
  await o.supabase.from("audit_log").insert({
    account_id: o.accountId,
    actor_user_id: o.viewer.user.id,
    action: "report_link.revoked",
    target: parsed.data.id,
  });
  return { ok: true, message: "The report link is off." };
}

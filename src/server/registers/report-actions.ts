"use server";
/**
 * The report link's signed-out submission and the owner's confirm or reject
 * (REQ-020 FR-5, FR-6, SR-2, SR-3, SR-4). The submission is validated with
 * the report schema (the same participant-data rules as the forms, and a
 * reporter that is a worker code or a role, never free text), limited per
 * address, and written through the one `security definer` function with
 * the service key; the owner is emailed at once. Confirming turns the draft
 * into an ordinary row with the notification fields the owner adds, the
 * clock from the submission; rejecting keeps it, append-only, with the
 * reason.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { hashAuditorToken } from "@/lib/registers/auditor-link";
import { NDIS_NUMBER_SHAPE } from "@/lib/registers/types";
import { ReportForm, type ReportFormValues } from "@/lib/registers/worker";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { clientIp } from "@/server/auth/paths";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { createEmailProvider } from "@/server/email/provider";
import { reportToConfirmEmail } from "@/server/email/templates";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { countReportsToConfirm } from "./team-queries";

export type ReportSubmitResult =
  | { ok: true; reference: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export const REPORT_LIMIT = { limit: 10, windowSeconds: 3600 } as const;

const SubmitInput = strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  values: ReportForm,
});

export async function submitReportAction(input: {
  token: string;
  values: ReportFormValues;
}): Promise<ReportSubmitResult> {
  const parsed = parseInput(SubmitInput, input);
  if (!parsed.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed.fieldErrors))
      fieldErrors[k.replace(/^values\./, "")] = v;
    return { ok: false, message: "Check the fields marked below.", fieldErrors };
  }
  const address = clientIp(await headers()) ?? "unknown";
  if (!(await hitRateLimit(`report:${address}`, REPORT_LIMIT)))
    return { ok: false, message: "Too many reports from this connection in the last hour. Please try again later." };
  const admin = createSupabaseAdminClient();
  const v = parsed.data.values;
  const r = await admin.rpc("submit_incident_report", {
    p_token_hash: hashAuditorToken(parsed.data.token),
    p_occurred_on: v.occurredOn,
    p_category: v.category,
    p_severity: v.severity,
    p_participant_ref: v.participantRef ?? "",
    p_worker_ref: v.workerRef ?? "",
    p_summary: v.summary,
    p_actions_taken: v.actionsTaken,
    p_reporter: v.reporter,
  });
  if (r.error) {
    if (r.error.code === "P0003")
      return { ok: false, message: "The owner has several reports waiting already. Please tell them directly." };
    log.warn("report.submit-failed", { code: r.error.code });
    return { ok: false, message: "That report link does not work. Ask the owner for the current one." };
  }
  const row = (r.data as { incident_id: string; reference: string }[] | null)?.[0];
  if (!row) return { ok: false, message: "That report link does not work. Ask the owner for the current one." };

  // The owner is told at once (PO edit to FR-5); the daily job nudges again while it waits.
  try {
    const link = await admin
      .from("incidents")
      .select("account_id")
      .eq("id", row.incident_id)
      .single();
    const accountId = link.data?.account_id as string;
    const [owner, account, count] = await Promise.all([
      admin.from("memberships").select("user_id").eq("account_id", accountId).eq("role", "owner").limit(1).maybeSingle(),
      admin.from("accounts").select("trading_name").eq("id", accountId).single(),
      countReportsToConfirm(admin, accountId),
    ]);
    const userId = (owner.data as { user_id: string } | null)?.user_id;
    if (userId) {
      const u = await admin.auth.admin.getUserById(userId);
      const to = u.data.user?.email;
      if (to)
        await createEmailProvider().send(
          reportToConfirmEmail({ to, tradingName: (account.data?.trading_name as string) ?? "", count }),
        );
    }
    await admin.from("audit_log").insert({
      account_id: accountId,
      actor_user_id: null,
      action: "report.submitted",
      target: row.reference,
    });
  } catch (e) {
    log.warn("report.notify-failed", { error: e });
  }
  return { ok: true, reference: row.reference };
}

export type ConfirmResult = { ok: true } | { ok: false; message: string };

const ConfirmInput = strictObject({
  id: z.string().uuid(),
  reportable: z.boolean(),
  reportableNotifiedOn: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .transform((s) => (s === "" ? null : s)),
  commissionReference: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9 /-]*$/)
    .refine((s) => !NDIS_NUMBER_SHAPE.test(s))
    .default(""),
});

/** FR-5, FR-6: one screen, one button; the draft becomes an ordinary open row. */
export async function confirmReportAction(input: unknown): Promise<ConfirmResult> {
  const parsed = parseInput(ConfirmInput, input);
  if (!parsed.ok) return { ok: false, message: "Check the notification fields." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return { ok: false, message: "Sign in to confirm a report." };
  const supabase = await createSupabaseServerClient();
  const d = parsed.data;
  const draft = await supabase
    .from("incidents")
    .select("id, aware_on, occurred_on")
    .eq("id", d.id)
    .eq("account_id", viewer.account.id)
    .eq("status", "draft")
    .maybeSingle();
  const row = draft.data as { id: string; aware_on: string; occurred_on: string } | null;
  if (!row) return { ok: false, message: "That report was not found or is already confirmed." };
  const reportedOn = row.aware_on >= row.occurred_on ? row.aware_on : row.occurred_on;
  const up = await supabase
    .from("incidents")
    .update({
      status: "open",
      reported_on: reportedOn,
      reportable: d.reportable,
      reportable_notified_on: d.reportable ? d.reportableNotifiedOn : null,
      commission_reference: d.reportable ? d.commissionReference : "",
    })
    .eq("id", row.id)
    .eq("account_id", viewer.account.id)
    .select("id");
  if (up.error || !up.data?.length) {
    log.warn("report.confirm-failed", { accountId: viewer.account.id, code: up.error?.code });
    return { ok: false, message: "Could not confirm the report. Check the dates and try again." };
  }
  await supabase.from("incident_events").insert({
    incident_id: row.id,
    account_id: viewer.account.id,
    kind: "confirmed",
    note: d.reportable ? "Confirmed by the owner; marked reportable" : "Confirmed by the owner",
  });
  await supabase.from("audit_log").insert({
    account_id: viewer.account.id,
    actor_user_id: viewer.user.id,
    action: "report.confirmed",
    target: row.id,
  });
  return { ok: true };
}

const RejectInput = strictObject({
  id: z.string().uuid(),
  reason: text(500, 1, "Say why, in a sentence").refine(
    (s) => !NDIS_NUMBER_SHAPE.test(s),
    "This looks like an NDIS participant number. Use a reference code instead.",
  ),
});

/** The rejected report is kept, append-only, with the reason; it counts nowhere. */
export async function rejectReportAction(input: unknown): Promise<ConfirmResult> {
  const parsed = parseInput(RejectInput, input);
  if (!parsed.ok) return { ok: false, message: "Say why, in a sentence." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return { ok: false, message: "Sign in to reject a report." };
  const supabase = await createSupabaseServerClient();
  const up = await supabase
    .from("incidents")
    .update({ status: "rejected", rejected_reason: parsed.data.reason })
    .eq("id", parsed.data.id)
    .eq("account_id", viewer.account.id)
    .eq("status", "draft")
    .select("id");
  if (up.error || !up.data?.length) return { ok: false, message: "That report was not found or is already confirmed." };
  await supabase.from("incident_events").insert({
    incident_id: parsed.data.id,
    account_id: viewer.account.id,
    kind: "rejected",
    note: `Rejected by the owner: ${parsed.data.reason}`,
  });
  await supabase.from("audit_log").insert({
    account_id: viewer.account.id,
    actor_user_id: viewer.user.id,
    action: "report.rejected",
    target: parsed.data.id,
  });
  return { ok: true };
}

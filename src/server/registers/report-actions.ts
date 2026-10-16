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
import {
  NDIS_NUMBER_SHAPE,
  type IncidentCategory,
} from "@/lib/registers/types";
import {
  REPORT_ACCOUNT_LIMIT,
  REPORT_LIMIT,
  ReportForm,
  isReportableCategory,
  type ReportFormValues,
} from "@/lib/registers/worker";
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
      /** Set when the action threw instead of answering (run 38743907016); the job log carries the cause. */
      code?: "report.unexpected";
    };

const SubmitInput = strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  values: ReportForm,
});

/**
 * The guard around the submission: a throw anywhere inside (a limiter or
 * client error that is thrown rather than returned) used to reach the page
 * as a bare 500 with a digest and no message (run 38743907016, PR #62). It
 * now answers the reporter in plain words and logs the cause, so the job
 * log says what happened.
 */
export async function submitReportAction(input: {
  token: string;
  values: ReportFormValues;
}): Promise<ReportSubmitResult> {
  try {
    return await submitReport(input);
  } catch (e) {
    const err = e as { name?: string; code?: string; message?: string };
    log.error("report.submit-threw", {
      kind: err?.name ?? typeof e,
      code: err?.code ?? "",
      thrown: String(err?.message ?? e).slice(0, 300),
    });
    return {
      ok: false,
      code: "report.unexpected",
      message:
        "Something went wrong on our side. Please tell the owner directly, or try again in a minute.",
    };
  }
}

async function submitReport(input: {
  token: string;
  values: ReportFormValues;
}): Promise<ReportSubmitResult> {
  const parsed = parseInput(SubmitInput, input);
  if (!parsed.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed.fieldErrors))
      fieldErrors[k.replace(/^values\./, "")] = v;
    return {
      ok: false,
      message: "Check the fields marked below.",
      fieldErrors,
    };
  }
  const address = clientIp(await headers()) ?? "unknown";
  if (!(await hitRateLimit(`report:${address}`, REPORT_LIMIT)))
    return {
      ok: false,
      message:
        "Too many reports from this connection in the last hour. Please try again later.",
    };
  const admin = createSupabaseAdminClient();
  // FR-5, SR-4: the per-account limit (50 a day) needs the account, so the
  // link resolves first; an unknown or revoked link gets the one plain answer.
  const DEAD = {
    ok: false as const,
    message:
      "That report link does not work. Ask the owner for the current one.",
  };
  const lookup = await admin.rpc("report_link_lookup", {
    p_token_hash: hashAuditorToken(parsed.data.token),
  });
  const link = (
    lookup.data as { account_id: string; trading_name: string }[] | null
  )?.[0];
  if (lookup.error || !link) return DEAD;
  if (
    !(await hitRateLimit(
      `report-account:${link.account_id}`,
      REPORT_ACCOUNT_LIMIT,
    ))
  )
    return {
      ok: false,
      message:
        "This business has received many reports today. Please tell the owner directly.",
    };
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
      return {
        ok: false,
        message:
          "The owner has several reports waiting already. Please tell them directly.",
      };
    log.warn("report.submit-failed", { code: r.error.code });
    return DEAD;
  }
  const row = (
    r.data as { incident_id: string; reference: string }[] | null
  )?.[0];
  if (!row) return DEAD;

  // The owner is told at once (PO edit to FR-5); the daily job nudges again while it waits.
  try {
    const accountId = link.account_id;
    const [owner, count] = await Promise.all([
      admin
        .from("memberships")
        .select("user_id")
        .eq("account_id", accountId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle(),
      countReportsToConfirm(admin, accountId),
    ]);
    const userId = (owner.data as { user_id: string } | null)?.user_id;
    if (userId) {
      const u = await admin.auth.admin.getUserById(userId);
      const to = u.data.user?.email;
      if (to)
        await createEmailProvider().send(
          reportToConfirmEmail({ to, tradingName: link.trading_name, count }),
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
export async function confirmReportAction(
  input: unknown,
): Promise<ConfirmResult> {
  const parsed = parseInput(ConfirmInput, input);
  if (!parsed.ok)
    return { ok: false, message: "Check the notification fields." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to confirm a report." };
  const supabase = await createSupabaseServerClient();
  const d = parsed.data;
  const draft = await supabase
    .from("incidents")
    .select("id, aware_on, occurred_on")
    .eq("id", d.id)
    .eq("account_id", viewer.account.id)
    .eq("status", "draft")
    .maybeSingle();
  const row = draft.data as {
    id: string;
    aware_on: string;
    occurred_on: string;
  } | null;
  if (!row)
    return {
      ok: false,
      message: "That report was not found or is already confirmed.",
    };
  const reportedOn =
    row.aware_on >= row.occurred_on ? row.aware_on : row.occurred_on;
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
    log.warn("report.confirm-failed", {
      accountId: viewer.account.id,
      code: up.error?.code,
    });
    return {
      ok: false,
      message: "Could not confirm the report. Check the dates and try again.",
    };
  }
  await supabase.from("incident_events").insert({
    incident_id: row.id,
    account_id: viewer.account.id,
    kind: "confirmed",
    note: d.reportable
      ? "Confirmed by the owner; marked reportable"
      : "Confirmed by the owner",
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

/**
 * The rejected report is kept, append-only, with the reason. Retro finding
 * 62: a report in a reportable category is an alleged reportable incident
 * the provider is now aware of (Incident Rules s 17), so it is marked
 * reportable as it is rejected: `notify_by` is generated, the row reads
 * "received, not recorded" in the register and the auditor's view, and the
 * reportable-not-notified reminder runs until the owner records the date
 * the Commission was told or that it is not reportable after all
 * (`settleRejectedReportAction`). Any other rejected report counts nowhere.
 */
export async function rejectReportAction(
  input: unknown,
): Promise<ConfirmResult> {
  const parsed = parseInput(RejectInput, input);
  if (!parsed.ok) return { ok: false, message: "Say why, in a sentence." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to reject a report." };
  const supabase = await createSupabaseServerClient();
  const draft = await supabase
    .from("incidents")
    .select("id, category")
    .eq("id", parsed.data.id)
    .eq("account_id", viewer.account.id)
    .eq("status", "draft")
    .maybeSingle();
  const row = draft.data as { id: string; category: IncidentCategory } | null;
  if (!row)
    return {
      ok: false,
      message: "That report was not found or is already confirmed.",
    };
  const reportable = isReportableCategory(row.category);
  const up = await supabase
    .from("incidents")
    .update({
      status: "rejected",
      rejected_reason: parsed.data.reason,
      ...(reportable ? { reportable: true } : {}),
    })
    .eq("id", row.id)
    .eq("account_id", viewer.account.id)
    .eq("status", "draft")
    .select("id");
  if (up.error || !up.data?.length)
    return {
      ok: false,
      message: "That report was not found or is already confirmed.",
    };
  await supabase.from("incident_events").insert({
    incident_id: parsed.data.id,
    account_id: viewer.account.id,
    kind: "rejected",
    note: reportable
      ? `Rejected by the owner: ${parsed.data.reason}. An allegation of this kind is still reportable; the notify-by date stands.`
      : `Rejected by the owner: ${parsed.data.reason}`,
  });
  await supabase.from("audit_log").insert({
    account_id: viewer.account.id,
    actor_user_id: viewer.user.id,
    action: "report.rejected",
    target: parsed.data.id,
  });
  return { ok: true };
}

const SettleInput = strictObject({
  id: z.string().uuid(),
  /** The date the Commission was told; empty when the owner says it is not reportable after all. */
  notifiedOn: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .transform((s) => (s === "" ? null : s)),
  commissionReference: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9 /-]*$/)
    .refine((s) => !NDIS_NUMBER_SHAPE.test(s))
    .default(""),
  notReportable: z.boolean(),
  /** Why it is not reportable after all; required with `notReportable`. */
  reason: text(500, 0, "Say why, in a sentence")
    .refine(
      (s) => !NDIS_NUMBER_SHAPE.test(s),
      "This looks like an NDIS participant number. Use a reference code instead.",
    )
    .default(""),
});

/**
 * Retro finding 62: a rejected report in a reportable category reads
 * "received, not recorded" until the owner records the date the Commission
 * was told (the notification trail as for any incident) or that it is not
 * reportable after all, with the reason as an event. Either stops the
 * reminder; the second takes the row out of the auditor's view.
 */
export async function settleRejectedReportAction(
  input: unknown,
): Promise<ConfirmResult> {
  const parsed = parseInput(SettleInput, input);
  if (!parsed.ok)
    return { ok: false, message: "Check the date and the reference." };
  const d = parsed.data;
  if (!d.notReportable && !d.notifiedOn)
    return {
      ok: false,
      message:
        "Enter the date you told the Commission, or say why it is not reportable.",
    };
  if (d.notReportable && d.reason.trim().length === 0)
    return {
      ok: false,
      message: "Say why it is not reportable, in a sentence.",
    };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to update a report." };
  const supabase = await createSupabaseServerClient();
  const up = await supabase
    .from("incidents")
    .update(
      d.notReportable
        ? { reportable: false, reportable_notified_on: null }
        : {
            reportable_notified_on: d.notifiedOn,
            commission_reference: d.commissionReference,
          },
    )
    .eq("id", d.id)
    .eq("account_id", viewer.account.id)
    .eq("status", "rejected")
    .eq("reportable", true)
    .select("id");
  if (up.error || !up.data?.length)
    return { ok: false, message: "That report was not found." };
  await supabase.from("incident_events").insert({
    incident_id: d.id,
    account_id: viewer.account.id,
    kind: d.notReportable ? "note" : "notified",
    note: d.notReportable
      ? `Not reportable after all, the owner records: ${d.reason.trim()}`
      : `Commission notified on ${d.notifiedOn}${d.commissionReference ? ` (reference ${d.commissionReference})` : ""}`,
  });
  await supabase.from("audit_log").insert({
    account_id: viewer.account.id,
    actor_user_id: viewer.user.id,
    action: d.notReportable ? "report.not-reportable" : "report.notified",
    target: d.id,
  });
  return { ok: true };
}

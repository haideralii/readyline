"use server";
/**
 * Writes for the four registers (REQ-009 Session B, FR-5, SR-1 to SR-3).
 * Every action validates with the shared form schema, runs with the
 * caller's own session so RLS and the subscription gate apply in the
 * database, turns the database's refusals into plain messages, writes an
 * audit-log line with ids only, and never sends a word of the row to a
 * model. Status changes on incidents and complaints are recorded as events.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  ComplaintForm,
  IncidentForm,
  PolicyReviewForm,
  WorkerCheckForm,
} from "@/lib/registers/forms";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";

export type RegisterActionResult =
  | { ok: true; id: string; reference?: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };

const UUID = z.string().uuid();

/**
 * The owner's account, or (REQ-020 FR-4) the account a worker logs for;
 * the row-level policies decide what each may write.
 */
async function viewerOrFail() {
  const viewer = await getViewer();
  if (!viewer || viewer.deleted) return null;
  const account = viewer.account ?? viewer.worker;
  if (!account) return null;
  return {
    viewer,
    account: { id: account.id, trading_name: account.trading_name },
    worker: viewer.account ? null : viewer.worker,
    supabase: await createSupabaseServerClient(),
  };
}

async function audit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accountId: string,
  userId: string,
  action: string,
  target: string,
) {
  await supabase.from("audit_log").insert({
    account_id: accountId,
    actor_user_id: userId,
    action,
    target,
  });
}

function failed(parsed: {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}): RegisterActionResult {
  return {
    ok: false,
    message: "Check the highlighted fields.",
    fieldErrors: parsed.fieldErrors,
    formErrors: parsed.formErrors,
  };
}

/* ---------- incidents ---------- */

const IncidentInput = strictObject({
  id: UUID.optional(),
  values: IncidentForm,
});

export async function saveIncidentAction(
  input: unknown,
): Promise<RegisterActionResult> {
  const parsed = parseInput(IncidentInput, input);
  if (!parsed.ok) {
    // Field errors come back under values.<field>; strip the prefix for the form.
    const fieldErrors: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed.fieldErrors))
      fieldErrors[k.replace(/^values\./, "")] = v;
    return failed({ fieldErrors, formErrors: parsed.formErrors });
  }
  const ctx = await viewerOrFail();
  if (!ctx) return { ok: false, message: "Sign in to use the registers." };
  if (!(await checkRegisterWriteAllowed(ctx.viewer.user.id)))
    return {
      ok: false,
      message: "Too many changes in a minute. Wait a moment and try again.",
    };
  const v = parsed.data.values;
  const row = {
    account_id: ctx.account.id,
    occurred_on: v.occurredOn,
    reported_on: v.reportedOn,
    category: v.category,
    severity: v.severity,
    participant_ref: v.participantRef,
    worker_ref: v.workerRef,
    summary: v.summary,
    actions_taken: v.actionsTaken,
    reportable: v.reportable,
    reportable_notified_on: v.reportableNotifiedOn,
    commission_reference: v.commissionReference,
    status: v.status,
    closed_on: v.closedOn,
    // REQ-020 FR-4: a worker's row says who logged it; the owner's says the owner.
    ...(ctx.worker
      ? {
          reported_via: "worker" as const,
          logged_by_ref: ctx.worker.worker_ref,
          created_by: ctx.viewer.user.id,
        }
      : {}),
  };
  if (parsed.data.id) {
    const before = await ctx.supabase
      .from("incidents")
      .select(
        "id, status, reportable, reportable_notified_on, commission_reference",
      )
      .eq("id", parsed.data.id)
      .eq("account_id", ctx.account.id)
      .maybeSingle();
    if (!before.data)
      return { ok: false, message: "That incident was not found." };
    const up = await ctx.supabase
      .from("incidents")
      .update(row)
      .eq("id", parsed.data.id)
      .eq("account_id", ctx.account.id)
      .select("id, reference")
      .single();
    if (up.error) {
      log.warn("registers.incident.update.failed", { code: up.error.code });
      return { ok: false, message: plainDatabaseMessage(up.error) };
    }
    const events: { kind: string; note: string }[] = [];
    if (before.data.status !== v.status)
      events.push({
        kind: "status-change",
        note: `Status: ${before.data.status} to ${v.status}`,
      });
    if (!before.data.reportable && v.reportable)
      events.push({ kind: "reportable-flagged", note: "Marked reportable" });
    if (!before.data.reportable_notified_on && v.reportableNotifiedOn)
      events.push({
        kind: "notified",
        note: `Commission notified on ${v.reportableNotifiedOn}`,
      });
    // The Commission's reference, once it arrives, is part of the notification trail.
    if (
      v.commissionReference &&
      before.data.commission_reference !== v.commissionReference
    )
      events.push({
        kind: "notified",
        note: `Commission reference ${v.commissionReference}`,
      });
    for (const e of events)
      await ctx.supabase.from("incident_events").insert({
        incident_id: parsed.data.id,
        account_id: ctx.account.id,
        kind: e.kind,
        note: e.note,
      });
    await audit(
      ctx.supabase,
      ctx.account.id,
      ctx.viewer.user.id,
      "register.incident.updated",
      parsed.data.id,
    );
    return {
      ok: true,
      id: up.data.id as string,
      reference: up.data.reference as string,
    };
  }
  const ins = await ctx.supabase
    .from("incidents")
    .insert(row)
    .select("id, reference")
    .single();
  if (ins.error) {
    log.warn("registers.incident.create.failed", { code: ins.error.code });
    return { ok: false, message: plainDatabaseMessage(ins.error) };
  }
  await ctx.supabase.from("incident_events").insert({
    incident_id: ins.data.id,
    account_id: ctx.account.id,
    kind: "created",
    note: "",
  });
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    "register.incident.created",
    ins.data.id as string,
  );
  return {
    ok: true,
    id: ins.data.id as string,
    reference: ins.data.reference as string,
  };
}

const NoteInput = strictObject({
  id: UUID,
  note: text(1000, 1, "Write the note").refine(
    (v) => !/(^|[^0-9])43[0-9]{7}([^0-9]|$)/.test(v),
    "This looks like an NDIS participant number. Use a reference code instead.",
  ),
});

export async function addIncidentNoteAction(
  input: unknown,
): Promise<RegisterActionResult> {
  const parsed = parseInput(NoteInput, input);
  if (!parsed.ok) return failed(parsed);
  const ctx = await viewerOrFail();
  if (!ctx) return { ok: false, message: "Sign in to use the registers." };
  if (!(await checkRegisterWriteAllowed(ctx.viewer.user.id)))
    return {
      ok: false,
      message: "Too many changes in a minute. Wait a moment and try again.",
    };
  const ins = await ctx.supabase
    .from("incident_events")
    .insert({
      incident_id: parsed.data.id,
      account_id: ctx.account.id,
      kind: "note",
      note: parsed.data.note,
    })
    .select("id")
    .single();
  if (ins.error) return { ok: false, message: plainDatabaseMessage(ins.error) };
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    "register.incident.note",
    parsed.data.id,
  );
  return { ok: true, id: ins.data.id as string };
}

/* ---------- complaints ---------- */

const ComplaintInput = strictObject({
  id: UUID.optional(),
  values: ComplaintForm,
});

export async function saveComplaintAction(
  input: unknown,
): Promise<RegisterActionResult> {
  const parsed = parseInput(ComplaintInput, input);
  if (!parsed.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed.fieldErrors))
      fieldErrors[k.replace(/^values\./, "")] = v;
    return failed({ fieldErrors, formErrors: parsed.formErrors });
  }
  const ctx = await viewerOrFail();
  if (!ctx) return { ok: false, message: "Sign in to use the registers." };
  if (!(await checkRegisterWriteAllowed(ctx.viewer.user.id)))
    return {
      ok: false,
      message: "Too many changes in a minute. Wait a moment and try again.",
    };
  const v = parsed.data.values;
  const row = {
    account_id: ctx.account.id,
    received_on: v.receivedOn,
    channel: v.channel,
    from_ref: v.fromRef,
    summary: v.summary,
    outcome: v.outcome,
    acknowledged_on: v.acknowledgedOn,
    resolved_on: v.resolvedOn,
    status: v.status,
    // REQ-020 FR-4: a worker's complaint row carries their user id for the own-rows policy.
    ...(ctx.worker ? { created_by: ctx.viewer.user.id } : {}),
  };
  if (parsed.data.id) {
    const before = await ctx.supabase
      .from("complaints")
      .select("id, status, acknowledged_on, resolved_on")
      .eq("id", parsed.data.id)
      .eq("account_id", ctx.account.id)
      .maybeSingle();
    if (!before.data)
      return { ok: false, message: "That complaint was not found." };
    const up = await ctx.supabase
      .from("complaints")
      .update(row)
      .eq("id", parsed.data.id)
      .eq("account_id", ctx.account.id)
      .select("id, reference")
      .single();
    if (up.error) return { ok: false, message: plainDatabaseMessage(up.error) };
    const events: { kind: string; note: string }[] = [];
    if (before.data.status !== v.status)
      events.push({
        kind: "status-change",
        note: `Status: ${before.data.status} to ${v.status}`,
      });
    if (!before.data.acknowledged_on && v.acknowledgedOn)
      events.push({
        kind: "acknowledged",
        note: `Acknowledged on ${v.acknowledgedOn}`,
      });
    if (!before.data.resolved_on && v.resolvedOn)
      events.push({ kind: "resolved", note: `Resolved on ${v.resolvedOn}` });
    for (const e of events)
      await ctx.supabase.from("complaint_events").insert({
        complaint_id: parsed.data.id,
        account_id: ctx.account.id,
        kind: e.kind,
        note: e.note,
      });
    await audit(
      ctx.supabase,
      ctx.account.id,
      ctx.viewer.user.id,
      "register.complaint.updated",
      parsed.data.id,
    );
    return {
      ok: true,
      id: up.data.id as string,
      reference: up.data.reference as string,
    };
  }
  const ins = await ctx.supabase
    .from("complaints")
    .insert(row)
    .select("id, reference")
    .single();
  if (ins.error) return { ok: false, message: plainDatabaseMessage(ins.error) };
  await ctx.supabase.from("complaint_events").insert({
    complaint_id: ins.data.id,
    account_id: ctx.account.id,
    kind: "created",
    note: "",
  });
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    "register.complaint.created",
    ins.data.id as string,
  );
  return {
    ok: true,
    id: ins.data.id as string,
    reference: ins.data.reference as string,
  };
}

export async function addComplaintNoteAction(
  input: unknown,
): Promise<RegisterActionResult> {
  const parsed = parseInput(NoteInput, input);
  if (!parsed.ok) return failed(parsed);
  const ctx = await viewerOrFail();
  if (!ctx) return { ok: false, message: "Sign in to use the registers." };
  if (!(await checkRegisterWriteAllowed(ctx.viewer.user.id)))
    return {
      ok: false,
      message: "Too many changes in a minute. Wait a moment and try again.",
    };
  const ins = await ctx.supabase
    .from("complaint_events")
    .insert({
      complaint_id: parsed.data.id,
      account_id: ctx.account.id,
      kind: "note",
      note: parsed.data.note,
    })
    .select("id")
    .single();
  if (ins.error) return { ok: false, message: plainDatabaseMessage(ins.error) };
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    "register.complaint.note",
    parsed.data.id,
  );
  return { ok: true, id: ins.data.id as string };
}

/* ---------- worker checks ---------- */

const WorkerCheckInput = strictObject({
  id: UUID.optional(),
  values: WorkerCheckForm,
});

export async function saveWorkerCheckAction(
  input: unknown,
): Promise<RegisterActionResult> {
  const parsed = parseInput(WorkerCheckInput, input);
  if (!parsed.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed.fieldErrors))
      fieldErrors[k.replace(/^values\./, "")] = v;
    return failed({ fieldErrors, formErrors: parsed.formErrors });
  }
  const ctx = await viewerOrFail();
  if (!ctx) return { ok: false, message: "Sign in to use the registers." };
  if (!(await checkRegisterWriteAllowed(ctx.viewer.user.id)))
    return {
      ok: false,
      message: "Too many changes in a minute. Wait a moment and try again.",
    };
  const v = parsed.data.values;
  const row = {
    account_id: ctx.account.id,
    worker_ref: v.workerRef,
    role_label: v.roleLabel,
    clearance_kind: v.clearanceKind,
    clearance_number: v.clearanceNumber,
    issued_on: v.issuedOn,
    expires_on: v.expiresOn,
    state: v.state,
    note: v.note,
  };
  const q = parsed.data.id
    ? ctx.supabase
        .from("worker_clearances")
        .update(row)
        .eq("id", parsed.data.id)
        .eq("account_id", ctx.account.id)
        .select("id")
        .single()
    : ctx.supabase.from("worker_clearances").insert(row).select("id").single();
  const r = await q;
  if (r.error) return { ok: false, message: plainDatabaseMessage(r.error) };
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    parsed.data.id
      ? "register.worker-check.updated"
      : "register.worker-check.created",
    r.data.id as string,
  );
  return { ok: true, id: r.data.id as string };
}

/* ---------- policy reviews ---------- */

const PolicyReviewInput = strictObject({
  id: UUID.optional(),
  values: PolicyReviewForm,
});

export async function savePolicyReviewAction(
  input: unknown,
): Promise<RegisterActionResult> {
  const parsed = parseInput(PolicyReviewInput, input);
  if (!parsed.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed.fieldErrors))
      fieldErrors[k.replace(/^values\./, "")] = v;
    return failed({ fieldErrors, formErrors: parsed.formErrors });
  }
  const ctx = await viewerOrFail();
  if (!ctx) return { ok: false, message: "Sign in to use the registers." };
  if (!(await checkRegisterWriteAllowed(ctx.viewer.user.id)))
    return {
      ok: false,
      message: "Too many changes in a minute. Wait a moment and try again.",
    };
  const v = parsed.data.values;
  const row = {
    account_id: ctx.account.id,
    document_type_id: v.documentTypeId,
    title: v.title,
    adopted_on: v.adoptedOn,
    review_cycle_months: v.reviewCycleMonths,
    last_reviewed_on: v.lastReviewedOn,
    reviewer_ref: v.reviewerRef,
    note: v.note,
  };
  const q = parsed.data.id
    ? ctx.supabase
        .from("policy_reviews")
        .update(row)
        .eq("id", parsed.data.id)
        .eq("account_id", ctx.account.id)
        .select("id")
        .single()
    : ctx.supabase.from("policy_reviews").insert(row).select("id").single();
  const r = await q;
  if (r.error) return { ok: false, message: plainDatabaseMessage(r.error) };
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    parsed.data.id
      ? "register.policy-review.updated"
      : "register.policy-review.created",
    r.data.id as string,
  );
  return { ok: true, id: r.data.id as string };
}

export async function deleteRegisterRowAction(
  input: unknown,
): Promise<RegisterActionResult> {
  const parsed = parseInput(
    strictObject({
      register: z.enum([
        "incidents",
        "complaints",
        "worker_clearances",
        "policy_reviews",
      ]),
      id: UUID,
    }),
    input,
  );
  if (!parsed.ok) return failed(parsed);
  const ctx = await viewerOrFail();
  if (!ctx) return { ok: false, message: "Sign in to use the registers." };
  const del = await ctx.supabase
    .from(parsed.data.register)
    .delete()
    .eq("id", parsed.data.id)
    .eq("account_id", ctx.account.id)
    .select("id");
  if (del.error) return { ok: false, message: plainDatabaseMessage(del.error) };
  if (!del.data?.length)
    return {
      ok: false,
      message: "Only the account owner can delete an entry.",
    };
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    `register.${parsed.data.register}.deleted`,
    parsed.data.id,
  );
  return { ok: true, id: parsed.data.id };
}

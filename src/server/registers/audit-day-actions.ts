"use server";
/**
 * Writes for the audit-day registers (REQ-018 Session B; D-1904). One save
 * action serves the nine registers: it validates with the register's own
 * schema, runs with the caller's session so RLS and the subscription gate
 * apply in the database, turns refusals into plain messages, writes the
 * shared trail (D-1902) and an audit-log line with ids only, and never
 * sends a word of a row to a model. Decisions and ticks are append only;
 * the database refuses an update on them (42501).
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  AUDIT_DAY_META,
  AUDIT_DAY_SLUGS,
  OnboardingTickForm,
  type AuditDaySlug,
} from "@/lib/registers/audit-day-forms";
import { onboardingItemsFor } from "@/lib/registers/onboarding-items";
import type { OnboardingKind } from "@/lib/registers/audit-day-types";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import { dateField } from "@/lib/registers/forms";
import { parseInput, strictObject, text } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { checkRegisterWriteAllowed } from "@/server/auth/rate-limit";

export type AuditDayActionResult =
  | { ok: true; id: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };

const UUID = z.string().uuid();
const Slug = z.enum(AUDIT_DAY_SLUGS);

async function context() {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return null;
  if (!(await checkRegisterWriteAllowed(viewer.user.id))) return "limited";
  return {
    viewer,
    account: viewer.account,
    supabase: await createSupabaseServerClient(),
  };
}

const SIGN_IN: AuditDayActionResult = {
  ok: false,
  message: "Sign in to use the registers.",
};
const LIMITED: AuditDayActionResult = {
  ok: false,
  message: "Too many changes in a minute. Wait a moment and try again.",
};

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

async function trail(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accountId: string,
  table: string,
  rowId: string,
  kind: "created" | "updated" | "note" | "reviewed" | "closed",
  note = "",
) {
  const r = await supabase.from("register_events").insert({
    account_id: accountId,
    register: table,
    row_id: rowId,
    kind,
    note,
  });
  if (r.error)
    log.warn("registers.trail.failed", {
      accountId,
      table,
      code: r.error.code,
    });
}

const SaveInput = strictObject({
  register: Slug,
  id: UUID.optional(),
  values: z.record(z.string(), z.unknown()),
});

export async function saveAuditDayRowAction(
  input: unknown,
): Promise<AuditDayActionResult> {
  const outer = parseInput(SaveInput, input);
  if (!outer.ok) return { ok: false, message: "Check the highlighted fields." };
  const slug: AuditDaySlug = outer.data.register;
  const meta = AUDIT_DAY_META[slug];
  const parsed = parseInput(meta.schema, outer.data.values);
  if (!parsed.ok)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };
  if (meta.appendOnly && outer.data.id)
    return { ok: false, message: "A decision is never edited; add a new one." };
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const row = {
    account_id: ctx.account.id,
    ...(parsed.data as Record<string, unknown>),
    // A starter row edited by the provider is theirs from then on (FR-1).
    ...(slug === "corporate-risks" && outer.data.id ? { starter: false } : {}),
  };
  const q = outer.data.id
    ? ctx.supabase
        .from(meta.table)
        .update(row)
        .eq("id", outer.data.id)
        .eq("account_id", ctx.account.id)
        .select("id")
        .single()
    : ctx.supabase.from(meta.table).insert(row).select("id").single();
  const r = await q;
  if (r.error) return { ok: false, message: plainDatabaseMessage(r.error) };
  const id = r.data.id as string;
  if (slug !== "decisions")
    await trail(
      ctx.supabase,
      ctx.account.id,
      meta.table,
      id,
      outer.data.id ? "updated" : "created",
    );
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    `register.${meta.table}.${outer.data.id ? "updated" : "created"}`,
    id,
  );
  return { ok: true, id };
}

const NoteInput = strictObject({
  register: Slug,
  id: UUID,
  kind: z.enum(["note", "reviewed"]),
  note: text(1000, 1, "Type the note"),
});

/** A note or a "reviewed today" mark on a row's trail (D-1902); a review also moves the review date when the row has one. */
export async function addRegisterNoteAction(
  input: unknown,
): Promise<AuditDayActionResult> {
  const parsed = parseInput(NoteInput, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: "Check the note.",
      fieldErrors: parsed.fieldErrors,
    };
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const meta = AUDIT_DAY_META[parsed.data.register];
  if (meta.appendOnly)
    return { ok: false, message: "A decision has no trail; add a new one." };
  const owned = await ctx.supabase
    .from(meta.table)
    .select("id")
    .eq("id", parsed.data.id)
    .eq("account_id", ctx.account.id)
    .maybeSingle();
  if (!owned.data) return { ok: false, message: "That entry was not found." };
  const r = await ctx.supabase
    .from("register_events")
    .insert({
      account_id: ctx.account.id,
      register: meta.table,
      row_id: parsed.data.id,
      kind: parsed.data.kind,
      note: parsed.data.note,
    })
    .select("id")
    .single();
  if (r.error) return { ok: false, message: plainDatabaseMessage(r.error) };
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    `register.${meta.table}.${parsed.data.kind}`,
    parsed.data.id,
  );
  return { ok: true, id: r.data.id as string };
}

/** FR-9: tick one item with the date and who ticked it; when every item is ticked the checklist is complete and a worker's matrix row gets the date. */
export async function tickOnboardingItemAction(
  input: unknown,
): Promise<AuditDayActionResult> {
  const parsed = parseInput(OnboardingTickForm, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const list = await ctx.supabase
    .from("onboarding_checklists")
    .select("id, kind, subject_ref, completed_on")
    .eq("id", parsed.data.checklist_id)
    .eq("account_id", ctx.account.id)
    .maybeSingle();
  if (!list.data)
    return { ok: false, message: "That checklist was not found." };
  const items = onboardingItemsFor(list.data.kind as OnboardingKind);
  if (!items.some((i) => i.id === parsed.data.item_id))
    return { ok: false, message: "That item is not on this checklist." };
  const tick = await ctx.supabase
    .from("onboarding_ticks")
    .insert({
      checklist_id: list.data.id,
      account_id: ctx.account.id,
      item_id: parsed.data.item_id,
      ticked_on: parsed.data.ticked_on,
      ticked_by_ref: parsed.data.ticked_by_ref,
    })
    .select("id")
    .single();
  if (tick.error)
    return { ok: false, message: plainDatabaseMessage(tick.error) };
  const ticked = await ctx.supabase
    .from("onboarding_ticks")
    .select("item_id")
    .eq("checklist_id", list.data.id);
  const done = new Set(
    ((ticked.data as { item_id: string }[] | null) ?? []).map((t) => t.item_id),
  );
  if (items.every((i) => done.has(i.id)) && !list.data.completed_on) {
    await ctx.supabase
      .from("onboarding_checklists")
      .update({ completed_on: parsed.data.ticked_on })
      .eq("id", list.data.id)
      .eq("account_id", ctx.account.id);
    if (list.data.kind === "worker")
      await ctx.supabase
        .from("staff_matrix")
        .update({ onboarding_signed_on: parsed.data.ticked_on })
        .eq("account_id", ctx.account.id)
        .eq("worker_ref", list.data.subject_ref)
        .is("onboarding_signed_on", null);
    await trail(
      ctx.supabase,
      ctx.account.id,
      "onboarding_checklists",
      list.data.id,
      "closed",
      "Every item ticked.",
    );
  }
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    "register.onboarding_ticks.created",
    tick.data.id as string,
  );
  return { ok: true, id: tick.data.id as string };
}

const ReviewInput = strictObject({
  register: z.enum([
    "corporate-risks",
    "participant-risks",
    "conflicts-of-interest",
  ]),
  id: UUID,
  review_on: dateField("next review date"),
});

/** "Reviewed today, next review on": one tap on a row with a review date (FR-1 to FR-3). */
export async function markReviewedAction(
  input: unknown,
): Promise<AuditDayActionResult> {
  const parsed = parseInput(ReviewInput, input);
  if (!parsed.ok)
    return {
      ok: false,
      message: "Enter the next review date.",
      fieldErrors: parsed.fieldErrors,
    };
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const meta = AUDIT_DAY_META[parsed.data.register];
  const r = await ctx.supabase
    .from(meta.table)
    .update({
      review_on: parsed.data.review_on,
      ...(parsed.data.register === "corporate-risks" ? { starter: false } : {}),
    })
    .eq("id", parsed.data.id)
    .eq("account_id", ctx.account.id)
    .select("id")
    .single();
  if (r.error) return { ok: false, message: plainDatabaseMessage(r.error) };
  await trail(
    ctx.supabase,
    ctx.account.id,
    meta.table,
    parsed.data.id,
    "reviewed",
    `Reviewed; next review ${parsed.data.review_on}.`,
  );
  await audit(
    ctx.supabase,
    ctx.account.id,
    ctx.viewer.user.id,
    `register.${meta.table}.reviewed`,
    parsed.data.id,
  );
  return { ok: true, id: parsed.data.id };
}

export async function deleteAuditDayRowAction(
  input: unknown,
): Promise<AuditDayActionResult> {
  const parsed = parseInput(strictObject({ register: Slug, id: UUID }), input);
  if (!parsed.ok) return { ok: false, message: "That entry was not found." };
  const ctx = await context();
  if (!ctx) return SIGN_IN;
  if (ctx === "limited") return LIMITED;
  const meta = AUDIT_DAY_META[parsed.data.register];
  const del = await ctx.supabase
    .from(meta.table)
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
    `register.${meta.table}.deleted`,
    parsed.data.id,
  );
  return { ok: true, id: parsed.data.id };
}

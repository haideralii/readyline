"use server";
/**
 * Spreadsheet imports (REQ-020 FR-8, FR-12, SR-4): the preview never
 * writes; the import re-validates the same text, inserts only the rows
 * that pass, writes one `register_events` line per row and one `imports`
 * row with the ids it wrote, and one audit line with the counts; the owner
 * can undo an import for an hour. Five imports an hour per account.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import {
  IMPORT_LIMITS,
  IMPORT_REGISTERS,
  canUndoImport,
  previewImport,
  type ImportPreview,
  type ImportRegister,
} from "@/lib/registers/import";
import { plainDatabaseMessage } from "@/lib/registers/messages";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { loadQuestionnaire } from "@/server/path/state";
import {
  accountModuleIds,
  afterStaffMatrixSave,
  todaySydney,
} from "@/server/registers/worker-onboarding";
import { createSupabaseServerClient } from "@/server/supabase/server";

const Register = z.enum(IMPORT_REGISTERS);
const Text = z.string().max(IMPORT_LIMITS.bytes + 16);

const PreviewInput = strictObject({ register: Register, text: Text });

export type ImportCommitResult =
  | {
      ok: true;
      imported: number;
      failed: number;
      importId: string;
      /** REQ-024 FR-13: staff rows left out because their code is already on the list (the register keys on it). */
      alreadyListed?: number;
    }
  | { ok: false; message: string };

async function owner() {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return null;
  return {
    viewer,
    accountId: viewer.account.id,
    supabase: await createSupabaseServerClient(),
  };
}

/** FR-8: the preview with every row's result; nothing is written. */
export async function previewImportAction(
  input: unknown,
): Promise<ImportPreview> {
  const parsed = parseInput(PreviewInput, input);
  if (!parsed.ok) return { ok: false, message: "Choose a CSV file first." };
  if (!(await owner())) return { ok: false, message: "Sign in to import." };
  return previewImport(parsed.data.register, parsed.data.text);
}

/** FR-8: writes the rows that pass; nothing is partially written within a row. */
export async function commitImportAction(
  input: unknown,
): Promise<ImportCommitResult> {
  const parsed = parseInput(PreviewInput, input);
  if (!parsed.ok) return { ok: false, message: "Choose a CSV file first." };
  const o = await owner();
  if (!o) return { ok: false, message: "Sign in to import." };
  if (
    !(await hitRateLimit(`import:${o.accountId}`, {
      limit: IMPORT_LIMITS.perHour,
      windowSeconds: 3600,
    }))
  )
    return {
      ok: false,
      message:
        "You have imported several times in the last hour. Please try again later.",
    };
  const register: ImportRegister = parsed.data.register;
  const preview = previewImport(register, parsed.data.text);
  if (!preview.ok) return preview;
  let rows = preview.rows
    .filter((r) => r.ok && r.row)
    .map((r) => ({
      account_id: o.accountId,
      ...(r.row as Record<string, unknown>),
    }));
  // FR-13: a code already on the staff list is left out rather than failing the whole insert on the key; the count comes back.
  let alreadyListed = 0;
  if (register === "staff_matrix") {
    const existing = await o.supabase
      .from("staff_matrix")
      .select("worker_ref")
      .eq("account_id", o.accountId);
    const codes = new Set(
      ((existing.data as { worker_ref: string }[] | null) ?? []).map(
        (r) => r.worker_ref,
      ),
    );
    const kept = rows.filter(
      (r) => !codes.has(String((r as Record<string, unknown>).worker_ref)),
    );
    alreadyListed = rows.length - kept.length;
    rows = kept;
  }
  if (rows.length === 0)
    return {
      ok: false,
      message:
        alreadyListed > 0
          ? "Every passing row's worker code is already on your staff list; nothing was imported. Edit those workers on their own rows."
          : "No row passed; nothing was imported.",
    };
  const ins = await o.supabase.from(register).insert(rows).select("id");
  if (ins.error) {
    log.warn("registers.import.failed", {
      accountId: o.accountId,
      register,
      code: ins.error.code,
    });
    return { ok: false, message: plainDatabaseMessage(ins.error) };
  }
  const ids = ((ins.data as { id: string }[] | null) ?? []).map((r) => r.id);
  const imp = await o.supabase
    .from("imports")
    .insert({
      account_id: o.accountId,
      register,
      rows_total: preview.rows.length,
      rows_imported: ids.length,
      row_ids: ids,
      created_by: o.viewer.user.id,
    })
    .select("id")
    .single();
  if (imp.error) return { ok: false, message: plainDatabaseMessage(imp.error) };
  const importId = imp.data.id as string;
  // One trail line per row (FR-8), on the shared register_events table.
  const trail = await o.supabase.from("register_events").insert(
    ids.map((id) => ({
      account_id: o.accountId,
      register,
      row_id: id,
      kind: "imported",
      note: `Imported from a spreadsheet (import ${importId.slice(0, 8)})`,
    })),
  );
  if (trail.error)
    log.warn("registers.import.trail-failed", {
      accountId: o.accountId,
      register,
      code: trail.error.code,
    });
  // Incidents and complaints keep their own trails on their pages: the same line there.
  if (register === "incidents" || register === "complaints") {
    const events =
      register === "incidents" ? "incident_events" : "complaint_events";
    const key = register === "incidents" ? "incident_id" : "complaint_id";
    const own = await o.supabase.from(events).insert(
      ids.map((id) => ({
        [key]: id,
        account_id: o.accountId,
        kind: "note",
        note: "Imported from a spreadsheet",
      })),
    );
    if (own.error)
      log.warn("registers.import.own-trail-failed", {
        accountId: o.accountId,
        register,
        code: own.error.code,
      });
  }
  // REQ-024 FR-13 (D-2402, finding 110): the roles, the forced flag, the s 20 dates and each worker's derived checklist, as a saved row gets them; items are never imported.
  if (register === "staff_matrix") {
    const { result } = await loadQuestionnaire();
    const moduleIds = await accountModuleIds(o.supabase, o.accountId, result);
    const today = todaySydney();
    for (const [i, id] of ids.entries()) {
      // PostgREST returns the inserted rows in the order sent, so the row's own start day is the s 20 date.
      const started = rows[i] as { started_on?: string | null } | undefined;
      const after = await afterStaffMatrixSave(o.supabase, {
        accountId: o.accountId,
        userId: o.viewer.user.id,
        rowId: id,
        before: null,
        isMe: false,
        effectiveOn: started?.started_on || today,
        moduleIds,
        today,
      });
      if (!after.ok)
        log.warn("registers.import.after-save", {
          accountId: o.accountId,
          register,
        });
    }
  }
  await o.supabase.from("audit_log").insert({
    account_id: o.accountId,
    actor_user_id: o.viewer.user.id,
    action: `register.${register}.imported`,
    target: `${importId} ${ids.length}/${preview.rows.length}`,
  });
  return {
    ok: true,
    imported: ids.length,
    failed: preview.failed,
    importId,
    ...(alreadyListed ? { alreadyListed } : {}),
  };
}

const UndoInput = strictObject({ id: z.string().uuid() });

export type UndoResult =
  { ok: true; removed: number } | { ok: false; message: string };

/** FR-12: the owner deletes every row of an import within an hour; after that the rows are ordinary. */
export async function undoImportAction(input: unknown): Promise<UndoResult> {
  const parsed = parseInput(UndoInput, input);
  if (!parsed.ok) return { ok: false, message: "That import was not found." };
  const o = await owner();
  if (!o) return { ok: false, message: "Sign in to undo an import." };
  const imp = await o.supabase
    .from("imports")
    .select("id, register, row_ids, created_at, undone_at")
    .eq("id", parsed.data.id)
    .eq("account_id", o.accountId)
    .maybeSingle();
  const row = imp.data as {
    id: string;
    register: ImportRegister;
    row_ids: string[];
    created_at: string;
    undone_at: string | null;
  } | null;
  if (!row || row.undone_at)
    return {
      ok: false,
      message: "That import was not found or is already undone.",
    };
  if (!canUndoImport(row.created_at, new Date()))
    return {
      ok: false,
      message:
        "More than an hour has passed; the rows are now ordinary entries you edit or delete one by one.",
    };
  // REQ-024 FR-13: an undone staff import takes its derived checklists with it where nothing was ticked on them.
  const codes =
    row.register === "staff_matrix"
      ? ((
          (
            await o.supabase
              .from("staff_matrix")
              .select("worker_ref")
              .eq("account_id", o.accountId)
              .in("id", row.row_ids)
          ).data as { worker_ref: string }[] | null
        )?.map((r) => r.worker_ref) ?? [])
      : [];
  const del = await o.supabase
    .from(row.register)
    .delete()
    .eq("account_id", o.accountId)
    .in("id", row.row_ids)
    .select("id");
  if (del.error) return { ok: false, message: plainDatabaseMessage(del.error) };
  const removed = del.data?.length ?? 0;
  if (codes.length > 0) {
    const lists = await o.supabase
      .from("onboarding_checklists")
      .select("id, subject_ref")
      .eq("account_id", o.accountId)
      .eq("kind", "worker")
      .in("subject_ref", codes);
    const listIds = ((lists.data as { id: string }[] | null) ?? []).map(
      (l) => l.id,
    );
    if (listIds.length > 0) {
      const ticked = await o.supabase
        .from("onboarding_ticks")
        .select("checklist_id")
        .in("checklist_id", listIds);
      const keep = new Set(
        ((ticked.data as { checklist_id: string }[] | null) ?? []).map(
          (t) => t.checklist_id,
        ),
      );
      const gone = listIds.filter((id) => !keep.has(id));
      if (gone.length > 0)
        await o.supabase
          .from("onboarding_checklists")
          .delete()
          .eq("account_id", o.accountId)
          .in("id", gone);
    }
  }
  const mark = await o.supabase
    .from("imports")
    .update({ undone_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("account_id", o.accountId)
    .select("id");
  if (mark.error || !mark.data?.length)
    return {
      ok: false,
      message: "Only the account's owner can undo an import.",
    };
  await o.supabase.from("audit_log").insert({
    account_id: o.accountId,
    actor_user_id: o.viewer.user.id,
    action: `register.${row.register}.import-undone`,
    target: `${row.id} ${removed}`,
  });
  return { ok: true, removed };
}

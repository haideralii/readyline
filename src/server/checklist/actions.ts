"use server";
/**
 * Saving a checklist item (REQ-006 FR-3, SR-1). One row per account and item,
 * written with the caller's own session so RLS keeps it to their account.
 * The item id must be one the current result derives, so a stray id can
 * never be stored; the note is capped at 500 characters and carries the
 * no-participant-data warning on the field.
 */
import { z } from "zod";
import {
  CHECKLIST_STATUSES,
  checklistPeriod,
  deriveChecklist,
} from "@/lib/checklist/derive";
import { log } from "@/lib/logging/logger";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { parseInput, strictObject } from "@/lib/validation";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";
import { latestOwnershipChangeOn } from "@/server/registers/commission-changes-queries";
import { currentPeriod } from "@/server/registers/registration-queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

const Input = strictObject({
  itemId: z.string().regex(/^[a-z]+:[a-z0-9-]+$/),
  status: z.enum(CHECKLIST_STATUSES),
  note: z.string().max(500).default(""),
  // REQ-023 FR-4: a dated item's date; "" clears it. A date sets `have`, a clear sets `need` (finding 80).
  doneOn: z
    .string()
    .max(10)
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v))
    .optional(),
});

export type SaveChecklistResult = { ok: true } | { ok: false; message: string };

export async function saveChecklistItemAction(
  input: unknown,
): Promise<SaveChecklistResult> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok) return { ok: false, message: "That change was not valid." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in to save your checklist." };

  const draft = await loadServerDraft();
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const answers = draft
    ? schema.safeParse({ answersVersion: ANSWERS_VERSION, ...draft.answers })
    : null;
  if (!answers?.success)
    return { ok: false, message: "Finish the questionnaire first." };
  const built = buildResult(dataset, answers.data);
  if (!built.ok) return { ok: false, message: built.message };
  const supabase = await createSupabaseServerClient();
  // REQ-023 FR-4: the dated audit items exist once a period does (finding 62).
  const period = checklistPeriod(
    await currentPeriod(supabase, viewer.account.id),
    // REQ-023 FR-4 (Session D): the change-of-ownership item reads the changes register.
    await latestOwnershipChangeOn(supabase, viewer.account.id),
  );
  const checklist = deriveChecklist(
    built.result,
    answers.data,
    dataset,
    period,
  );
  const item = checklist.items.find((i) => i.id === parsed.data.itemId);
  if (!item)
    return { ok: false, message: "That item is not on your checklist." };
  const doneOn =
    item.dated && parsed.data.doneOn !== undefined
      ? parsed.data.doneOn || null
      : undefined;
  const status =
    doneOn === undefined ? parsed.data.status : doneOn ? "have" : "need";

  const up = await supabase.from("checklist_items").upsert(
    {
      account_id: viewer.account.id,
      item_id: parsed.data.itemId,
      status,
      note: parsed.data.note,
      ...(doneOn === undefined ? {} : { done_on: doneOn }),
    },
    { onConflict: "account_id,item_id" },
  );
  if (up.error) {
    log.warn("checklist.save.failed", {
      accountId: viewer.account.id,
      code: up.error.code,
    });
    return { ok: false, message: "We could not save that just now." };
  }
  // D-2450 (REQ-024, PO, 17 Oct 2026; QA pass F4): "Done" records `have`
  // alone. Adoption is approval with the adopt step's gates (no open blanks,
  // D-2211; a named approver, D-2244), so the adopt step and the document
  // page's own action are the only writers of a version's adopted date; the
  // REQ-009 FR-7 rule that a tick adopted the document is withdrawn.
  return { ok: true };
}

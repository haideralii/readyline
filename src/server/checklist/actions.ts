"use server";
/**
 * Saving a checklist item (REQ-006 FR-3, SR-1). One row per account and item,
 * written with the caller's own session so RLS keeps it to their account.
 * The item id must be one the current result derives, so a stray id can
 * never be stored; the note is capped at 500 characters and carries the
 * no-participant-data warning on the field.
 */
import { z } from "zod";
import { CHECKLIST_STATUSES, deriveChecklist } from "@/lib/checklist/derive";
import { log } from "@/lib/logging/logger";
import { ANSWERS_VERSION, answersSchemaFor } from "@/lib/questionnaire/schema";
import { buildResult } from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { parseInput, strictObject } from "@/lib/validation";
import { loadServerDraft } from "@/server/accounts/actions";
import { getViewer } from "@/server/accounts/queries";
import { markAdopted } from "@/server/registers/seed";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

const Input = strictObject({
  itemId: z.string().regex(/^[a-z]+:[a-z0-9-]+$/),
  status: z.enum(CHECKLIST_STATUSES),
  note: z.string().max(500).default(""),
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
  const checklist = deriveChecklist(built.result, answers.data, dataset);
  if (!checklist.items.some((i) => i.id === parsed.data.itemId))
    return { ok: false, message: "That item is not on your checklist." };

  const supabase = await createSupabaseServerClient();
  const up = await supabase.from("checklist_items").upsert(
    {
      account_id: viewer.account.id,
      item_id: parsed.data.itemId,
      status: parsed.data.status,
      note: parsed.data.note,
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
  // REQ-009 FR-7: "Done" on a document sets the policy review's adopted date
  // when it is still empty. With the admin client (D-1704): the policy
  // reviews' update policy needs an active subscription, which a pack buyer
  // ticking Done need not have; the account id is the viewer's own.
  if (parsed.data.status === "have") {
    const item = checklist.items.find((i) => i.id === parsed.data.itemId);
    if (item?.documentTypeId)
      await markAdopted(
        createSupabaseAdminClient(),
        viewer.account.id,
        item.documentTypeId,
        new Date().toISOString().slice(0, 10),
      );
  }
  return { ok: true };
}

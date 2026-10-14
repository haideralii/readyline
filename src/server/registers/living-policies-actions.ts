"use server";
/**
 * The owner's answer to a rule change on an adopted document (backlog 8,
 * D-551): "I have checked it" records the check so the register stops
 * asking; the other answer, re-generating the section, is the existing
 * regenerate action and clears the flag by making a newer version.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { loadWatchChanges } from "@/lib/registers/living-policies";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseServerClient } from "@/server/supabase/server";

const Input = strictObject({
  documentTypeId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  changeId: z.string().regex(/^wc-\d{4}-\d{2}-\d{2}-\d{2}$/),
  note: z.string().max(300).optional(),
});

export type ChangeReviewResult = { ok: true } | { ok: false; message: string };

export async function markChangeReviewedAction(
  input: unknown,
): Promise<ChangeReviewResult> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok) return { ok: false, message: "Invalid request." };
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted)
    return { ok: false, message: "Sign in first." };
  if (!loadWatchChanges().some((c) => c.id === parsed.data.changeId))
    return { ok: false, message: "That change is not on the list." };
  const supabase = await createSupabaseServerClient();
  const r = await supabase.from("document_change_reviews").insert({
    account_id: viewer.account.id,
    document_type_id: parsed.data.documentTypeId,
    change_id: parsed.data.changeId,
    note: parsed.data.note ?? "",
  });
  if (r.error && r.error.code !== "23505")
    return {
      ok: false,
      message:
        r.error.code === "42501"
          ? "Only the owner can record a check."
          : "Could not save the check just now.",
    };
  log.info("registers.document-control.change-checked", {
    accountId: viewer.account.id,
    documentTypeId: parsed.data.documentTypeId,
    changeId: parsed.data.changeId,
  });
  revalidatePath("/registers/document-control");
  revalidatePath("/path/audit-day");
  return { ok: true };
}

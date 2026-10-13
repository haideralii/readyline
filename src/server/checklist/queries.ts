import "server-only";
/**
 * Reads for the checklist page (REQ-006 FR-2, FR-3), with the user's session
 * so RLS applies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoredItem } from "@/lib/checklist/state";

export async function listChecklistItems(
  supabase: SupabaseClient,
  accountId: string,
): Promise<StoredItem[]> {
  const r = await supabase
    .from("checklist_items")
    .select("item_id, status, note")
    .eq("account_id", accountId)
    .limit(500);
  type Row = { item_id: string; status: StoredItem["status"]; note: string };
  return ((r.data as Row[] | null) ?? []).map((row) => ({
    itemId: row.item_id,
    status: row.status,
    note: row.note ?? "",
  }));
}

/** The account's newest ready set and the document type ids in it (FR-2 "drafted"; REQ-017 step 6 one-tap links). */
export async function latestReadySet(
  supabase: SupabaseClient,
  accountId: string,
): Promise<{ setId: string | null; documentTypeIds: string[] }> {
  const set = await supabase
    .from("version_sets")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!set.data) return { setId: null, documentTypeIds: [] };
  const setId = set.data.id as string;
  const docs = await supabase
    .from("document_versions")
    .select("document_type_id")
    .eq("version_set_id", setId);
  return {
    setId,
    documentTypeIds: (
      (docs.data as { document_type_id: string }[] | null) ?? []
    ).map((d) => d.document_type_id),
  };
}

/** Document type ids in the account's newest ready set (FR-2 "drafted"). */
export async function listDraftedDocumentTypeIds(
  supabase: SupabaseClient,
  accountId: string,
): Promise<string[]> {
  return (await latestReadySet(supabase, accountId)).documentTypeIds;
}

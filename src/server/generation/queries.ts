import "server-only";
/**
 * Reads for the documents pages, with the user's session so RLS applies
 * (REQ-005 FR-5, FR-6).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentVersionRow, VersionSetRow } from "./store";

export async function listVersionSets(
  supabase: SupabaseClient,
  accountId: string,
): Promise<VersionSetRow[]> {
  const r = await supabase
    .from("version_sets")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (r.data as VersionSetRow[] | null) ?? [];
}

export async function getVersionSet(
  supabase: SupabaseClient,
  id: string,
): Promise<VersionSetRow | null> {
  const r = await supabase
    .from("version_sets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (r.data as VersionSetRow | null) ?? null;
}

/** Latest version of every document in a set. */
export async function listLatestDocuments(
  supabase: SupabaseClient,
  versionSetId: string,
): Promise<DocumentVersionRow[]> {
  const r = await supabase
    .from("document_versions")
    .select("*")
    .eq("version_set_id", versionSetId)
    .order("version", { ascending: false });
  const rows = (r.data as DocumentVersionRow[] | null) ?? [];
  const latest = new Map<string, DocumentVersionRow>();
  for (const row of rows)
    if (!latest.has(row.document_type_id))
      latest.set(row.document_type_id, row);
  return [...latest.values()].sort((a, b) =>
    a.document_type_id.localeCompare(b.document_type_id),
  );
}

/** REQ-026: the version the pack shipped (1) of every document in a set; the sheet's lines come from it. */
export async function listFirstDocuments(
  supabase: SupabaseClient,
  versionSetId: string,
): Promise<DocumentVersionRow[]> {
  const r = await supabase
    .from("document_versions")
    .select("*")
    .eq("version_set_id", versionSetId)
    .eq("version", 1);
  return (r.data as DocumentVersionRow[] | null) ?? [];
}

export async function listDocumentVersions(
  supabase: SupabaseClient,
  versionSetId: string,
  documentTypeId: string,
): Promise<DocumentVersionRow[]> {
  const r = await supabase
    .from("document_versions")
    .select("*")
    .eq("version_set_id", versionSetId)
    .eq("document_type_id", documentTypeId)
    .order("version", { ascending: false });
  return (r.data as DocumentVersionRow[] | null) ?? [];
}

export async function getDocumentVersion(
  supabase: SupabaseClient,
  id: string,
): Promise<DocumentVersionRow | null> {
  const r = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (r.data as DocumentVersionRow | null) ?? null;
}

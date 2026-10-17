import "server-only";
/**
 * REQ-024 Session A3 (FR-6a; D-2409): the export screen pre-fills the s 17
 * assessor's name from the owner's own name in the account facts (the
 * `name` fact the account page saves), with no new collection; the owner
 * types over it when the assessor was someone else.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFacts } from "@/server/path/facts";

export async function ownerNameFact(
  supabase: SupabaseClient,
  accountId: string,
): Promise<string> {
  const facts = await loadFacts(supabase, accountId);
  const name = facts.name?.trim() ?? "";
  const role = facts.role?.trim() ?? "";
  return name ? (role ? `${name}, ${role}` : name) : "";
}

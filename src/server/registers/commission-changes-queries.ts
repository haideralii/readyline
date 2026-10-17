import "server-only";
/**
 * Reads for the changes register (REQ-023 Session D, FR-10): the latest
 * change of ownership, which FR-2's timeline row and FR-4's checklist item
 * read (findings 47 and 86), with the caller's session so RLS applies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** The day of the latest change of ownership recorded (the first necessary step, s 13A(3)), or null. */
export async function latestOwnershipChangeOn(
  supabase: SupabaseClient,
  accountId: string,
): Promise<string | null> {
  const r = await supabase
    .from("commission_changes")
    .select("happened_on")
    .eq("account_id", accountId)
    .eq("change_type", "change-of-ownership")
    .order("happened_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (r.data as { happened_on: string } | null)?.happened_on ?? null;
}

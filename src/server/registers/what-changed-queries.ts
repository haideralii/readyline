/**
 * REQ-031 FR-5 (D-2890): when the registers "What changed since the last
 * audit" reads last moved. The summary's own dates are the ones the owner
 * typed (an incident's day, a review's day), which cannot order a reading
 * and a change made on the same day, so the reading is compared with the
 * rows' own `updated_at`: a row written after the reading, whatever day it
 * is dated for, makes the step "to read" again (AC-10's second given).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** The registers the summary reads (REQ-023 FR-6, FR-10); a row written in any of them is a change. */
export const WHAT_CHANGED_TABLES = [
  "incidents",
  "complaints",
  "worker_clearances",
  "policy_reviews",
  "commission_changes",
] as const;

/** The newest `updated_at` among the account's rows in those registers, or null when there is none. */
export async function latestRegisterChangeAt(
  supabase: SupabaseClient,
  accountId: string,
): Promise<string | null> {
  const newest = await Promise.all(
    WHAT_CHANGED_TABLES.map(async (table) => {
      const r = await supabase
        .from(table)
        .select("updated_at")
        .eq("account_id", accountId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r.error) throw r.error;
      return (r.data as { updated_at: string } | null)?.updated_at ?? null;
    }),
  );
  return newest.reduce<string | null>(
    (max, at) => (at && (!max || Date.parse(at) > Date.parse(max)) ? at : max),
    null,
  );
}

import "server-only";
/**
 * Reads for the quarterly self-check (REQ-020 FR-9): the last walk and
 * the findings still open in the improvement register, with the user's
 * session so RLS applies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SelfCheckRow = {
  id: string;
  walked_on: string;
  walked_by_ref: string;
  findings: number;
  created_at: string;
};

/** The last quarterly walk; a rehearsal (REQ-023 FR-8) is not a walk and never resets the quarter. */
export async function lastSelfCheck(
  supabase: SupabaseClient,
  accountId: string,
): Promise<SelfCheckRow | null> {
  const r = await supabase
    .from("self_checks")
    .select("id, walked_on, walked_by_ref, findings, created_at")
    .eq("account_id", accountId)
    .eq("mode", "walk")
    .order("walked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (r.data as SelfCheckRow | null) ?? null;
}

export type RehearsalRow = SelfCheckRow & {
  period_from: string;
  period_to: string;
  answers: Record<string, { answer: "yes" | "no"; note: string }>;
};

/** REQ-023 FR-8: the newest rehearsal, with its answers for the sheet; null when none. */
export async function lastRehearsal(
  supabase: SupabaseClient,
  accountId: string,
): Promise<RehearsalRow | null> {
  const r = await supabase
    .from("self_checks")
    .select(
      "id, walked_on, walked_by_ref, findings, created_at, period_from, period_to, answers",
    )
    .eq("account_id", accountId)
    .eq("mode", "rehearsal")
    .order("walked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (r.data as RehearsalRow | null) ?? null;
}

/** Improvement rows from a self-check that are not done yet. */
export async function openSelfCheckFindings(
  supabase: SupabaseClient,
  accountId: string,
): Promise<number> {
  const r = await supabase
    .from("improvements")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("source_kind", "self-check")
    .is("done_on", null);
  return r.count ?? 0;
}

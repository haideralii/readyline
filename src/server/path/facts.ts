import "server-only";
/**
 * The account facts behind the "Finish your pack" form (REQ-017 FR-2,
 * D-1702): one row per fact key in `account_facts`, read and written with
 * the owner's session (RLS) and read by the job with the admin client when a
 * new pack is drafted, so a second pack carries the same answers (AC-2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Facts = Record<string, string>;

export async function loadFacts(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Facts> {
  const r = await supabase
    .from("account_facts")
    .select("key, value")
    .eq("account_id", accountId)
    .limit(200);
  const out: Facts = {};
  for (const row of (r.data as { key: string; value: string }[] | null) ?? [])
    out[row.key] = row.value;
  return out;
}

export async function saveFact(
  supabase: SupabaseClient,
  accountId: string,
  key: string,
  value: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const r = await supabase
    .from("account_facts")
    .upsert(
      { account_id: accountId, key, value },
      { onConflict: "account_id,key" },
    );
  return r.error ? { ok: false, code: r.error.code } : { ok: true };
}

/** REQ-029 D-2856: when a fact was last saved (ISO), or null when the account holds no row for the key. */
export async function loadFactUpdatedAt(
  supabase: SupabaseClient,
  accountId: string,
  key: string,
): Promise<string | null> {
  const r = await supabase
    .from("account_facts")
    .select("updated_at")
    .eq("account_id", accountId)
    .eq("key", key)
    .maybeSingle();
  return (r.data as { updated_at?: string } | null)?.updated_at ?? null;
}

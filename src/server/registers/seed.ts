import "server-only";
/**
 * REQ-009 FR-7: seed the policy reviews from a purchased pack, once. On the
 * first visit to the register when the account has a ready set and no rows,
 * one row per document is inserted with no adopted date (the checklist tick
 * sets it). Idempotent: a second call with rows present does nothing, and
 * the unique (account, document, title) key stops duplicates in a race.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/logging/logger";

export async function seedPolicyReviews(
  supabase: SupabaseClient,
  accountId: string,
): Promise<number> {
  const existing = await supabase
    .from("policy_reviews")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if ((existing.count ?? 0) > 0) return 0;
  const set = await supabase
    .from("version_sets")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!set.data) return 0;
  const docs = await supabase
    .from("document_versions")
    .select("document_type_id")
    .eq("version_set_id", set.data.id as string);
  const ids = Array.from(
    new Set(
      ((docs.data as { document_type_id: string }[] | null) ?? []).map(
        (d) => d.document_type_id,
      ),
    ),
  );
  if (ids.length === 0) return 0;
  const ins = await supabase.from("policy_reviews").upsert(
    ids.map((id) => ({
      account_id: accountId,
      document_type_id: id,
      title: "",
      review_cycle_months: /register/.test(id) ? 3 : 12,
    })),
    { onConflict: "account_id,document_type_id,title", ignoreDuplicates: true },
  );
  if (ins.error) {
    log.warn("registers.policy-reviews.seed.failed", {
      accountId,
      code: ins.error.code,
    });
    return 0;
  }
  log.info("registers.policy-reviews.seeded", { accountId, count: ids.length });
  return ids.length;
}

/**
 * FR-7, the other direction: a checklist item ticked "Done" (adopted) sets
 * `adopted_on` on the matching policy review when it is still empty.
 */
export async function markAdopted(
  supabase: SupabaseClient,
  accountId: string,
  documentTypeId: string,
  adoptedOn: string,
): Promise<void> {
  await supabase
    .from("policy_reviews")
    .update({ adopted_on: adoptedOn })
    .eq("account_id", accountId)
    .eq("document_type_id", documentTypeId)
    .is("adopted_on", null);
}

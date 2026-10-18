import "server-only";
/**
 * REQ-029 FR-3 (D-2854, D-2855): the two fills at read time. The stored
 * model is the template; every download, every document page and every
 * derived file renders it through `fillForRead` with what the account holds
 * now (the live facts and the ABN) and what the version's adoption snapshot
 * holds (the approver's name and role and the day). Nothing here writes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Adoption, fillForRead } from "@/lib/generator/adoption";
import type { DocumentModel } from "@/lib/generator/document-model";
import { formatAbn } from "@/lib/generator/facts";
import { loadFacts, type Facts } from "@/server/path/facts";
import type { DocumentVersionRow } from "./store";

export type ReadFillInputs = {
  facts: Facts;
  /** The account's ABN formatted "NN NNN NNN NNN", or null (FR-8: only this part of the Provider cell rebuilds). */
  abn: string | null;
  /** Each type's next review date from the register's mirror row, when it has one. */
  nextReview: Map<string, string>;
};

/** What every read-time fill needs for one account, read with the client given (the owner's session or the admin client scoped to the account). */
export async function readFillInputs(
  supabase: SupabaseClient,
  accountId: string,
): Promise<ReadFillInputs> {
  const [facts, account, reviews] = await Promise.all([
    loadFacts(supabase, accountId),
    supabase.from("accounts").select("abn").eq("id", accountId).maybeSingle(),
    supabase
      .from("policy_reviews")
      .select("document_type_id, next_review_on")
      .eq("account_id", accountId)
      .eq("title", "")
      .limit(500),
  ]);
  const nextReview = new Map<string, string>();
  for (const r of (reviews.data as
    { document_type_id: string; next_review_on: string | null }[] | null) ?? [])
    if (r.next_review_on) nextReview.set(r.document_type_id, r.next_review_on);
  return {
    facts,
    abn: formatAbn((account.data as { abn?: string | null } | null)?.abn),
    nextReview,
  };
}

/** The version's adoption for the fill, or null while it is a draft: the day and the snapshot from the row, the next review from the register (the model's own date when the mirror has none). */
export function adoptionForRow(
  row: Pick<
    DocumentVersionRow,
    | "document_type_id"
    | "adopted_on"
    | "approver_name"
    | "approver_role"
    | "model"
  >,
  inputs: Pick<ReadFillInputs, "nextReview">,
): Adoption | null {
  if (!row.adopted_on) return null;
  return {
    adoptedOn: row.adopted_on,
    nextReviewOn:
      inputs.nextReview.get(row.document_type_id) ?? row.model.reviewDueAt,
    approverName: row.approver_name ?? null,
    approverRole: row.approver_role ?? null,
  };
}

/** The stored model as a download renders it: both fills and the ABN rebuild; the row is left as it is. */
export function filledForRead(
  row: Pick<
    DocumentVersionRow,
    | "document_type_id"
    | "adopted_on"
    | "approver_name"
    | "approver_role"
    | "model"
  >,
  inputs: ReadFillInputs,
): DocumentModel {
  return fillForRead(row.model, {
    facts: inputs.facts,
    adoption: adoptionForRow(row, inputs),
    abn: inputs.abn,
  });
}

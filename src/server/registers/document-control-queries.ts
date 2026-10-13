import "server-only";
/**
 * The document control register, read from the pack (REQ-018 FR-13, FR-14;
 * D-1906): the newest ready set's documents, their policy reviews, the
 * circulation rows and the owner's role from the account facts, folded by
 * the pure `documentControlRows`. Two entry points: the page and the
 * registers index read with the user's session (RLS); the generation job
 * and the re-render read with the admin client for a set they already own.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  documentControlRows,
  type DocumentControlRow,
} from "@/lib/registers/document-control";
import { listLatestDocuments } from "@/server/generation/queries";
import { loadFacts } from "@/server/path/facts";

function todaySydney(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function documentControlForSet(
  supabase: SupabaseClient,
  accountId: string,
  setId: string,
): Promise<DocumentControlRow[]> {
  const [docs, reviews, circulations, facts] = await Promise.all([
    listLatestDocuments(supabase, setId),
    supabase
      .from("policy_reviews")
      .select(
        "document_type_id, adopted_on, review_cycle_months, last_reviewed_on, next_review_on",
      )
      .eq("account_id", accountId)
      .limit(500),
    supabase
      .from("policy_circulations")
      .select("document_type_id, circulated_on, worker_refs")
      .eq("account_id", accountId)
      .limit(2000),
    loadFacts(supabase, accountId),
  ]);
  return documentControlRows(
    {
      documents: docs.map((d) => ({
        document_type_id: d.document_type_id,
        title: d.model.title,
        version: d.version,
        created_at: d.created_at,
      })),
      reviews:
        (reviews.data as
          | {
              document_type_id: string;
              adopted_on: string | null;
              review_cycle_months: number;
              last_reviewed_on: string | null;
              next_review_on: string | null;
            }[]
          | null) ?? [],
      circulations:
        (circulations.data as
          | {
              document_type_id: string;
              circulated_on: string;
              worker_refs: string;
            }[]
          | null) ?? [],
      adoptedByRole: facts.role ?? null,
    },
    todaySydney(),
  );
}

/** The newest ready set's register, or an empty list when there is no ready set. */
export async function documentControlForAccount(
  supabase: SupabaseClient,
  accountId: string,
): Promise<{ setId: string | null; rows: DocumentControlRow[] }> {
  const set = await supabase
    .from("version_sets")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!set.data) return { setId: null, rows: [] };
  const setId = set.data.id as string;
  return {
    setId,
    rows: await documentControlForSet(supabase, accountId, setId),
  };
}

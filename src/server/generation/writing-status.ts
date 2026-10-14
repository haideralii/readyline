import "server-only";
/**
 * The writing indicator's status for a signed-in owner (REQ-021, D-2101):
 * the newest pack job read with the owner's session (RLS), the set's
 * documents by their canonical titles in set order, the guided path's next
 * step once the set is ready, and the usual time from the last packs. Pure
 * mapping in `@/lib/generation/writing-state`; this file only reads.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { documentTypeById } from "@/lib/generator/catalogue";
import { auditOrder } from "@/lib/generator/set-order";
import {
  statusFromJob,
  usualMinutesFrom,
  type JobSnapshot,
  type WritingStatus,
} from "@/lib/generation/writing-state";
import { deriveDocumentsState } from "@/lib/payments/documents-state";
import type { Viewer } from "@/server/accounts/queries";
import {
  listEntitlements,
  listGenerationJobs,
  listPurchases,
} from "@/server/payments/queries";
import { loadQuestionnaire, nextStepFor } from "@/server/path/state";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SELF_ASSESSMENT_ID } from "./run";
import { parseFailedDocuments } from "./job";

export type JobStatusRow = {
  id: string;
  status: JobSnapshot["status"];
  phase: string | null;
  next_document_index: number;
  document_total: number | null;
  current_document_type_id: string | null;
  current_section_index: number | null;
  section_count: number | null;
  last_progress_at: string | null;
  version_set_id: string | null;
  failed_documents: unknown;
  entitlement_id: string | null;
  created_at: string;
};

/** The newest job for the account's active entitlement, with the indicator's columns. */
export async function readActiveJob(
  supabase: SupabaseClient,
  accountId: string,
): Promise<JobStatusRow | null> {
  const [purchases, entitlements, jobs] = await Promise.all([
    listPurchases(supabase, accountId),
    listEntitlements(supabase, accountId),
    listGenerationJobs(supabase, accountId),
  ]);
  const state = deriveDocumentsState({ purchases, entitlements, jobs });
  const entitlement = entitlements.find((e) => !e.revokedAt) ?? null;
  if (state.kind === "none" || state.kind === "refunded" || !entitlement)
    return null;
  const r = await supabase
    .from("generation_jobs")
    .select(
      "id, status, phase, next_document_index, document_total, current_document_type_id, current_section_index, section_count, last_progress_at, version_set_id, failed_documents, entitlement_id, created_at",
    )
    .eq("account_id", accountId)
    .eq("entitlement_id", entitlement.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (r.error || !r.data) return null;
  return r.data as JobStatusRow;
}

/** The set's documents in set order by canonical title, from the saved answers (the job's own list). */
export async function setDocumentsFor(): Promise<
  { typeId: string; title: string }[]
> {
  const { result } = await loadQuestionnaire();
  if (!result) return [];
  const ids = auditOrder([
    ...result.documents.map((d) => d.id),
    SELF_ASSESSMENT_ID,
  ]);
  return ids.map((typeId) => ({
    typeId,
    title: documentTypeById(typeId)?.title ?? typeId,
  }));
}

/** S12: the median of the last 50 packs' durations, rounded up to 5 minutes; null until 20 exist. Admin read, no account data returned. */
export async function usualMinutes(): Promise<number | null> {
  try {
    const admin = createSupabaseAdminClient();
    const r = await admin
      .from("generation_jobs")
      .select("created_at, updated_at")
      .eq("status", "ready")
      .order("updated_at", { ascending: false })
      .limit(50);
    const rows =
      (r.data as { created_at: string; updated_at: string }[] | null) ?? [];
    return usualMinutesFrom(
      rows.map((x) => Date.parse(x.updated_at) - Date.parse(x.created_at)),
    );
  } catch {
    return null;
  }
}

export async function writingStatusFor(
  supabase: SupabaseClient,
  viewer: Viewer & { account: NonNullable<Viewer["account"]> },
): Promise<WritingStatus | null> {
  const job = await readActiveJob(supabase, viewer.account.id);
  if (!job) return null;
  const [setDocuments, usual] = await Promise.all([
    setDocumentsFor(),
    usualMinutes(),
  ]);
  const snapshot: JobSnapshot = {
    status: job.status,
    phase: job.phase,
    nextDocumentIndex: job.next_document_index,
    documentTotal: job.document_total ?? (setDocuments.length || null),
    currentDocumentTypeId: job.current_document_type_id,
    currentSectionIndex: job.current_section_index ?? 0,
    sectionCount: job.section_count ?? 0,
    lastProgressAt: job.last_progress_at,
    versionSetId: job.version_set_id,
    failedDocuments: parseFailedDocuments(job.failed_documents).map((f) => ({
      typeId: f.typeId,
      kind: f.kind,
    })),
  };
  const ready = job.status === "ready";
  const step = ready ? await nextStepFor(supabase, viewer) : null;
  return statusFromJob({
    job: snapshot,
    setDocuments,
    nextStep: step ? step.button : null,
    usualMinutes: usual,
    serverTime: new Date().toISOString(),
  });
}

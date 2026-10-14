"use server";
/**
 * The owner's two answers when a document needs another go (REQ-021 S4,
 * D-2101): try that document again, or continue without it. Both act on
 * the owner's own job only (checked with the session, written with the
 * service key, like the nudge), put the job back in the queue and start
 * a budgeted run at once, so the provider is not waiting for the cron.
 */
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { getViewer } from "@/server/accounts/queries";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { parseFailedDocuments, type JobProgress } from "./job";
import { continueGeneration, keepAlive } from "./kick";
import { readActiveJob } from "./writing-status";

const Input = strictObject({ typeId: z.string().min(1).max(80) });
const BUDGET_MS = 35_000;

export type AttentionResult = { ok: true } | { ok: false; message: string };

async function ownerJob(typeId: string) {
  const viewer = await getViewer();
  if (!viewer?.account || viewer.deleted) return null;
  const supabase = await createSupabaseServerClient();
  const job = await readActiveJob(supabase, viewer.account.id);
  if (!job || job.status !== "attention") return null;
  const failed = parseFailedDocuments(job.failed_documents);
  if (!failed.some((f) => f.typeId === typeId)) return null;
  return { viewer, job, failed };
}

/** Puts the document back on the list and queues the job; the loop regenerates it even though a version may be stored. */
export async function retryDocumentAction(
  input: unknown,
): Promise<AttentionResult> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok) return { ok: false, message: "Invalid request." };
  const found = await ownerJob(parsed.data.typeId);
  if (!found) return { ok: false, message: "Nothing to try again." };
  const admin = createSupabaseAdminClient();
  const current = await admin
    .from("generation_jobs")
    .select("progress, next_document_index")
    .eq("id", found.job.id)
    .single();
  if (current.error) return { ok: false, message: "Could not update the job." };
  const progress = (current.data.progress ?? {}) as JobProgress;
  const r = await admin
    .from("generation_jobs")
    .update({
      status: "queued",
      phase: "preparing",
      attempts: 0,
      last_error: null,
      next_run_at: new Date().toISOString(),
      next_document_index: 0,
      failed_documents: found.failed.filter(
        (f) => f.typeId !== parsed.data.typeId,
      ),
      progress: {
        redrafts: { ...(progress.redrafts ?? {}), [parsed.data.typeId]: 0 },
        docAttempts: {
          ...(progress.docAttempts ?? {}),
          [parsed.data.typeId]: 0,
        },
        retry: [...(progress.retry ?? []), parsed.data.typeId],
      },
    })
    .eq("id", found.job.id)
    .eq("account_id", found.viewer.account!.id);
  if (r.error) return { ok: false, message: "Could not update the job." };
  log.info("payments.generation.document-retry", {
    accountId: found.viewer.account!.id,
    documentTypeId: parsed.data.typeId,
  });
  keepAlive(() => continueGeneration(BUDGET_MS, "page"));
  return { ok: true };
}

/** Drops the document from the list; when nothing else waits, the next run finishes the set without it. */
export async function continueWithoutDocumentAction(
  input: unknown,
): Promise<AttentionResult> {
  const parsed = parseInput(Input, input);
  if (!parsed.ok) return { ok: false, message: "Invalid request." };
  const found = await ownerJob(parsed.data.typeId);
  if (!found) return { ok: false, message: "Nothing to continue." };
  const admin = createSupabaseAdminClient();
  const remaining = found.failed.filter((f) => f.typeId !== parsed.data.typeId);
  const r = await admin
    .from("generation_jobs")
    .update({
      // With documents still listed the job stays with the owner; otherwise it finishes on the next run.
      status: remaining.length > 0 ? "attention" : "queued",
      phase: remaining.length > 0 ? "attention" : "assembling",
      attempts: 0,
      next_run_at: new Date().toISOString(),
      failed_documents: remaining,
    })
    .eq("id", found.job.id)
    .eq("account_id", found.viewer.account!.id);
  if (r.error) return { ok: false, message: "Could not update the job." };
  log.info("payments.generation.document-skipped", {
    accountId: found.viewer.account!.id,
    documentTypeId: parsed.data.typeId,
    remaining: remaining.length,
  });
  if (remaining.length === 0)
    keepAlive(() => continueGeneration(BUDGET_MS, "page"));
  return { ok: true };
}

import "server-only";
/**
 * Running the paid generation job outside a request (REQ-007 FR-5, D-707,
 * D-1005). `runQueuedGeneration` does as much as its budget allows in this
 * process; `kickGenerationRoute` asks the job route for another budgeted
 * run, so a long set is carried by a chain of short invocations rather than
 * by a cron that Vercel's Hobby plan only runs daily. `keepAlive` hands that
 * work to the platform's `waitUntil` so the invocation is not frozen before
 * the next request has been sent (the first hosted run stalled with Next's
 * `after()` alone), and falls back to `after()` off Vercel.
 */
import { waitUntil } from "@vercel/functions";
import { after } from "next/server";
import { createModelClient } from "@/lib/generator/model-client";
import { log } from "@/lib/logging/logger";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { createEmailProvider } from "@/server/email/provider";
import { mayRunScheduledJobs } from "@/server/jobs/cron-auth";
import type { KickedBy } from "@/server/jobs/kicked-by";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { runGenerationTicks, type TickReport } from "./job";
import { SupabaseJobBackend } from "./job-backend";
import { SupabaseGenerationStore } from "./store";

const DEFAULT_MODEL = "claude-sonnet-5-5"; // D-037, D-048

export function generationModelId(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export async function runQueuedGeneration(
  budgetMs: number,
): Promise<{ reports: TickReport[]; more: boolean }> {
  const admin = createSupabaseAdminClient();
  return runGenerationTicks({
    backend: new SupabaseJobBackend(admin),
    store: new SupabaseGenerationStore(admin),
    client: createModelClient(),
    modelId: generationModelId(),
    dataset: getStandardsDataset(),
    email: createEmailProvider(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
    budgetMs,
  });
}

/** True when Vercel's request context (and so a working `waitUntil`) is present. */
export function hasPlatformWaitUntil(): boolean {
  const holder = (
    globalThis as unknown as Record<
      symbol,
      { get?: () => { waitUntil?: unknown } | undefined } | undefined
    >
  )[Symbol.for("@vercel/request-context")];
  return typeof holder?.get?.()?.waitUntil === "function";
}

/**
 * Keeps work running after the response has gone out. On Vercel the
 * request context's `waitUntil` holds the invocation open until the promise
 * settles; elsewhere Next's `after()` runs it once the response is sent.
 * Must be called inside a request (route handler or server action).
 */
export function keepAlive(work: () => Promise<void>): void {
  if (hasPlatformWaitUntil()) {
    waitUntil(work());
    return;
  }
  after(work);
}

/**
 * Starts another run of the job route without waiting for it. The request is
 * sent before the short timeout fires; the route keeps working after this
 * caller has gone. Without CRON_SECRET nothing can be authorised and the
 * next cron run picks the job up instead.
 */
export async function kickGenerationRoute(): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!secret || secret.length < 16 || !site) {
    log.warn("payments.generation.kick-skipped", {
      reason: !site ? "no-site-url" : "no-cron-secret",
    });
    return;
  }
  try {
    await fetch(`${site}/api/jobs/generate?kick=1`, {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
  } catch {
    // A timeout is expected: the route runs for up to its own budget.
  }
}

/**
 * One budgeted run with the measurement of record (D-1006): the
 * `payments.generation.tick` line says who kicked it, what each report did
 * and whether more remains. The job route uses it directly; the hook and
 * the nudge use `continueGeneration`, which adds the hand-on.
 */
export async function runGenerationAndLog(
  budgetMs: number,
  kickedBy: KickedBy,
): Promise<{ reports: TickReport[]; more: boolean }> {
  const started = Date.now();
  const { reports, more } = await runQueuedGeneration(budgetMs);
  log.info("payments.generation.tick", {
    kicked_by: kickedBy,
    budgetMs,
    elapsedMs: Date.now() - started,
    reports: reports.map((r) =>
      r.claimed
        ? {
            jobId: r.jobId,
            outcome: r.outcome,
            documentsDone: r.documentsDone,
            documentsTotal: r.documentsTotal,
            sections: r.sectionsGenerated,
            // REQ-016 FR-0b: why a section fell back (kind, rule names, refusal flag), never content.
            failures: r.failures ?? [],
            redrafted: r.redrafted ?? [],
          }
        : { claimed: false },
    ),
    more,
  });
  return { reports, more };
}

/** The webhook's hook and the nudge share this: work now, then hand on if there is more. */
export async function continueGeneration(
  budgetMs: number,
  kickedBy: KickedBy,
): Promise<void> {
  // REQ-010 FR-6: a preview deployment never generates against the shared database.
  if (!mayRunScheduledJobs()) {
    log.info("payments.generation.skipped", { reason: "not-production" });
    return;
  }
  try {
    const { more } = await runGenerationAndLog(budgetMs, kickedBy);
    if (more) await kickGenerationRoute();
  } catch (e) {
    log.error("payments.generation.tick-failed", { error: e });
  }
}

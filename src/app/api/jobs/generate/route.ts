/**
 * Runs queued paid generation jobs (REQ-007 FR-5, D-706, D-707, D-1006).
 * Vercel Cron calls it daily as a backstop; the GitHub Actions kicker calls
 * it every thirty minutes (generate-kick.yml, D-059) and on dispatch until
 * it answers `more: false`; the webhook's hook
 * and this route itself call it to carry a long set through a chain; a
 * person can call it with the bearer. Anything unauthorised gets 404 so the
 * route is invisible. Answers with what each run did, never with document
 * content.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import {
  isAuthorisedCronRequest,
  mayRunScheduledJobs,
} from "@/server/jobs/cron-auth";
import {
  keepAlive,
  kickGenerationRoute,
  runGenerationAndLog,
} from "@/server/generation/kick";
import { generationProblems } from "@/lib/payments/live-guards";
import { kickedByFrom } from "@/server/jobs/kicked-by";
import { recordJobRun } from "@/server/jobs/record-run";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * D-1006: the largest duration Vercel allows a Hobby function with Fluid
 * compute, 300 seconds ("Duration limits", vercel.com/docs/functions/
 * configuring-functions/duration, last updated 24 Aug 2026: Hobby default
 * and maximum 300 s). The project must have Fluid compute enabled
 * (Settings, Functions), otherwise Hobby stops at 60 s and the deploy
 * refuses this value.
 */
export const maxDuration = 300;

/** The job stops starting documents when the next would not finish ten seconds before the platform cuts the function off. */
const ROUTE_BUDGET_MS = maxDuration * 1000 - 10_000;

const Query = strictObject({
  kick: z.enum(["0", "1", "self", "kicker", "manual"]).optional(),
});

export async function GET(request: Request) {
  if (
    !isAuthorisedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return new NextResponse("Not found", { status: 404 });
  }
  // REQ-010 FR-6: a preview deployment never generates against the shared database.
  if (!mayRunScheduledJobs())
    return NextResponse.json({ skipped: "not the production deployment" });
  // REQ-022 FR-3: live calls without a key would fail every pack; refuse the job instead.
  const refused = generationProblems(process.env);
  if (refused.length) {
    log.error("jobs.generate.refused", { conditions: refused });
    return new NextResponse("Not found", { status: 404 });
  }
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok)
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  const kickedBy = kickedByFrom(
    query.data.kick,
    request.headers.get("user-agent"),
  );
  try {
    const { reports, more } = await runGenerationAndLog(
      ROUTE_BUDGET_MS,
      kickedBy,
    );
    log.info("jobs.generate.ran", {
      kicked_by: kickedBy,
      runs: reports.length,
      more,
    });
    // REQ-022 FR-1 (D-2208): the launch page reads the last run from audit_log.
    await recordJobRun(createSupabaseAdminClient(), "generate", {
      kicked_by: kickedBy,
      runs: reports.length,
      more,
    });
    // More to do: ask for another run once this response has gone out; the
    // platform keeps this invocation alive until the request is sent
    // (D-1005). The kicker and the cron are the guarantee; this is the
    // accelerator.
    if (more) keepAlive(() => kickGenerationRoute());
    return NextResponse.json({
      runs: reports.map((r) =>
        r.claimed
          ? {
              jobId: r.jobId,
              outcome: r.outcome,
              documentsDone: r.documentsDone,
              documentsTotal: r.documentsTotal,
            }
          : { claimed: false },
      ),
      more,
    });
  } catch (e) {
    if (e instanceof SupabaseEnvError)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 },
      );
    log.error("jobs.generate.failed", { error: e });
    return NextResponse.json({ error: "generate failed" }, { status: 500 });
  }
}

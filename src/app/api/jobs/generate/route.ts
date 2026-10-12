/**
 * Runs queued paid generation jobs (REQ-007 FR-5, D-706, D-707). Vercel Cron
 * calls it with `Authorization: Bearer <CRON_SECRET>` as a backstop; the
 * webhook's after() hook and this route itself call it to carry a long set
 * through a chain of short runs. Anything unauthorised gets 404 so the route
 * is invisible. Answers with what each run did, never with document content.
 */
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { isAuthorisedCronRequest } from "@/server/jobs/cron-auth";
import {
  kickGenerationRoute,
  runQueuedGeneration,
} from "@/server/generation/kick";
import { SupabaseEnvError } from "@/server/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Leaves room inside maxDuration for the summary, the zip and the hand-on. */
const ROUTE_BUDGET_MS = 40_000;

const Query = strictObject({ kick: z.enum(["0", "1"]).optional() });

export async function GET(request: Request) {
  if (
    !isAuthorisedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return new NextResponse("Not found", { status: 404 });
  }
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok)
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  try {
    const { reports, more } = await runQueuedGeneration(ROUTE_BUDGET_MS);
    log.info("jobs.generate.ran", {
      kick: query.data.kick === "1",
      runs: reports.length,
      more,
    });
    // More to do: ask for another run once this response has gone out.
    if (more) after(() => kickGenerationRoute());
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

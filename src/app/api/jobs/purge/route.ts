/**
 * Daily purge of accounts soft-deleted more than 30 days ago (REQ-004 FR-6).
 * Vercel Cron calls it with `Authorization: Bearer <CRON_SECRET>`; anything
 * else gets 404 so the route is invisible. `?dryRun=1` reports without
 * deleting.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseInput, strictObject } from "@/lib/validation";
import { log } from "@/lib/logging/logger";
import { purgeGenerationArtifacts, runPurge } from "@/server/accounts/purge";
import { createEmailProvider } from "@/server/email/provider";
import {
  isAuthorisedCronRequest,
  mayRunScheduledJobs,
} from "@/server/jobs/cron-auth";
import { SupabaseEnvError } from "@/server/supabase/env";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

// The only accepted query: dryRun=1 reports without deleting.
const Query = strictObject({ dryRun: z.enum(["0", "1"]).optional() });

export async function GET(request: Request) {
  if (
    !isAuthorisedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return new NextResponse("Not found", { status: 404 });
  }
  // REQ-010 FR-6: a preview deployment never purges the shared database.
  if (!mayRunScheduledJobs())
    return NextResponse.json({ skipped: "not the production deployment" });
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok)
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  const dryRun = query.data.dryRun === "1";
  try {
    const admin = createSupabaseAdminClient();
    const report = await runPurge({
      admin,
      email: createEmailProvider(),
      dryRun,
    });
    const generation = await purgeGenerationArtifacts({ admin, dryRun });
    log.info("jobs.purge.ran", {
      dryRun,
      purged: report.purged.length,
      errors: report.errors.length,
    });
    return NextResponse.json(
      { ...report, generation },
      {
        status: report.errors.length ? 207 : 200,
      },
    );
  } catch (e) {
    if (e instanceof SupabaseEnvError)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 },
      );
    log.error("jobs.purge.failed", { error: e });
    return NextResponse.json({ error: "purge failed" }, { status: 500 });
  }
}

/**
 * GET /api/jobs/uptime (REQ-030 FR-3, D-2867): the uptime check's report.
 * The check runs in GitHub Actions and has no database; the switchboard's
 * row **Uptime check within 90 minutes** is a database read like the other
 * job rows, so the check calls here with the cron bearer and the result,
 * and this route writes one `audit_log` row `jobs.uptime.ran` with
 * `up=true|false health=<status> home=<status>` (SR-4: one row, no read of
 * data). 404 without the bearer; `{ skipped }` off the production deployment.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import {
  isAuthorisedCronRequest,
  mayRunScheduledJobs,
} from "@/server/jobs/cron-auth";
import { recordJobRun } from "@/server/jobs/record-run";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = strictObject({
  up: z.enum(["true", "false"]),
  health: z.string().regex(/^\d{1,3}$/),
  home: z.string().regex(/^\d{1,3}$/),
});

export async function GET(request: Request) {
  if (
    !isAuthorisedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  )
    return new NextResponse("Not found", { status: 404 });
  if (!mayRunScheduledJobs())
    return NextResponse.json({ skipped: "not the production deployment" });
  const query = parseInput(
    Query,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.ok)
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  try {
    const admin = createSupabaseAdminClient();
    const summary = {
      up: query.data.up,
      health: Number(query.data.health),
      home: Number(query.data.home),
    };
    await recordJobRun(admin, "uptime", summary);
    log.info("jobs.uptime.ran", summary);
    return NextResponse.json({ recorded: true, ...summary });
  } catch (e) {
    if (e instanceof SupabaseEnvError)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 },
      );
    log.error("jobs.uptime.failed", { error: e });
    return NextResponse.json({ error: "uptime failed" }, { status: 500 });
  }
}

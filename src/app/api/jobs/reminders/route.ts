/**
 * Nightly register reminders (REQ-009 FR-3, SR-4). Vercel Cron calls it with
 * `Authorization: Bearer <CRON_SECRET>`; anything else gets 404 so the route
 * is invisible; a preview deployment never runs it. `?dryRun=1` reports what
 * would be inserted without writing or emailing; `?today=YYYY-MM-DD` lets a
 * test pin the day (the job is idempotent either way).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logging/logger";
import { parseInput, strictObject } from "@/lib/validation";
import { createEmailProvider } from "@/server/email/provider";
import { recordJobRun } from "@/server/jobs/record-run";
import {
  isAuthorisedCronRequest,
  mayRunScheduledJobs,
} from "@/server/jobs/cron-auth";
import { runRemindersJob } from "@/server/registers/reminders-job";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { SupabaseEnvError } from "@/server/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Query = strictObject({
  dryRun: z.enum(["0", "1"]).optional(),
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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
    const report = await runRemindersJob({
      admin,
      email: createEmailProvider(),
      today: query.data.today ?? sydneyToday(),
      dryRun: query.data.dryRun === "1",
      ownerEmail: async (accountId) => {
        const m = await admin
          .from("memberships")
          .select("user_id")
          .eq("account_id", accountId)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();
        const userId = (m.data as { user_id: string } | null)?.user_id;
        if (!userId) return null;
        const u = await admin.auth.admin.getUserById(userId);
        return u.data.user?.email ?? null;
      },
    });
    log.info("jobs.reminders.ran", {
      accounts: report.accounts,
      inserted: report.inserted,
      emailed: report.emailed,
      errors: report.errors.length,
    });
    // REQ-022 FR-1 (D-2208): the launch page reads the last run from audit_log.
    await recordJobRun(admin, "reminders", {
      accounts: report.accounts,
      inserted: report.inserted,
      emailed: report.emailed,
      errors: report.errors.length,
    });
    return NextResponse.json(report, {
      status: report.errors.length ? 207 : 200,
    });
  } catch (e) {
    if (e instanceof SupabaseEnvError)
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 },
      );
    log.error("jobs.reminders.failed", { error: e });
    return NextResponse.json({ error: "reminders failed" }, { status: 500 });
  }
}

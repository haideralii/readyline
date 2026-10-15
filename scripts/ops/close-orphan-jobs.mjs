/**
 * One-off: closes the generation jobs orphaned on the hosted project before
 * the kicker existed (batch 45, PO decision under "PO decisions the statuses
 * asked for"; D-057, D-059). A job still `queued` or `running` whose lease
 * passed more than a day ago is marked `failed` with the reason "orphaned
 * before D-057", and an `audit_log` row records it, so the admin page and the
 * provider's documents page stop waiting for it.
 *
 *   node scripts/ops/close-orphan-jobs.mjs                    # dry run: lists what would be closed
 *   node scripts/ops/close-orphan-jobs.mjs --apply            # closes them
 *   node scripts/ops/close-orphan-jobs.mjs --stale-hours=48   # how long a lease must have been overdue (default 24)
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment
 * or `.env.local` (values never pass through a shell and are never printed).
 * Exit code 0 when nothing is orphaned or every orphan was closed, 1 on a
 * failed request, 2 when the variables are missing.
 */
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  closingRows,
  describe,
  selectOrphans,
} from "./close-orphan-jobs-lib.mjs";

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, name, raw] = m;
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[name] === undefined && value !== "")
      process.env[name] = value;
  }
}

loadLocalEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) {
  console.log(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY is not set; nothing read.",
  );
  process.exit(2);
}
const apply = process.argv.includes("--apply");
const staleArg = process.argv.find((a) => a.startsWith("--stale-hours="));
const staleHours = Number(staleArg?.split("=")[1] ?? 24);
const now = new Date();

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const jobs = await admin
  .from("generation_jobs")
  .select("id, account_id, status, attempts, created_at, next_run_at")
  .in("status", ["queued", "running"])
  .order("created_at");
// The exit code is set, never forced: on Windows a process.exit() while the
// client's sockets are still open trips a libuv assertion after the output.
if (jobs.error) {
  console.log(`generation_jobs: ${jobs.error.code ?? "error"}`);
  process.exitCode = 1;
}
const orphans = jobs.error
  ? []
  : selectOrphans(jobs.data ?? [], now, staleHours);
if (!jobs.error) {
  console.log(
    `${(jobs.data ?? []).length} open job(s); ${orphans.length} orphaned (lease more than ${staleHours} h overdue)`,
  );
  for (const j of orphans) console.log(`  ${describe(j)}`);
}
if (!apply && !jobs.error)
  console.log(
    orphans.length ? "dry run; pass --apply to close them" : "nothing to do",
  );

let closed = 0;
for (const job of apply ? orphans : []) {
  const rows = closingRows(job, now);
  const up = await admin
    .from("generation_jobs")
    .update(rows.update)
    .eq("id", job.id)
    .in("status", ["queued", "running"]);
  if (up.error) {
    console.log(`  ${job.id}: update failed (${up.error.code ?? "error"})`);
    continue;
  }
  const audit = await admin.from("audit_log").insert(rows.audit);
  if (audit.error)
    console.log(
      `  ${job.id}: closed, audit row failed (${audit.error.code ?? "error"})`,
    );
  else console.log(`  ${job.id}: closed`);
  closed += 1;
}
if (apply) {
  console.log(`closed ${closed} of ${orphans.length}`);
  if (closed !== orphans.length) process.exitCode = 1;
}

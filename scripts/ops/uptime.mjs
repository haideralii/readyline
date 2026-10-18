/**
 * The uptime check (REQ-030 FR-3, D-2867): one step inside generate-kick.yml,
 * ahead of its gate, at the kick's cadence. Reads PROD_URL; probes /api/health
 * and /; keeps the two-strike count in UPTIME_STATE_FILE (restored and saved
 * by actions/cache in the job); on the second consecutive failure opens one
 * issue `Site down <date>` with GITHUB_TOKEN (issues: write), reusing an open
 * one; two consecutive passes close it; reports the run to /api/jobs/uptime
 * with CRON_SECRET when it is set, so the switchboard row reads it. Prints
 * statuses and the action only. Exit 0 whether the site is up or down: the
 * issue is the alarm, not a red kick run.
 *
 *   PROD_URL=https://<domain> GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo \
 *   CRON_SECRET=... node scripts/ops/uptime.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { applyIssueAction, judge, probe, report } from "./uptime-lib.mjs";

const url = process.env.PROD_URL?.trim().replace(/\/$/, "");
if (!url) {
  console.log("PROD_URL is not set; nothing probed.");
  process.exit(0);
}
const brand = process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Readyline";
const stateFile = process.env.UPTIME_STATE_FILE?.trim() || ".uptime-state.json";

function readState() {
  try {
    return existsSync(stateFile)
      ? JSON.parse(readFileSync(stateFile, "utf8"))
      : {};
  } catch {
    return {};
  }
}

const previous = readState();
const result = await probe(url, brand);
const next = judge(previous, result.up);
const issue = await applyIssueAction({
  action: next.action,
  repository: process.env.GITHUB_REPOSITORY,
  token: process.env.GITHUB_TOKEN,
  result,
});
const reported = await report({
  baseUrl: url,
  secret: process.env.CRON_SECRET?.trim(),
  result,
});
mkdirSync(dirname(stateFile) || ".", { recursive: true });
writeFileSync(
  stateFile,
  JSON.stringify({
    strikes: next.strikes,
    passes: next.passes,
    issueOpen: issue.done
      ? next.issueOpen
      : (previous.issueOpen ?? next.issueOpen),
    at: new Date().toISOString(),
  }),
);
console.log(
  `uptime: ${result.up ? "up" : "DOWN"} health=${result.health.status} home=${result.home.status} strikes=${next.strikes} action=${next.action}${issue.done ? ` issue=#${issue.number}` : ""} reported=${reported.reported}`,
);

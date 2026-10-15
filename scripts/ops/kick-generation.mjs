/**
 * Kicks the paid generation job route until it reports nothing more to do
 * (batch 32 item 1, D-1006). The GitHub Actions kicker
 * (.github/workflows/generate-kick.yml) runs this on a schedule (every
 * thirty minutes until GITHUB_DISPATCH_TOKEN is set, then hourly) and
 * whenever the app dispatches it (D-059); it needs no dependencies, only
 * Node 22's fetch.
 *
 *   PROD_URL=https://<domain> CRON_SECRET=... node scripts/ops/kick-generation.mjs
 *
 * Each call runs for up to the route's own budget and answers
 * `{"more": true|false}`; the loop stops on `more: false`, on an error, or
 * when KICK_MAX_SECONDS (default 240; the workflow sets 1200) have passed,
 * so one run never overlaps the next schedule. Exit code 0 when the chain is idle or
 * drained, 1 on a refused or failed request, 2 when the variables are
 * missing. Nothing secret is printed.
 */
import { kickUntilDrained } from "./kick-generation-lib.mjs";

const url = process.env.PROD_URL?.trim().replace(/\/$/, "");
const secret = process.env.CRON_SECRET?.trim();
if (!url || !secret) {
  console.log("PROD_URL or CRON_SECRET is not set; nothing kicked.");
  process.exit(2);
}
const maxSeconds = Number(process.env.KICK_MAX_SECONDS ?? 240);
try {
  const r = await kickUntilDrained({ url, secret, maxSeconds });
  console.log(`done: ${r.reason} after ${r.calls.length} call(s)`);
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  console.log(`kick failed: ${e instanceof Error ? e.name : "error"}`);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Security headers on every route class (REQ-012 FR-1d, AC-2). Read-only:
 * one GET per route class, redirects not followed, nothing stored but the
 * status and the headers (SR-3). Exits 1 naming the route and the header on
 * the first table it does not match; 0 when every class matches.
 *
 *   node scripts/ops/check-headers.mjs --base http://localhost:3200 [--wait 60] [--json out/headers.json]
 *
 * `--wait N` polls /api/health for up to N seconds first (CI starts the
 * production build in the background). HSTS_MAX_AGE in the environment sets
 * the expected Strict-Transport-Security, as the build reads it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { checkAll, report } from "./check-headers-lib.mjs";

function parseArgs(argv) {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const base = value("--base") ?? argv.find((a) => /^https?:\/\//.test(a));
  if (!base) {
    console.error(
      "usage: node scripts/ops/check-headers.mjs --base http://localhost:3200 [--wait 60] [--json <file>]",
    );
    process.exit(2);
  }
  return {
    base: base.replace(/\/$/, ""),
    wait: Number(value("--wait") ?? 0),
    json: value("--json"),
  };
}

async function fetchRoute(base, path) {
  const res = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "readyline-headers/1" },
  });
  // The body is read and dropped so the connection closes; nothing is kept.
  await res.arrayBuffer();
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

async function waitForHealth(base, seconds) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${base}/api/health`, { redirect: "manual" });
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(
    `FAIL ${base}/api/health did not answer 200 within ${seconds} seconds`,
  );
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (args.wait > 0) await waitForHealth(args.base, args.wait);
const outcome = await checkAll((path) => fetchRoute(args.base, path), {
  hstsMaxAge: process.env.HSTS_MAX_AGE,
});
for (const line of report(outcome)) console.log(line);
if (args.json) {
  mkdirSync(dirname(args.json), { recursive: true });
  writeFileSync(
    args.json,
    JSON.stringify(
      { checkedAt: new Date().toISOString(), ...outcome },
      null,
      2,
    ),
  );
}
process.exit(outcome.problems.length === 0 ? 0 : 1);

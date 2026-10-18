#!/usr/bin/env node
/**
 * REQ-012 FR-4c (AC-10): every off-site link in the guides, the legal pages
 * (About and AI among them) and data/SOURCES.md answers 200, one redirect
 * followed and the final URL recorded. On demand (SR-3: GET only, nothing
 * stored but the status and the final URL). Exits 1 when any final status
 * is not 200.
 *
 *   node scripts/ops/check-source-links.mjs [--out product/qa/launch-review/<date>/source-links.txt]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  checkLinks,
  distinctOffSite,
  markdownLinks,
  report,
} from "./check-source-links-lib.mjs";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const out = outIndex >= 0 ? args[outIndex + 1] : undefined;

const files = [
  ...readdirSync("content/guides")
    .filter((f) => f.endsWith(".md"))
    .map((f) => `content/guides/${f}`),
  ...readdirSync("product/legal")
    .filter((f) => f.endsWith(".md"))
    .map((f) => `product/legal/${f}`),
  "data/SOURCES.md",
];
const links = files.flatMap((f) => markdownLinks(readFileSync(f, "utf8"), f));
const distinct = distinctOffSite(links);

async function fetchOnce(url) {
  const res = await fetch(url, {
    redirect: "manual",
    headers: {
      // A browser-like agent: some government sites answer only those; the check is read-only either way.
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 readyline-source-links/1",
      accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(20_000),
  });
  await res.arrayBuffer().catch(() => undefined);
  return { status: res.status, location: res.headers.get("location") };
}

const results = await checkLinks(distinct, fetchOnce);
const lines = [
  `Checked ${new Date().toISOString().slice(0, 10)} over ${files.length} files`,
  ...report(results),
];
for (const l of lines) console.log(l);
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join("\n") + "\n");
}
process.exit(results.every((r) => r.ok) ? 0 : 1);

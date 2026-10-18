#!/usr/bin/env node
/**
 * REQ-012 SR-1, D-2913 and D-2926: a report folder names roles, never people.
 * The check reads every author name and email `git log` prints for this
 * repository and fails when any of them, or any email address at all,
 * appears inside a file of the folder. Reads files and git only; prints
 * counts, never the names it looked for.
 *
 *   node scripts/ops/check-report-authors.mjs product/qa/launch-review/2026-10-19
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkReportAuthors } from "./check-report-authors-lib.mjs";

const dir = process.argv[2];
if (!dir) {
  console.error(
    "usage: node scripts/ops/check-report-authors.mjs <report folder>",
  );
  process.exit(2);
}

function walk(d, out = []) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(md|txt|json|csv)$/i.test(name)) out.push(p);
  }
  return out;
}

const identities = execSync("git log --format=%an%n%ae", { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);
const files = walk(dir).map((p) => ({
  path: p,
  text: readFileSync(p, "utf8"),
}));
const result = checkReportAuthors(files, identities);
for (const line of result.lines) console.log(line);
process.exit(result.ok ? 0 : 1);

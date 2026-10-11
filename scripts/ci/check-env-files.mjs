#!/usr/bin/env node
/**
 * Fails when any `.env*` file other than `.env.example` is tracked by git
 * (REQ-002, PO review item 4). gitleaks only looks at content, so an empty or
 * placeholder-only `.env.local` would slip past it; this closes that gap.
 *
 * Usage: node scripts/ci/check-env-files.mjs
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ALLOWED = new Set([".env.example"]);

/** Returns the tracked paths whose basename is `.env` or `.env.<anything>`, except the allowed examples. */
export function findCommittedEnvFiles(paths) {
  return paths.filter((p) => {
    const base = p.split("/").pop() ?? p;
    return /^\.env(\..+)?$/.test(base) && !ALLOWED.has(base);
  });
}

function main() {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  const offending = findCommittedEnvFiles(tracked);
  if (offending.length > 0) {
    console.error(
      `check-env-files: ${offending.length} env file(s) are committed; remove them from git and rotate any values they held:`,
    );
    for (const f of offending) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    `check-env-files ok: no .env files tracked (checked ${tracked.length} paths)`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]).endsWith("check-env-files.mjs")
) {
  main();
}

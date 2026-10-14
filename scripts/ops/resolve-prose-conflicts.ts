/**
 * Resolves merge conflicts in Markdown files by keeping both sides in order
 * (the PO's standing rule for DECISIONS.md and product/NEXT.md; D-1011).
 * Refuses any path that is not a .md file and writes nothing in that case.
 *
 *   node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/ops/resolve-prose-conflicts.ts <file.md...>
 *
 * UTF-8 in and out, no byte-order mark; mojibake repaired on the way
 * (D-1507). Exit code 2 on a refused path, 1 when a marker remains.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  assertProsePath,
  resolveProseConflicts,
} from "./resolve-prose-conflicts-lib.ts";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: resolve-prose-conflicts.ts <file.md...>");
  process.exit(2);
}
// Every path is checked before any file is written, so a mixed list changes nothing.
for (const file of files) {
  try {
    assertProsePath(file);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}
for (const file of files) {
  try {
    const { text, blocks } = resolveProseConflicts(readFileSync(file, "utf8"));
    writeFileSync(file, text, "utf8");
    console.log(`${file}: ${blocks} block(s) resolved`);
  } catch (e) {
    console.error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

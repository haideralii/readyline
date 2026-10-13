/**
 * Repairs files that were read as Windows-1252 and written back as UTF-8
 * (batch 31 item 0, D-1507): strips a byte-order mark and restores every
 * double-encoded run by reversing the round trip, never by retyping text.
 *
 *   node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/ops/repair-mojibake.ts [--check] <file...>
 *
 * With `--check` nothing is written; the exit code is 1 when a file needs
 * repair. `tests/text-encoding.test.ts` is the standing guard.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  findMojibake,
  hasBom,
  repairText,
} from "../../src/lib/text/encoding.ts";

const args = process.argv.slice(2);
const check = args.includes("--check");
const files = args.filter((a) => a !== "--check");
if (files.length === 0) {
  console.error("usage: repair-mojibake.ts [--check] <file...>");
  process.exit(2);
}

let dirty = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const runs = findMojibake(text);
  const bom = hasBom(text);
  if (!bom && runs.length === 0) continue;
  dirty += 1;
  const lines = [...new Set(runs.map((r) => r.line))];
  console.log(
    `${file}: ${bom ? "byte-order mark; " : ""}${runs.length} run(s) on line(s) ${lines.join(", ") || "none"}`,
  );
  if (check) continue;
  const repaired = repairText(text);
  const left = findMojibake(repaired);
  if (left.length)
    console.log(
      `  ${left.length} run(s) could not be reversed: ${left.map((r) => `${r.line} "${r.run}"`).join("; ")}`,
    );
  writeFileSync(file, repaired, "utf8");
}
if (check && dirty) process.exit(1);
console.log(`${dirty} file(s) ${check ? "need repair" : "repaired"}`);

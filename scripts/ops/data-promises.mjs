/**
 * The data promises check's command (REQ-030 FR-5, D-2869): one argument,
 * the newest `jobs.purge.ran` time as psql printed it (empty when none);
 * prints the judge's line and exits 1 when the promise is broken.
 *
 *   node scripts/ops/data-promises.mjs "2026-10-18 03:00:00.123456+00"
 */
import { judgePurgeAge } from "./data-promises-lib.mjs";

const verdict = judgePurgeAge(process.argv[2] ?? "");
console.log(verdict.line);
process.exit(verdict.ok ? 0 : 1);

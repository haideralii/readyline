#!/usr/bin/env node
/**
 * Verifies that data/standards.json still matches its sources (REQ-001 AC-6, AC-9).
 *
 * Fails, naming each problem, when:
 *   - a snapshot file named by a source is missing
 *   - a snapshot's SHA-256 differs from the hash recorded in standards.json
 *   - a snapshot's SHA-256 differs from data/sources/manifest.json
 *   - a record marked "verified" has no source
 *   - a record marked "unverified" has no note
 *   - any placeholder text is left in the data
 *
 * Usage: node scripts/standards/verify.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const ROOT = process.cwd();
const read = (p) =>
  readFileSync(resolve(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

export function verify(
  data,
  manifest,
  exists = (p) => existsSync(resolve(ROOT, p)),
  readFile = read,
) {
  const problems = [];
  const manifestByPath = new Map(
    manifest.items.map((i) => [i.snapshotPath, i]),
  );

  for (const s of data.sources) {
    if (!exists(s.snapshotPath)) {
      problems.push(`source ${s.id}: snapshot ${s.snapshotPath} is missing`);
      continue;
    }
    const actual = sha256(readFile(s.snapshotPath));
    if (actual !== s.sha256) {
      problems.push(
        `source ${s.id}: snapshot ${s.snapshotPath} changed (recorded ${s.sha256.slice(0, 12)}, now ${actual.slice(0, 12)})`,
      );
    }
    const m = manifestByPath.get(s.snapshotPath);
    if (!m)
      problems.push(
        `source ${s.id}: ${s.snapshotPath} is not listed in data/sources/manifest.json`,
      );
    else if (m.sha256 !== actual)
      problems.push(
        `source ${s.id}: manifest hash for ${s.snapshotPath} differs from the file`,
      );
    else if (m.url !== s.url)
      problems.push(`source ${s.id}: url differs from manifest (${m.url})`);
  }

  const records = [
    ...data.modules.map((m) => ({
      kind: "module",
      id: m.id,
      sources: m.sourceIds,
      v: m.verification,
    })),
    ...data.standards.map((s) => ({
      kind: "standard",
      id: s.id,
      sources: [s.sourceId],
      v: s.verification,
    })),
    ...data.registrationGroups.map((g) => ({
      kind: "group",
      id: g.code,
      sources: g.sourceIds,
      v: g.verification,
    })),
  ];
  for (const r of records) {
    if (r.v.status === "verified" && (!r.sources || r.sources.length === 0)) {
      problems.push(`${r.kind} ${r.id}: verified but has no source`);
    }
    if (r.v.status === "unverified" && !r.v.note) {
      problems.push(`${r.kind} ${r.id}: unverified without a note`);
    }
  }

  const text = JSON.stringify(data);
  if (/PLACEHOLDER/.test(text))
    problems.push("dataset contains PLACEHOLDER text");

  return problems;
}

function main() {
  const data = JSON.parse(read("data/standards.json"));
  const manifest = JSON.parse(read("data/sources/manifest.json"));
  const problems = verify(data, manifest);
  if (problems.length) {
    console.error(`standards:verify found ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `standards:verify ok: ${data.sources.length} sources match their snapshots and the manifest`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(ROOT, "scripts/standards/verify.mjs")
) {
  main();
}

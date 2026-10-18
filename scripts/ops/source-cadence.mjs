#!/usr/bin/env node
/**
 * REQ-012 FR-4d (AC-11; D-2910, D-2906): flags every source past its read
 * cadence on the report date: the standards dataset's sources
 * (data/standards.meta.json, kind by URL), the third-party prices the cost
 * guide cites (read on the guide's `updated` day), the vendors' terms (the
 * lawyer's bundle index date) and the legal pages' `updated` dates.
 *
 *   node scripts/ops/source-cadence.mjs [--today 2026-10-19] [--out product/qa/launch-review/<date>/source-cadence.txt]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cadenceReport, flagSources } from "./source-cadence-lib.mjs";

const args = process.argv.slice(2);
const value = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const today = value("--today") ?? new Date().toISOString().slice(0, 10);
const out = value("--out");

function kindFor(url) {
  if (/legislation\.gov\.au/.test(url)) return "legislation";
  if (/reform-hub/.test(url)) return "commission-reform";
  if (/apply-registration|about-registration|types-audits/.test(url))
    return "commission-apply";
  if (/practice-standards|Practice-Standards|ndis-practice-standards/.test(url))
    return "practice-standards";
  return "commission-page";
}

const meta = JSON.parse(readFileSync("data/standards.meta.json", "utf8"));
const sources = meta.sources.map((s) => ({
  id: s.id,
  kind: kindFor(s.url),
  readOn: s.fetchedAt ?? null,
}));

/** The third-party prices the cost guide cites, read on the guide's `updated` day (D-2906). */
const costGuide = readFileSync(
  "content/guides/ndis-registration-cost.md",
  "utf8",
);
const updated = /^updated:\s*(\d{4}-\d{2}-\d{2})/m.exec(costGuide)?.[1] ?? null;
for (const line of costGuide.split("\n"))
  if (
    /^- \[/.test(line) &&
    /\]\((https?:\/\/[^)]+)\)/.test(line) &&
    !/ndiscommission|legislation\.gov|business\.gov/.test(line)
  )
    sources.push({
      id: `price: ${line.match(/^- \[([^\]]+)\]/)?.[1].slice(0, 60)}`,
      kind: "third-party-price",
      readOn: updated,
    });

/** The vendors' terms: the newest lawyer's bundle index. */
const bundles = readdirSync("product/evidence/req-022")
  .filter((f) => /^legal-bundle-\d{4}-\d{2}-\d{2}\.md$/.test(f))
  .sort();
sources.push({
  id: "vendor terms (the bundle index)",
  kind: "vendor-terms",
  readOn: bundles.length
    ? bundles.at(-1).match(/(\d{4}-\d{2}-\d{2})/)[1]
    : null,
});

/** The legal pages' own `updated` dates. */
for (const f of readdirSync("product/legal").filter((f) => f.endsWith(".md"))) {
  const m = /^updated:\s*(\d{4}-\d{2}-\d{2})/m.exec(
    readFileSync(`product/legal/${f}`, "utf8"),
  );
  sources.push({
    id: `product/legal/${f}`,
    kind: "legal-page",
    readOn: m?.[1] ?? null,
  });
}

const lines = [
  `Read cadence on ${today} (D-2910; third-party prices 30 days, D-2906)`,
  ...cadenceReport(flagSources(sources, today)),
];
for (const l of lines) console.log(l);
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join("\n") + "\n");
}

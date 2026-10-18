#!/usr/bin/env node
/**
 * REQ-012 FR-4b: prints every public sentence that carries a number, a
 * date, a dollar amount, a time frame, a hedge word or an instrument name,
 * over the files the copy lint walks (the copy modules, the content JSON,
 * the guides, the legal pages and the app's TSX), each with its file and
 * line and classes. With `--table <claims-and-sources.md>` it prints the
 * precision (sentences found that the table carries verbatim) and lists the
 * unmapped ones first. Reads source files only (SR-5).
 *
 *   node scripts/ops/extract-fact-sentences.mjs [--table product/qa/launch-review/<date>/claims-and-sources.md] [--json out/facts.json]
 */
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  factSentences,
  jsonProse,
  markdownProse,
  precision,
  tsProse,
} from "./extract-fact-sentences-lib.mjs";

/** The copy modules the copy lint walks (tests/copy-lint.test.ts COPY_MODULES; kept in step by hand). */
const COPY_MODULES = [
  "src/lib/home-copy.ts",
  "src/lib/brand.ts",
  "src/lib/checklist/derive.ts",
  "src/lib/checklist/state.ts",
  "src/lib/questionnaire/navigation.ts",
  "src/lib/questionnaire/schema.ts",
  "src/lib/questionnaire/result.ts",
  "src/lib/legal/nav.ts",
  "src/lib/payments/copy.ts",
  "src/lib/payments/documents-copy.ts",
  "src/server/payments/messages.ts",
  "src/lib/generation/writing-state.ts",
  "src/app/start/_components/steps/practices-copy.ts",
  "src/app/start/_components/steps/result-copy.ts",
  "src/lib/questionnaire/result-text.ts",
  "src/lib/path/renewal.ts",
  "src/lib/path/details-copy.ts",
  "src/lib/registers/period.ts",
  "src/lib/registers/what-changed.ts",
  "src/lib/registers/commission-changes.ts",
  "src/lib/registers/self-check.ts",
  "src/server/email/templates.ts",
  "src/lib/registers/worker-steps.ts",
  "src/lib/registers/supervision.ts",
  "src/lib/registers/worker-states-line.ts",
];

function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const args = process.argv.slice(2);
const value = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const found = [];
for (const f of COPY_MODULES)
  found.push(...factSentences(f, tsProse(readFileSync(f, "utf8"))));
for (const f of walk("src/app", /\.tsx$/).concat(
  walk("src/components", /\.tsx$/),
))
  found.push(
    ...factSentences(f.replace(/\\/g, "/"), tsProse(readFileSync(f, "utf8"))),
  );
for (const f of readdirSync("data/readyline-content").filter((f) =>
  f.endsWith(".json"),
))
  found.push(
    ...factSentences(
      `data/readyline-content/${f}`,
      jsonProse(readFileSync(`data/readyline-content/${f}`, "utf8")),
    ),
  );
// The legal folder holds the five public pages and the lawyer's own question list, which is not a page.
for (const dir of ["content/guides", "product/legal"])
  for (const f of readdirSync(dir).filter(
    (f) => f.endsWith(".md") && f !== "questions-for-the-lawyer.md",
  ))
    found.push(
      ...factSentences(
        `${dir}/${f}`,
        markdownProse(readFileSync(`${dir}/${f}`, "utf8")),
      ),
    );

// One line per distinct sentence (the same sentence on 38 pages is one fact).
const seen = new Map();
for (const f of found) if (!seen.has(f.sentence)) seen.set(f.sentence, f);
const distinct = [...seen.values()];

const tablePath = value("--table");
const table = tablePath ? readFileSync(tablePath, "utf8") : null;
const p = precision(distinct, table);
const lines = [];
if (table) {
  lines.push(`UNVERIFIED or unmapped first (${p.unmapped.length}):`);
  for (const f of p.unmapped)
    lines.push(`${f.file}:${f.line} | ${f.classes.join(",")} | ${f.sentence}`);
  lines.push("");
}
lines.push(table ? `mapped (${p.mapped}):` : `found (${distinct.length}):`);
for (const f of distinct)
  if (!table || !p.unmapped.includes(f))
    lines.push(`${f.file}:${f.line} | ${f.classes.join(",")} | ${f.sentence}`);
lines.push("");
lines.push(
  `facts: ${found.length} sentence(s) in ${new Set(found.map((f) => f.file)).size} file(s), ${distinct.length} distinct` +
    (table
      ? `; mapped ${p.mapped} of ${distinct.length} (precision ${distinct.length ? Math.round((100 * p.mapped) / distinct.length) : 0} %)`
      : ""),
);
for (const l of lines) console.log(l);
const jsonOut = value("--json");
if (jsonOut) {
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(
    jsonOut,
    JSON.stringify(
      { extractedAt: new Date().toISOString(), distinct, unmapped: p.unmapped },
      null,
      2,
    ),
  );
}

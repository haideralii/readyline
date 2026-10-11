#!/usr/bin/env node
/**
 * Builds data/standards.json and data/SOURCES.md.
 *
 * Inputs:
 *   data/sources/*.txt          verbatim text snapshots of Commission pages and PDFs
 *   data/standards.meta.json    hand-maintained: sources, modules, groups, rules, evidence
 *
 * The outcome and indicator text is parsed from the snapshots, never retyped,
 * so the dataset can be diffed against what the Commission published.
 * Deterministic: same inputs give byte-identical output.
 *
 * Usage: node scripts/standards/build.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import * as prettier from "prettier";

const ROOT = process.cwd();
const META_PATH = "data/standards.meta.json";
const OUT_JSON = "data/standards.json";
const OUT_MD = "data/SOURCES.md";

const read = (p) =>
  readFileSync(resolve(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const squash = (s) => s.replace(/\s+/g, " ").trim();

export function slugify(name) {
  return name
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A line continues the previous indicator when the previous one is clearly unfinished. */
function continuesPrevious(prev, line) {
  if (/[;:]$/.test(prev)) return true;
  if (/\b(and|or)$/.test(prev)) return true;
  if (/^[a-z][).]\s/.test(line)) return true;
  return false;
}

/**
 * Parses a Commission module page (HTML reduced to text, headings kept as <h2>/<h3>).
 * Returns sections that have an "Outcome:" line and at least one indicator.
 */
export function parseCommissionPage(text) {
  const sections = [];
  let cur = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const h = /^<h([23])>\s*(.*)$/.exec(line);
    if (h) {
      cur = { name: squash(h[2]), outcome: null, indicators: [], mode: "pre" };
      sections.push(cur);
      continue;
    }
    if (!cur) continue;
    if (/^Outcome:\s*/.test(line)) {
      cur.outcome = squash(line.replace(/^Outcome:\s*/, ""));
      continue;
    }
    if (/^To achieve this outcome/.test(line)) {
      cur.mode = "ind";
      continue;
    }
    if (cur.mode !== "ind" || !line) continue;
    const last = cur.indicators.length - 1;
    if (last >= 0 && continuesPrevious(cur.indicators[last], line)) {
      cur.indicators[last] = squash(`${cur.indicators[last]} ${line}`);
    } else {
      cur.indicators.push(squash(line));
    }
  }
  return sections
    .filter((s) => s.outcome && s.indicators.length > 0)
    .map(({ name, outcome, indicators }) => ({ name, outcome, indicators }));
}

/** Joins wrapped PDF lines; a trailing hyphen means a word was split across lines. */
function joinWrapped(lines) {
  return lines
    .reduce((acc, l) => (acc.endsWith("-") ? acc + l : `${acc} ${l}`), "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses the SIL Practice Standards PDF text (pypdf extraction with page markers).
 * Each standard has Intent, Expectation statements, Outcome statement and numbered indicators.
 */
export function parseSilPdf(text) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter(
      (l) =>
        l.trim() &&
        !/^===== PAGE \d+ =====$/.test(l) &&
        !/^\s*NDIS Quality and Safeguards Commission\s+\d+\s*$/.test(l),
    );
  const standards = [];
  let cur = null;
  let mode = null;
  let who = null;
  for (const raw of lines) {
    const line = raw.trim();
    const t = /^SIL Practice Standards:\s*(.+)$/.exec(line);
    if (t) {
      cur = {
        title: t[1].trim(),
        intent: [],
        expectation: { participant: [], worker: [], provider: [] },
        outcome: [],
        indicators: [],
      };
      standards.push(cur);
      mode = "title";
      continue;
    }
    if (!cur) continue;
    if (/^Intent\s*$/.test(line)) {
      mode = "intent";
      continue;
    }
    if (/^Expectation\s*$/.test(line)) {
      mode = "expect-head";
      continue;
    }
    if (mode === "expect-head" && /^Statement\s*$/.test(line)) {
      mode = "expect";
      continue;
    }
    if (/^Outcome\s*$/.test(line)) {
      mode = "outcome-head";
      continue;
    }
    if (mode === "outcome-head" && /^statement\s*$/i.test(line)) {
      mode = "outcome";
      continue;
    }
    if (/^Quality\s*$/.test(line)) {
      mode = "qi-head";
      continue;
    }
    if (mode === "qi-head" && /^Indicators/.test(line)) {
      mode = "ind";
      continue;
    }
    if (mode === "ind" && /^To achieve this outcome/.test(line)) continue;

    if (mode === "title") {
      cur.title = `${cur.title} ${line}`;
    } else if (mode === "intent") {
      cur.intent.push(line);
    } else if (mode === "expect") {
      const m =
        /^(?:•\s*)?(Participant|Worker|Provider) statement:\s*(.*)$/.exec(line);
      if (m) {
        who = m[1].toLowerCase();
        cur.expectation[who].push(m[2]);
      } else if (who) {
        cur.expectation[who].push(line);
      }
    } else if (mode === "outcome") {
      cur.outcome.push(line);
    } else if (mode === "ind") {
      if (/^\d+\.\s/.test(line))
        cur.indicators.push([line.replace(/^\d+\.\s*/, "")]);
      else if (cur.indicators.length)
        cur.indicators[cur.indicators.length - 1].push(line);
    }
  }
  return standards.map((s) => ({
    name: squash(s.title.replace(/\s+Standard$/, "")),
    intent: joinWrapped(s.intent),
    expectationStatements: {
      participant: joinWrapped(s.expectation.participant),
      worker: joinWrapped(s.expectation.worker),
      provider: joinWrapped(s.expectation.provider),
    },
    outcome: joinWrapped(s.outcome),
    indicators: s.indicators.map(joinWrapped),
  }));
}

function fail(msg) {
  console.error(`standards:build failed: ${msg}`);
  process.exit(1);
}

export function build(meta, readFile = read) {
  const verified = { status: "verified", checkedAt: meta.checkedAt };

  // Sources with hashes of the snapshots they point at.
  const sources = meta.sources.map((s) => {
    if (!existsSync(resolve(ROOT, s.snapshotPath)))
      fail(`missing snapshot ${s.snapshotPath}`);
    return {
      ...s,
      publisher: s.publisher ?? "NDIS Quality and Safeguards Commission",
      sha256: sha256(readFile(s.snapshotPath)),
    };
  });
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const modules = [];
  const standards = [];
  const usedEvidence = new Set();

  for (const m of meta.modules) {
    const { pages, ...moduleRecord } = m;
    modules.push({
      ...moduleRecord,
      divisions: moduleRecord.divisions ?? [],
      verification: moduleRecord.verification ?? verified,
    });
    for (const page of pages) {
      const source = sourceById.get(page.sourceId);
      if (!source) fail(`module ${m.id}: unknown source ${page.sourceId}`);
      const text = readFile(source.snapshotPath);
      const parsed =
        page.parser === "sil-pdf"
          ? parseSilPdf(text)
          : parseCommissionPage(text);
      if (
        page.expectCount !== undefined &&
        parsed.length !== page.expectCount
      ) {
        fail(
          `module ${m.id} page ${page.sourceId}: parsed ${parsed.length} standards, expected ${page.expectCount}`,
        );
      }
      for (const p of parsed) {
        const autoSlug = slugify(p.name);
        const baseId = page.divisionId
          ? `${m.id}.${page.divisionId}.${autoSlug}`
          : `${m.id}.${autoSlug}`;
        const id = meta.idOverrides?.[baseId] ?? baseId;
        const name = meta.nameOverrides?.[id] ?? p.name;
        let indicators = p.indicators;
        let note;
        const toNote = meta.indicatorToNote?.[id];
        if (toNote) {
          const re = new RegExp(toNote);
          const moved = indicators.filter((i) => re.test(i));
          indicators = indicators.filter((i) => !re.test(i));
          if (moved.length !== 1)
            fail(`${id}: indicatorToNote matched ${moved.length} indicators`);
          note = moved[0];
        }
        const evidence = meta.evidence[id];
        if (!evidence || evidence.length === 0)
          fail(`${id}: no evidence items in meta.evidence`);
        usedEvidence.add(id);
        const record = {
          id,
          moduleId: m.id,
          ...(page.divisionId ? { divisionId: page.divisionId } : {}),
          name,
          ...(p.intent ? { intent: p.intent } : {}),
          ...(p.expectationStatements
            ? { expectationStatements: p.expectationStatements }
            : {}),
          outcome: p.outcome,
          indicators,
          ...(note ? { note } : {}),
          sourceId: page.sourceId,
          sourceLocator:
            page.parser === "sil-pdf"
              ? `PDF, "SIL Practice Standards: ${p.name}"`
              : `heading "${p.name}"`,
          evidence: evidence.map((e) => ({ draft: true, ...e })),
          verification: verified,
        };
        standards.push(record);
      }
    }
  }

  for (const key of Object.keys(meta.evidence)) {
    if (!usedEvidence.has(key))
      fail(`meta.evidence has an entry for unknown standard ${key}`);
  }

  const registrationGroups = [...meta.registrationGroups]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((g) => ({ ...g, verification: g.verification ?? verified }));

  return {
    schemaVersion: 1,
    version: meta.version,
    generatedAt: meta.generatedAt,
    evidenceDisclaimer: meta.evidenceDisclaimer,
    sources,
    modules,
    standards,
    registrationGroups,
    rules: meta.rules,
  };
}

function renderSourcesMd(data, meta) {
  const rows = data.sources
    .map(
      (s) =>
        `| \`${s.id}\` | ${s.title} | ${s.versionLabel ?? ""} | ${s.effectiveFrom ?? ""} | ${s.fetchedAt} | [link](${s.url}) | \`${s.sha256.slice(0, 12)}\` |`,
    )
    .join("\n");
  const unverified = [
    ...data.modules.map((m) => ["module", m.id, m.verification]),
    ...data.standards.map((s) => ["standard", s.id, s.verification]),
    ...data.registrationGroups.map((g) => [
      "registration group",
      g.code,
      g.verification,
    ]),
  ]
    .filter(([, , v]) => v.status === "unverified")
    .map(([kind, id, v]) => `- ${kind} \`${id}\`: ${v.note}`);
  const changelog = meta.changelog
    .map((c) => `- **${c.version}** (${c.date}): ${c.note}`)
    .join("\n");
  // Counts are computed from the dataset so this file can never disagree with it.
  const contents = data.modules
    .map((m) => {
      const n = data.standards.filter((s) => s.moduleId === m.id).length;
      return `- \`${m.id}\` ${m.name}: ${n} standards`;
    })
    .join("\n");
  const unverifiedBlock = unverified.length ? unverified.join("\n") : "- none";
  return `# Standards data sources

Generated by \`npm run standards:build\` from \`data/standards.meta.json\` and the snapshots in \`data/sources/\`. Do not edit by hand.

Dataset version **${data.version}**, generated ${data.generatedAt}. Every outcome and quality indicator in \`standards.json\` is parsed verbatim from the snapshot named by its \`sourceId\`. \`npm run standards:verify\` fails if any snapshot's SHA-256 differs from the one recorded here.

| Id | Title | Version label | Effective from | Fetched | URL | SHA-256 (prefix) |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## Contents

${data.modules.length} modules, ${data.standards.length} standards, ${data.registrationGroups.length} registration classes.

${contents}

## UNVERIFIED items

${unverifiedBlock}

## Changelog

${changelog}
`;
}

async function main() {
  const meta = JSON.parse(read(META_PATH));
  const data = build(meta);
  const json = await prettier.format(JSON.stringify(data, null, 2), {
    parser: "json",
  });
  writeFileSync(resolve(ROOT, OUT_JSON), json);
  const md = await prettier.format(renderSourcesMd(data, meta), {
    parser: "markdown",
  });
  writeFileSync(resolve(ROOT, OUT_MD), md);
  console.log(
    `standards:build wrote ${OUT_JSON} (${data.modules.length} modules, ${data.standards.length} standards, ${data.registrationGroups.length} groups) and ${OUT_MD}`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(ROOT, "scripts/standards/build.mjs")
) {
  main().catch((e) => fail(e.stack ?? String(e)));
}

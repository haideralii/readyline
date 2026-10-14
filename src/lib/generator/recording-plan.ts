/**
 * The recording plan for Haider's next model session (standing backlog 6,
 * D-550): everything the runbook's recording order needs, computed without
 * a model call. For every approved recording (D-039 to D-046) it builds the
 * current request, looks for the fixture under today's key, reads the live
 * reply's state (placeholder instructions, version 2 lint findings,
 * truncation), and sorts the section into the first group of the runbook's
 * order it qualifies for. The groups carry the command that records them,
 * and every entry carries an estimate of tokens and dollars at the cached
 * rates, so the dry run (`RECORDING_PLAN=1`, recording-plan.test.ts) prints
 * what a session would cost before anyone spends.
 *
 * Nothing here calls the model. The recorder (record-fixtures.test.ts)
 * takes a group number or a section list from this plan and re-records
 * those sections even where a fixture exists.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack, PROMPT_VERSION } from "./context-pack";
import { lintV2Counts, LINT_V2_RULES } from "./lint-v2-fixture";
import {
  DEFAULT_FIXTURES_DIR,
  fixturePath,
  inferStopReason,
  type Fixture,
} from "./model-client";
import { buildModelRequest, requestHash } from "./prompts";
import { knownRecordNames } from "./record-names";
import { loadReferenceCases, type ReferenceCase } from "./reference-cases";

/**
 * List prices in dollars per million tokens. Sonnet 5.5 per D-037; Haiku 5.5
 * is the Dev's assumption for the D-046 comparison (UNVERIFIED against the
 * price list; the PO corrects it if wrong). Cache writes cost 1.25x the input
 * price, cache reads 0.1x (D-046).
 */
export const PRICES: Record<string, { inputPerM: number; outputPerM: number }> =
  {
    "claude-sonnet-5-5": { inputPerM: 2, outputPerM: 10 },
    "claude-haiku-5-5": { inputPerM: 1, outputPerM: 5 },
  };
export const CACHE_WRITE_FACTOR = 1.25;
export const CACHE_READ_FACTOR = 0.1;
export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function priceFor(model: string) {
  return PRICES[model] ?? PRICES[DEFAULT_MODEL];
}

/** Dollars for one call at the cached rates, and what the same tokens would cost uncached. */
export function dollarsFor(
  model: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  } | null,
): { cached: number; uncached: number } {
  if (!usage) return { cached: 0, uncached: 0 };
  const p = priceFor(model);
  const write = usage.cacheCreationInputTokens ?? 0;
  const read = usage.cacheReadInputTokens ?? 0;
  const cached =
    (usage.inputTokens * p.inputPerM +
      write * p.inputPerM * CACHE_WRITE_FACTOR +
      read * p.inputPerM * CACHE_READ_FACTOR +
      usage.outputTokens * p.outputPerM) /
    1_000_000;
  const uncached =
    ((usage.inputTokens + write + read) * p.inputPerM +
      usage.outputTokens * p.outputPerM) /
    1_000_000;
  return {
    cached: Number(cached.toFixed(4)),
    uncached: Number(uncached.toFixed(4)),
  };
}

export type Recording = {
  batch: number;
  caseId: string;
  typeId: string;
  sectionId: string;
};

/**
 * Every recording the PO has approved. Batch 16 (D-039 to D-046): every
 * tailored section of every document in the sole-trader set, plus the three
 * behaviour-support sub-sections. Earlier batches' entries are subsets of
 * these and are kept by their batch number for the report.
 */
export function approvedRecordings(
  cases: ReferenceCase[] = loadReferenceCases(),
): Recording[] {
  const soleTrader = cases.find((c) => c.id === "verification-sole-trader")!;
  const earlier: Recording[] = [
    {
      batch: 10,
      caseId: "verification-sole-trader",
      typeId: "incident-management-policy-and-register",
      sectionId: "policy-statement",
    },
    ...[
      "purpose",
      "scope",
      "how-we-do-this",
      "responsibilities",
      "procedure",
    ].map((sectionId) => ({
      batch: 12,
      caseId: "verification-sole-trader",
      typeId: "incident-management-policy-and-register",
      sectionId,
    })),
    ...[
      "steps-getting-the-plan",
      "steps-putting-the-plan-into-practice",
      "steps-monitoring-reporting-and-review",
    ].map((sectionId) => ({
      batch: 12,
      caseId: "behaviour-support-company",
      typeId: "behaviour-support-plan-implementation-procedure",
      sectionId,
    })),
    ...[
      "purpose",
      "scope",
      "policy-statement",
      "how-we-do-this",
      "responsibilities",
      "procedure",
    ].map((sectionId) => ({
      batch: 13,
      caseId: "verification-sole-trader",
      typeId: "complaints-management-policy-and-register",
      sectionId,
    })),
    ...["summary", "how-we-meet"].map((sectionId) => ({
      batch: 13,
      caseId: "verification-sole-trader",
      typeId: "practice-standards-self-assessment",
      sectionId,
    })),
  ];
  const seen = new Set(
    earlier.map((r) => `${r.caseId}/${r.typeId}/${r.sectionId}`),
  );
  const fullSet: Recording[] = [];
  for (const doc of soleTrader.result.documents) {
    const type = documentTypeById(doc.id);
    if (!type) continue;
    for (const section of sectionsFor(type)) {
      if (section.mode !== "tailored") continue;
      const key = `${soleTrader.id}/${type.id}/${section.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fullSet.push({
        batch: 16,
        caseId: soleTrader.id,
        typeId: type.id,
        sectionId: section.id,
      });
    }
  }
  return [...earlier, ...fullSet];
}

/** The runbook's groups, in the order Haider records them (fixtures/generation/README.md). */
export const PLAN_GROUPS = [
  {
    id: 0,
    title: "Sections with no fixture for the current prompt",
    why: "Replay has nothing to serve, so the pack shows the generic fallback for these sections until they are recorded once.",
  },
  {
    id: 1,
    title: "The complaints procedure",
    why: "Finding 9 (D-546): the recorded reply quotes Commission numbers from memory; the new brief refers to the fixed contact block and the contact-details lint rejects any number or address.",
  },
  {
    id: 2,
    title: "The first three tailored sections of every document",
    why: "Finding 12: Purpose, Scope and the policy statement read at Year 10 to 11 against the Year 8 target; an auditor skims the front of each document first.",
  },
  {
    id: 3,
    title: "The sections whose briefs changed in batch 40",
    why: 'Finding 8 (D-545): the incident procedure, the risk areas, the risk-assessed roles and the support planning steps; the recorded steps still say "as soon as possible", which the vague-time lint rejects.',
  },
  {
    id: 4,
    title:
      'Recorded replies that carry "[Provider to complete: ...]" instructions',
    why: "Finding 2 (D-542): re-recording under the blank rule (S-8) turns the instructions into blanks the Finish page can ask for.",
  },
  {
    id: 5,
    title: "Recorded replies the version 2 lints flag",
    why: "Finding 10 and the lint report (LINT_V2_REPORT=1): indicator restatement, vague time, staff as actor, record names, contact details.",
  },
] as const;
export type PlanGroupId = (typeof PLAN_GROUPS)[number]["id"];

/** D-545: the sections whose briefs changed in batch 40, by document and section id. */
export const BATCH_40_SECTIONS: readonly {
  typeId: string;
  sectionId: string;
}[] = [
  { typeId: "incident-management-policy-and-register", sectionId: "procedure" },
  {
    typeId: "complaints-management-policy-and-register",
    sectionId: "procedure",
  },
  { typeId: "risk-management-policy-and-register", sectionId: "risk-areas" },
  {
    typeId: "worker-screening-and-recruitment-procedure",
    sectionId: "risk-assessed-roles",
  },
  { typeId: "support-planning-and-transitions-procedure", sectionId: "steps" },
];

export const PLACEHOLDER_INSTRUCTION = /\[Provider to complete/;
/** Output tokens assumed for a section with no live fixture to measure (the recorded average, rounded). */
export const DEFAULT_OUTPUT_TOKENS = 650;

export type PlanEntry = Recording & {
  group: PlanGroupId;
  /** Every group the section qualifies for, the first one being where it sits. */
  reasons: string[];
  currentHash: string;
  live: {
    model: string;
    promptVersion: string;
    outputTokens: number | null;
    truncated: boolean;
    placeholderInstructions: boolean;
    lintFindings: number;
    rekeyed: boolean;
  } | null;
  /** Fixture files in the section's folder whose key is not today's (older prompts or models). */
  orphanFiles: number;
  cap: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  /** Cached rates: the system prompt and the document block written once per document, read for the rest. */
  estimatedDollars: { cached: number; uncached: number };
};

export type PlanGroup = {
  id: PlanGroupId;
  title: string;
  why: string;
  command: string;
  entries: PlanEntry[];
  dollars: { cached: number; uncached: number };
};

export type RecordingPlan = {
  model: string;
  promptVersion: string;
  fixturesDir: string;
  groups: PlanGroup[];
  /** Approved sections whose live fixture needs nothing: not in any group. */
  settled: PlanEntry[];
  fixtureDiff: {
    approved: number;
    live: number;
    missing: number;
    orphanFiles: number;
    byDocument: {
      typeId: string;
      approved: number;
      live: number;
      missing: number;
      orphanFiles: number;
    }[];
  };
  totals: {
    calls: number;
    dollars: { cached: number; uncached: number };
    tokens: { input: number; output: number };
  };
  /** Mean attempts per recorded section in the cost report, or null when there is no report: retries add calls. */
  recordedAttemptsAverage: number | null;
};

/** The mean attempts per section from the recorder's own report, so the dry run says how many extra calls retries cost. */
export function recordedAttemptsAverage(fixturesDir: string): number | null {
  const path = join(fixturesDir, "recordings-2026-10-12.json");
  if (!existsSync(path)) return null;
  const report = JSON.parse(readFileSync(path, "utf8")) as {
    recordings?: { attempts?: number }[];
  };
  const attempts = (report.recordings ?? [])
    .map((r) => r.attempts)
    .filter((a): a is number => typeof a === "number" && a > 0);
  if (attempts.length === 0) return null;
  return Number(
    (attempts.reduce((n, a) => n + a, 0) / attempts.length).toFixed(2),
  );
}

function commandFor(groupId: number): string {
  return `GENERATION_RECORD=1 GENERATION_RECORD_GROUP=${groupId} npm run generation:record`;
}

function readFixtureAt(path: string): Fixture | null {
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Fixture)
    : null;
}

function orphanCount(dir: string, labels: Recording, hash: string): number {
  const folder = join(dir, labels.typeId, labels.sectionId);
  if (!existsSync(folder)) return 0;
  return readdirSync(folder).filter(
    (f) => f.endsWith(".json") && f !== `${hash}.json`,
  ).length;
}

const tokens = (text: string) => Math.ceil(text.length / 4);

export function buildRecordingPlan(
  options: { model?: string; fixturesDir?: string } = {},
): RecordingPlan {
  const model = options.model ?? DEFAULT_MODEL;
  const fixturesDir = options.fixturesDir ?? DEFAULT_FIXTURES_DIR;
  const dataset = getStandardsDataset();
  const allowedPhrases = dataset.registrationGroups.map((g) => g.name);
  const known = knownRecordNames();
  const cases = loadReferenceCases();
  const price = priceFor(model);
  // The first three tailored sections of every approved document (the set's
  // documents and the self-assessment, which the result lists separately).
  const approved = approvedRecordings(cases);
  const firstThree = new Set<string>();
  for (const r of approved) {
    const type = documentTypeById(r.typeId);
    if (!type) continue;
    sectionsFor(type)
      .filter((s) => s.mode === "tailored")
      .slice(0, 3)
      .forEach((s) => firstThree.add(`${r.caseId}/${type.id}/${s.id}`));
  }
  const batch40 = new Set(
    BATCH_40_SECTIONS.map((s) => `${s.typeId}/${s.sectionId}`),
  );

  // The cache view: the first section of a document writes the system prompt
  // and the document block; the rest read them (D-046).
  const written = new Set<string>();
  const entries: PlanEntry[] = [];
  for (const r of approved) {
    const c = cases.find((x) => x.id === r.caseId)!;
    const type = documentTypeById(r.typeId)!;
    const section = sectionsFor(type).find((s) => s.id === r.sectionId)!;
    const pack = buildContextPack({
      answers: c.answers,
      result: c.result,
      dataset,
      type,
      section,
    });
    const request = buildModelRequest(pack, model);
    const hash = requestHash(request);
    const fx = readFixtureAt(
      fixturePath(
        fixturesDir,
        { documentTypeId: r.typeId, sectionId: r.sectionId },
        hash,
      ),
    );
    const live = fx
      ? {
          model: fx.model,
          promptVersion: fx.promptVersion,
          outputTokens: fx.usage?.outputTokens ?? null,
          truncated: inferStopReason(fx) === "max_tokens",
          placeholderInstructions: PLACEHOLDER_INSTRUCTION.test(fx.reply),
          lintFindings: (() => {
            const counts = lintV2Counts(fx, {
              allowedPhrases,
              knownRecordNames: known,
            });
            return counts
              ? LINT_V2_RULES.reduce((n, k) => n + counts[k], 0)
              : 0;
          })(),
          rekeyed: Boolean(
            (fx as Fixture & { rekeyedAt?: string; userRekeyNote?: string })
              .rekeyedAt ||
            (fx as Fixture & { userRekeyNote?: string }).userRekeyNote,
          ),
        }
      : null;
    const key = `${r.caseId}/${r.typeId}/${r.sectionId}`;
    const reasons: string[] = [];
    if (!live) reasons.push("no fixture for the current prompt");
    if (live?.truncated) reasons.push("the live reply was cut off at the cap");
    if (
      r.typeId === "complaints-management-policy-and-register" &&
      r.sectionId === "procedure"
    )
      reasons.push("the complaints procedure (finding 9)");
    if (firstThree.has(key))
      reasons.push("one of the first three sections (finding 12)");
    if (batch40.has(`${r.typeId}/${r.sectionId}`))
      reasons.push("brief changed in batch 40 (D-545)");
    if (live?.placeholderInstructions)
      reasons.push("placeholder instructions in the reply (D-542)");
    if (live && live.lintFindings > 0)
      reasons.push(`${live.lintFindings} version 2 lint finding(s)`);
    const group: PlanGroupId | null =
      !live || live.truncated
        ? 0
        : reasons.some((x) => x.startsWith("the complaints procedure"))
          ? 1
          : firstThree.has(key)
            ? 2
            : batch40.has(`${r.typeId}/${r.sectionId}`)
              ? 3
              : live.placeholderInstructions
                ? 4
                : live.lintFindings > 0
                  ? 5
                  : null;

    const systemTokens = tokens(request.system);
    const documentTokens = tokens(request.blocks.document);
    const sectionTokens = tokens(request.blocks.section);
    const docKey = `${r.caseId}/${r.typeId}`;
    const writes = written.has(docKey) ? 0 : systemTokens + documentTokens;
    const reads = written.has(docKey) ? systemTokens + documentTokens : 0;
    written.add(docKey);
    const estimatedOutputTokens = Math.min(
      request.maxTokens,
      live?.outputTokens ?? DEFAULT_OUTPUT_TOKENS,
    );
    const estimatedDollars = dollarsFor(model, {
      inputTokens: sectionTokens,
      outputTokens: estimatedOutputTokens,
      cacheCreationInputTokens: writes,
      cacheReadInputTokens: reads,
    });
    entries.push({
      ...r,
      group: (group ?? 0) as PlanGroupId,
      reasons,
      currentHash: hash,
      live,
      orphanFiles: orphanCount(fixturesDir, r, hash),
      cap: request.maxTokens,
      estimatedInputTokens: systemTokens + documentTokens + sectionTokens,
      estimatedOutputTokens,
      estimatedDollars,
      // Marked below: an entry with no group is settled.
      ...(group === null ? { group: -1 as unknown as PlanGroupId } : {}),
    });
    void price;
  }

  const settled = entries.filter((e) => (e.group as number) === -1);
  const active = entries.filter((e) => (e.group as number) !== -1);
  const groups: PlanGroup[] = PLAN_GROUPS.map((g) => {
    const members = active.filter((e) => e.group === g.id);
    return {
      id: g.id,
      title: g.title,
      why: g.why,
      command: commandFor(g.id),
      entries: members,
      dollars: sum(members),
    };
  });
  const byDocument = new Map<
    string,
    {
      typeId: string;
      approved: number;
      live: number;
      missing: number;
      orphanFiles: number;
    }
  >();
  for (const e of entries) {
    const row = byDocument.get(e.typeId) ?? {
      typeId: e.typeId,
      approved: 0,
      live: 0,
      missing: 0,
      orphanFiles: 0,
    };
    row.approved += 1;
    if (e.live) row.live += 1;
    else row.missing += 1;
    row.orphanFiles += e.orphanFiles;
    byDocument.set(e.typeId, row);
  }
  const diffRows = [...byDocument.values()];
  return {
    model,
    promptVersion: PROMPT_VERSION,
    fixturesDir,
    groups,
    settled,
    fixtureDiff: {
      approved: entries.length,
      live: entries.filter((e) => e.live).length,
      missing: entries.filter((e) => !e.live).length,
      orphanFiles: entries.reduce((n, e) => n + e.orphanFiles, 0),
      byDocument: diffRows,
    },
    totals: {
      calls: active.length,
      dollars: sum(active),
      tokens: {
        input: active.reduce((n, e) => n + e.estimatedInputTokens, 0),
        output: active.reduce((n, e) => n + e.estimatedOutputTokens, 0),
      },
    },
    recordedAttemptsAverage: recordedAttemptsAverage(fixturesDir),
  };
}

function sum(entries: PlanEntry[]): { cached: number; uncached: number } {
  return {
    cached: Number(
      entries.reduce((n, e) => n + e.estimatedDollars.cached, 0).toFixed(4),
    ),
    uncached: Number(
      entries.reduce((n, e) => n + e.estimatedDollars.uncached, 0).toFixed(4),
    ),
  };
}

/** The sections a group or a section list names, for the recorder. */
export function planSelection(
  plan: RecordingPlan,
  selection: { group?: number | null; sections?: string[] },
): Recording[] {
  const wanted = new Set(selection.sections ?? []);
  const out: Recording[] = [];
  for (const g of plan.groups) {
    if (
      selection.group !== undefined &&
      selection.group !== null &&
      g.id !== selection.group
    )
      continue;
    for (const e of g.entries)
      if (wanted.size === 0 || wanted.has(`${e.typeId}/${e.sectionId}`))
        out.push({
          batch: e.batch,
          caseId: e.caseId,
          typeId: e.typeId,
          sectionId: e.sectionId,
        });
  }
  if (wanted.size > 0 && selection.group == null)
    for (const e of plan.settled)
      if (wanted.has(`${e.typeId}/${e.sectionId}`))
        out.push({
          batch: e.batch,
          caseId: e.caseId,
          typeId: e.typeId,
          sectionId: e.sectionId,
        });
  return out;
}

/** The dry run's report, as Markdown for the PO and the runbook. */
export function renderRecordingPlan(
  plan: RecordingPlan,
  today: string,
): string {
  const p = priceFor(plan.model);
  const money = (d: { cached: number; uncached: number }) =>
    `$${d.cached.toFixed(2)} cached ($${d.uncached.toFixed(2)} uncached)`;
  const lines: string[] = [
    `# Recording plan for Haider's next model session (dry run, ${today})`,
    "",
    `Model ${plan.model} at $${p.inputPerM} in / $${p.outputPerM} out per million tokens (cache write ${CACHE_WRITE_FACTOR}x, read ${CACHE_READ_FACTOR}x); prompt version ${plan.promptVersion}; fixtures in \`${plan.fixturesDir.replace(/\\/g, "/")}\`. No model call was made to produce this.`,
    "",
    `Estimates: input tokens are characters over four; the system prompt and the document block are written to the cache once per document and read for its other sections (D-046); output tokens are the live fixture's, or ${DEFAULT_OUTPUT_TOKENS} where there is none, capped at the section's cap. A validation retry or a truncation re-run adds a call${plan.recordedAttemptsAverage ? `; the recorder's report averages ${plan.recordedAttemptsAverage} attempts per section, so allow about ${Math.round((plan.recordedAttemptsAverage - 1) * 100)} percent on top` : ""}.`,
    "",
    `**Total if every group is recorded: ${plan.totals.calls} calls, about ${money(plan.totals.dollars)}; ${plan.totals.tokens.input.toLocaleString()} input and ${plan.totals.tokens.output.toLocaleString()} output tokens.** Settled sections (nothing to do): ${plan.settled.length}.`,
    "",
    "## Fixture keys today",
    "",
    `Approved sections ${plan.fixtureDiff.approved}; with a live fixture ${plan.fixtureDiff.live}; missing ${plan.fixtureDiff.missing}; orphan files under older keys ${plan.fixtureDiff.orphanFiles} (kept as history, D-502).`,
    "",
    "| Document | Approved | Live | Missing | Orphan files |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...plan.fixtureDiff.byDocument.map(
      (r) =>
        `| ${r.typeId} | ${r.approved} | ${r.live} | ${r.missing} | ${r.orphanFiles} |`,
    ),
    "",
  ];
  for (const g of plan.groups) {
    lines.push(
      `## Group ${g.id}: ${g.title}`,
      "",
      g.why,
      "",
      `Command (the Anthropic variables come from \`.env.local\`): \`${g.command}\``,
      "",
      `${g.entries.length} call(s), about ${money(g.dollars)}.`,
      "",
    );
    if (g.entries.length > 0) {
      lines.push(
        "| Case | Document / section | Live fixture | Why | In | Out | $ cached |",
        "| --- | --- | --- | --- | ---: | ---: | ---: |",
        ...g.entries.map(
          (e) =>
            `| ${e.caseId} | ${e.typeId}/${e.sectionId} | ${e.live ? `${e.live.promptVersion}${e.live.rekeyed ? " (re-keyed)" : ""}` : "none"} | ${e.reasons.join("; ")} | ${e.estimatedInputTokens} | ${e.estimatedOutputTokens} | ${e.estimatedDollars.cached.toFixed(3)} |`,
        ),
        "",
      );
    }
  }
  lines.push(
    "## Settled sections",
    "",
    plan.settled.length
      ? plan.settled
          .map((e) => `- ${e.caseId}: ${e.typeId}/${e.sectionId}`)
          .join("\n")
      : "None.",
    "",
  );
  return lines.join("\n");
}

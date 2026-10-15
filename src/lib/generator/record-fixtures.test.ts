// @vitest-environment node
/**
 * Records real model fixtures (REQ-005 D-502) under the PO's call budget
 * (D-039 to D-046). Every entry in the recording list is one named section
 * of one reference case; an entry whose fixture already exists is skipped,
 * so a re-run never spends twice. Skipped entirely unless GENERATION_RECORD=1
 * and the two Anthropic variables exist (read from `.env.local` here, never
 * through a shell), so CI never calls the model. The cost report beside the
 * fixtures holds counts only, never prompt text, and is merged on each run.
 *
 * Environment switches (all optional):
 * - GENERATION_RECORD_CASE=<caseId> limits a run to one reference case.
 * - GENERATION_MODEL_OVERRIDE=<model> records on another model into a
 *   model-keyed fixture directory with its own report (D-046 comparison);
 *   production never reads that directory.
 * - GENERATION_RECORD_GROUP=<n> (backlog 6, D-550) records one group of the
 *   recording plan (recording-plan.ts, the runbook's order) and re-records
 *   those sections even where a fixture exists, because the plan's groups
 *   are re-recordings by definition.
 * - GENERATION_RECORD_SECTIONS="typeId/sectionId,..." names sections to
 *   re-record, with or without a group.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import { generateSection } from "./generate-section";
import {
  createModelClient,
  DEFAULT_FIXTURES_DIR,
  inferStopReason,
  readFixture,
  THINKING_SETTING,
} from "./model-client";
import { buildModelRequest } from "./prompts";
import {
  approvedRecordings,
  buildRecordingPlan,
  dollarsFor,
  planSelection,
  PRICES,
  CACHE_READ_FACTOR,
  CACHE_WRITE_FACTOR,
  renderRecordingPlan,
} from "./recording-plan";
import { loadReferenceCases } from "./reference-cases";

export { PRICES, dollarsFor };

/** Loads only the generation variables from .env.local when the shell did not set them. */
function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^(ANTHROPIC_API_KEY|ANTHROPIC_MODEL)=(.*)$/);
    if (m && !process.env[m[1]]?.trim())
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
loadLocalEnv();

const enabled =
  process.env.GENERATION_RECORD === "1" &&
  Boolean(process.env.ANTHROPIC_API_KEY?.trim()) &&
  Boolean(process.env.ANTHROPIC_MODEL?.trim());

const override = process.env.GENERATION_MODEL_OVERRIDE?.trim() || null;
const groupEnv = process.env.GENERATION_RECORD_GROUP?.trim();
const planGroup = groupEnv ? Number(groupEnv) : null;
const planSections = (process.env.GENERATION_RECORD_SECTIONS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
/** A group or a section list means re-record: the fixture that exists is the one being replaced. */
const forceRerecord = planGroup !== null || planSections.length > 0;
const FIXTURES_DIR = override
  ? `${DEFAULT_FIXTURES_DIR}-${override}`
  : DEFAULT_FIXTURES_DIR;
const REPORT_PATH = `${FIXTURES_DIR}/recordings-2026-10-12.json`;

/** The three review-pack documents (batch 10 onwards); the only ones recorded on another model. */
const REVIEW_PACK_DOCUMENTS = [
  "incident-management-policy-and-register",
  "complaints-management-policy-and-register",
  "practice-standards-self-assessment",
];

type ReportRow = Record<string, unknown> & {
  caseId: string;
  documentTypeId: string;
  sectionId: string;
  model?: string;
};

/** A fixture counts as done unless it was cut off at a cap lower than today's (D-040 re-record). */
function fixtureStillValid(
  request: ReturnType<typeof buildModelRequest>,
  labels: { documentTypeId: string; sectionId: string },
): boolean {
  const fx = readFixture(request, labels, FIXTURES_DIR);
  if (!fx) return false;
  const truncated = inferStopReason(fx) === "max_tokens";
  // A truncated fixture is re-recorded when the cap has risen (D-043) or when it
  // was recorded with thinking at the model's default, which ate into the cap (D-530).
  return !(
    truncated &&
    (request.maxTokens > fx.request.maxTokens ||
      fx.thinking !== THINKING_SETTING)
  );
}

function readReport(): { estimates: unknown[]; recordings: ReportRow[] } {
  if (!existsSync(REPORT_PATH)) return { estimates: [], recordings: [] };
  return JSON.parse(readFileSync(REPORT_PATH, "utf8"));
}

describe.skipIf(!enabled)(
  "record model fixtures (local only, D-039 to D-046)",
  () => {
    it("records every approved section that has no fixture yet and merges the cost report", async () => {
      const dataset = getStandardsDataset();
      const model = override ?? process.env.ANTHROPIC_MODEL!.trim();
      const client = createModelClient(process.env, FIXTURES_DIR);
      expect(client.mode).toBe("record");
      const allowed = dataset.registrationGroups.map((g) => g.name);
      const cases = loadReferenceCases();

      const onlyCase = process.env.GENERATION_RECORD_CASE?.trim();
      // Backlog 6: a plan group or a section list narrows the run and forces the re-record.
      const selected = forceRerecord
        ? planSelection(
            buildRecordingPlan({ model, fixturesDir: FIXTURES_DIR }),
            {
              group: planGroup,
              sections: planSections,
            },
          )
        : approvedRecordings();
      if (forceRerecord)
        process.stdout.write(
          `Recording plan selection: group ${planGroup ?? "any"}, sections ${planSections.length ? planSections.join(",") : "all in the group"}: ${selected.length} section(s), re-recorded even where a fixture exists.\n`,
        );
      const pending = selected
        .filter((r) => !onlyCase || r.caseId === onlyCase)
        // On another model only the three review-pack documents are recorded (D-046).
        .filter(
          (r) =>
            !override ||
            (r.caseId === "verification-sole-trader" &&
              REVIEW_PACK_DOCUMENTS.includes(r.typeId)),
        )
        .map((r) => {
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
          return {
            ...r,
            pack,
            request,
            exists:
              !forceRerecord &&
              fixtureStillValid(request, {
                documentTypeId: r.typeId,
                sectionId: r.sectionId,
              }),
          };
        })
        .filter((p) => !p.exists);

      const estimates = pending.map((p) => ({
        caseId: p.caseId,
        documentTypeId: p.typeId,
        sectionId: p.sectionId,
        cap: p.request.maxTokens,
        estimatedInputTokens: Math.round(
          (p.request.system.length + p.request.user.length) / 4,
        ),
      }));
      process.stdout.write(
        `Pending recordings: ${pending.length} on ${model} into ${FIXTURES_DIR}. ${estimates
          .map(
            (e) =>
              `${e.documentTypeId}/${e.sectionId}=${e.estimatedInputTokens} (cap ${e.cap})`,
          )
          .join(", ")}\n`,
      );

      const report = readReport();
      const rows: ReportRow[] = [];
      let batchDollars = 0;
      let batchUncached = 0;
      // A truncation stops the rest of that document (D-043); other documents and cases continue.
      const stoppedDocuments = new Set<string>();
      for (const p of pending) {
        if (stoppedDocuments.has(`${p.caseId}/${p.typeId}`)) {
          process.stdout.write(
            `SKIPPED after a truncation in this document: ${p.caseId}/${p.typeId}/${p.sectionId}\n`,
          );
          continue;
        }
        const out = await generateSection({
          pack: p.pack,
          client,
          model,
          allowedPhrases: allowed,
        });
        const usage = out.usage;
        const cost = dollarsFor(model, usage);
        batchDollars += cost.cached;
        batchUncached += cost.uncached;
        const row: ReportRow = {
          batch: p.batch,
          caseId: p.caseId,
          documentTypeId: p.typeId,
          sectionId: p.sectionId,
          model,
          cap: p.request.maxTokens,
          status: out.status,
          attempts: out.attempts,
          validationPassedFirstTime:
            out.status === "generated" && out.attempts === 1,
          truncatedAtTokens: out.truncatedAtTokens,
          problems: out.problems,
          readabilityGrade: out.readability?.grade ?? null,
          inputTokensLastCall: usage?.inputTokens ?? 0,
          cacheCreationInputTokensLastCall:
            usage?.cacheCreationInputTokens ?? 0,
          cacheReadInputTokensLastCall: usage?.cacheReadInputTokens ?? 0,
          outputTokensLastCall: usage?.outputTokens ?? 0,
          estimatedDollarsLastCall: cost.cached,
          uncachedDollarsLastCall: cost.uncached,
          requestHash: out.hash,
          recordedAt: new Date().toISOString(),
        };
        rows.push(row);
        // Merge: a later recording of the same section on the same model replaces the earlier row.
        report.recordings = report.recordings.filter(
          (r) =>
            !(
              r.caseId === row.caseId &&
              r.documentTypeId === row.documentTypeId &&
              r.sectionId === row.sectionId &&
              (r.model ?? model) === model
            ),
        );
        report.recordings.push(row);
        process.stdout.write(
          `${out.status === "generated" ? "ok" : "FALLBACK"} ${p.typeId}/${p.sectionId}: attempts ${out.attempts}, grade ${out.readability?.grade ?? "-"}, in ${usage?.inputTokens ?? 0} (+${usage?.cacheCreationInputTokens ?? 0} written, ${usage?.cacheReadInputTokens ?? 0} read), out ${usage?.outputTokens ?? 0}, $${cost.cached}${out.problems.length ? `; problems: ${out.problems.map((x) => x.slice(0, 80)).join(" | ")}` : ""}\n`,
        );
        if (out.truncatedAtTokens !== null) {
          stoppedDocuments.add(`${p.caseId}/${p.typeId}`);
          process.stdout.write(
            `STOP: ${p.caseId}/${p.typeId}/${p.sectionId} truncated at ${out.truncatedAtTokens} output tokens (cap ${p.request.maxTokens}).\n`,
          );
        }
      }
      mkdirSync(FIXTURES_DIR, { recursive: true });
      writeFileSync(
        REPORT_PATH,
        JSON.stringify(
          {
            decision: "D-039 to D-046",
            prices: PRICES,
            cacheFactors: {
              write: CACHE_WRITE_FACTOR,
              read: CACHE_READ_FACTOR,
            },
            estimates: [...report.estimates, ...estimates],
            recordings: report.recordings,
          },
          null,
          2,
        ) + "\n",
      );
      process.stdout.write(
        `This run: ${rows.length} call(s) completed, about $${batchDollars.toFixed(4)} at cached rates ($${batchUncached.toFixed(4)} uncached), last call per section. Report: ${REPORT_PATH}\n`,
      );
      expect(rows.length).toBeLessThanOrEqual(pending.length);
      expect(rows.length).toBeGreaterThan(0);
    }, 3_600_000);
  },
);

describe.skipIf(enabled)("record model fixtures (skipped)", () => {
  it("needs GENERATION_RECORD=1, ANTHROPIC_API_KEY and ANTHROPIC_MODEL", () => {
    expect(enabled).toBe(false);
  });

  it("prices a call at cached and uncached rates (D-046)", () => {
    const usage = {
      inputTokens: 200,
      outputTokens: 1000,
      cacheCreationInputTokens: 1000,
      cacheReadInputTokens: 2000,
    };
    expect(dollarsFor("claude-sonnet-5-5", usage)).toEqual({
      cached: Number(
        (
          (200 * 2 + 1000 * 2 * 1.25 + 2000 * 2 * 0.1 + 1000 * 10) /
          1e6
        ).toFixed(4),
      ),
      uncached: Number(((3200 * 2 + 1000 * 10) / 1e6).toFixed(4)),
    });
    expect(
      dollarsFor("claude-haiku-5-5", { inputTokens: 1000, outputTokens: 1000 }),
    ).toEqual({ cached: 0.006, uncached: 0.006 });
    expect(dollarsFor("unknown-model", null)).toEqual({
      cached: 0,
      uncached: 0,
    });
  });

  it("the dry run of the plan is available without a key (backlog 6)", () => {
    const plan = buildRecordingPlan();
    const md = renderRecordingPlan(plan, "2026-10-14");
    expect(md).toContain("## Group 0");
    expect(plan.totals.calls).toBeGreaterThan(0);
  });

  it("lists every tailored section of the sole-trader set once", () => {
    const list = approvedRecordings();
    const keys = list.map((r) => `${r.caseId}/${r.typeId}/${r.sectionId}`);
    expect(new Set(keys).size).toBe(keys.length);
    const soleTrader = list.filter(
      (r) => r.caseId === "verification-sole-trader",
    );
    // REQ-016 S-6: the two AI documents left the set (seven sections, two types).
    // 82 since batch 45 item 18 made the records policy's retention schedule fixed.
    expect(soleTrader.length).toBe(82);
    expect(new Set(soleTrader.map((r) => r.typeId)).size).toBe(16);
    // 68 for the same reason: the retention schedule was one of batch 16's recordings.
    expect(list.filter((r) => r.batch === 16)).toHaveLength(68);
  });
});

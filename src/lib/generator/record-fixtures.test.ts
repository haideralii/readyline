// @vitest-environment node
/**
 * Records real model fixtures (REQ-005 D-502) under the PO's call budget
 * (D-039, D-040). Every entry in RECORDINGS is one named section of one
 * reference case; an entry whose fixture already exists is skipped, so a
 * re-run never spends twice. Skipped entirely unless GENERATION_RECORD=1 and
 * the two Anthropic variables exist (read from `.env.local` here, never
 * through a shell), so CI never calls the model. The cost report beside the
 * fixtures holds counts only, never prompt text, and is merged on each run.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
} from "./model-client";
import { buildModelRequest } from "./prompts";
import { loadReferenceCases } from "./reference-cases";

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

/** D-037 list prices for claude-sonnet-5-5, dollars per million tokens. */
const PRICE_IN_PER_M = 2;
const PRICE_OUT_PER_M = 10;

const REPORT_PATH = `${DEFAULT_FIXTURES_DIR}/recordings-2026-10-12.json`;

/**
 * Every recording the PO has approved so far. Batch 10: one section per
 * case (D-039). Batch 11: the behaviour-support steps at the 4,000 cap
 * (D-040) and the rest of the sole-trader incident policy (queue item 3).
 */
const RECORDINGS = [
  // Batch 10 (D-039): the sole-trader policy statement (kept; passes every gate).
  {
    batch: 10,
    caseId: "verification-sole-trader",
    typeId: "incident-management-policy-and-register",
    sectionId: "policy-statement",
  },
  // Batch 12 (D-041, R-7): the rest of the sole-trader incident policy, one call each.
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
  // Batch 12: the behaviour-support steps split into three sub-sections (D-041), one call each.
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
] as const;

type ReportRow = Record<string, unknown> & {
  caseId: string;
  documentTypeId: string;
  sectionId: string;
};

/** A fixture counts as done unless it was cut off at a cap lower than today's (D-040 re-record). */
function fixtureStillValid(
  request: ReturnType<typeof buildModelRequest>,
  labels: { documentTypeId: string; sectionId: string },
): boolean {
  const fx = readFixture(request, labels);
  if (!fx) return false;
  const truncated = inferStopReason(fx) === "max_tokens";
  return !(truncated && request.maxTokens > fx.request.maxTokens);
}

function readReport(): { estimates: unknown[]; recordings: ReportRow[] } {
  if (!existsSync(REPORT_PATH)) return { estimates: [], recordings: [] };
  return JSON.parse(readFileSync(REPORT_PATH, "utf8"));
}

function dollars(inputTokens: number, outputTokens: number): number {
  return Number(
    (
      (inputTokens * PRICE_IN_PER_M + outputTokens * PRICE_OUT_PER_M) /
      1_000_000
    ).toFixed(4),
  );
}

describe.skipIf(!enabled)(
  "record model fixtures (local only, D-039, D-040)",
  () => {
    it("records every approved section that has no fixture yet and merges the cost report", async () => {
      const dataset = getStandardsDataset();
      const model = process.env.ANTHROPIC_MODEL!.trim();
      const client = createModelClient();
      expect(client.mode).toBe("record");
      const allowed = dataset.registrationGroups.map((g) => g.name);
      const cases = loadReferenceCases();

      const pending = RECORDINGS.map((r) => {
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
          exists: fixtureStillValid(request, {
            documentTypeId: r.typeId,
            sectionId: r.sectionId,
          }),
        };
      }).filter((p) => !p.exists);

      const estimates = pending.map((p) => ({
        caseId: p.caseId,
        sectionId: p.sectionId,
        cap: p.request.maxTokens,
        estimatedInputTokens: Math.round(
          (p.request.system.length + p.request.user.length) / 4,
        ),
      }));
      process.stdout.write(
        `Pending recordings: ${pending.length}. Estimated input tokens: ${estimates
          .map(
            (e) =>
              `${e.caseId}/${e.sectionId}=${e.estimatedInputTokens} (cap ${e.cap})`,
          )
          .join(", ")}\n`,
      );

      const report = readReport();
      const rows: ReportRow[] = [];
      let batchDollars = 0;
      // A truncation stops the rest of that case (queue item 3); other cases continue.
      const stoppedCases = new Set<string>();
      for (const p of pending) {
        if (stoppedCases.has(p.caseId)) {
          process.stdout.write(
            `SKIPPED after a truncation in this case: ${p.caseId}/${p.sectionId}\n`,
          );
          continue;
        }
        const out = await generateSection({
          pack: p.pack,
          client,
          model,
          allowedPhrases: allowed,
        });
        const inputTokens = out.usage?.inputTokens ?? 0;
        const outputTokens = out.usage?.outputTokens ?? 0;
        const cost = dollars(inputTokens, outputTokens);
        batchDollars += cost;
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
          inputTokensLastCall: inputTokens,
          outputTokensLastCall: outputTokens,
          estimatedDollarsLastCall: cost,
          requestHash: out.hash,
          recordedAt: new Date().toISOString(),
        };
        rows.push(row);
        // Merge: a later recording of the same section replaces the earlier row.
        report.recordings = report.recordings.filter(
          (r) =>
            !(
              r.caseId === row.caseId &&
              r.documentTypeId === row.documentTypeId &&
              r.sectionId === row.sectionId
            ),
        );
        report.recordings.push(row);
        if (out.truncatedAtTokens !== null) {
          stoppedCases.add(p.caseId);
          process.stdout.write(
            `STOP: ${p.caseId}/${p.sectionId} truncated at ${out.truncatedAtTokens} output tokens (cap ${p.request.maxTokens}).\n`,
          );
        }
      }
      writeFileSync(
        REPORT_PATH,
        JSON.stringify(
          {
            decision: "D-039, D-040",
            prices: { inputPerM: PRICE_IN_PER_M, outputPerM: PRICE_OUT_PER_M },
            estimates: [...report.estimates, ...estimates],
            recordings: report.recordings,
          },
          null,
          2,
        ) + "\n",
      );
      process.stdout.write(
        `${JSON.stringify(rows, null, 2)}\nThis run: ${rows.length} call(s) completed, about $${batchDollars.toFixed(4)} (last call per section). Report: ${REPORT_PATH}\n`,
      );
      expect(rows.length).toBeLessThanOrEqual(pending.length);
      expect(rows.length).toBeGreaterThan(0);
    }, 600_000);
  },
);

describe.skipIf(enabled)("record model fixtures (skipped)", () => {
  it("needs GENERATION_RECORD=1, ANTHROPIC_API_KEY and ANTHROPIC_MODEL", () => {
    expect(enabled).toBe(false);
  });
});

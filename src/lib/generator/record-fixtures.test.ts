// @vitest-environment node
/**
 * Records real model fixtures for the three reference cases (REQ-005 D-502,
 * D-039: one call per case, three calls in total; a failed validation gets the
 * pipeline's single retry and then stops). Skipped unless GENERATION_RECORD=1
 * and the two Anthropic variables exist, so CI never calls the model. Run
 * locally with `npm run generation:record`; it reads `.env.local` itself so
 * the key never passes through a shell. The cost report (counts only, never
 * prompt text) is written beside the fixtures for the Delivery evidence.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import { generateSection } from "./generate-section";
import { createModelClient, DEFAULT_FIXTURES_DIR } from "./model-client";
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

/** One call per case (D-039): the section the PO most wants to read for that case. */
const RECORDINGS = [
  {
    caseId: "verification-sole-trader",
    typeId: "incident-management-policy-and-register",
    sectionId: "policy-statement",
  },
  {
    caseId: "certification-personal-care",
    typeId: "governance-policy",
    sectionId: "purpose",
  },
  {
    caseId: "behaviour-support-company",
    typeId: "behaviour-support-plan-implementation-procedure",
    sectionId: "steps",
  },
] as const;

describe.skipIf(!enabled)("record model fixtures (local only, D-039)", () => {
  it("records one section per reference case and writes the cost report", async () => {
    const dataset = getStandardsDataset();
    const model = process.env.ANTHROPIC_MODEL!.trim();
    const client = createModelClient();
    expect(client.mode).toBe("record");
    const allowed = dataset.registrationGroups.map((g) => g.name);
    const cases = loadReferenceCases();

    const packs = RECORDINGS.map((r) => {
      const c = cases.find((x) => x.id === r.caseId)!;
      const type = documentTypeById(r.typeId)!;
      const section = sectionsFor(type).find((s) => s.id === r.sectionId)!;
      return {
        ...r,
        pack: buildContextPack({
          answers: c.answers,
          result: c.result,
          dataset,
          type,
          section,
        }),
      };
    });

    // Estimate before the first call (about four characters per token).
    const estimates = packs.map((p) => {
      const req = buildModelRequest(p.pack, model);
      return {
        caseId: p.caseId,
        estimatedInputTokens: Math.round(
          (req.system.length + req.user.length) / 4,
        ),
      };
    });
    process.stdout.write(
      `Estimated input tokens per case: ${estimates.map((e) => `${e.caseId}=${e.estimatedInputTokens}`).join(", ")}\n`,
    );

    const report: Record<string, unknown>[] = [];
    for (const p of packs) {
      const out = await generateSection({
        pack: p.pack,
        client,
        model,
        allowedPhrases: allowed,
      });
      const inputTokens = out.usage?.inputTokens ?? 0;
      const outputTokens = out.usage?.outputTokens ?? 0;
      report.push({
        caseId: p.caseId,
        documentTypeId: p.typeId,
        sectionId: p.sectionId,
        model,
        status: out.status,
        attempts: out.attempts,
        validationPassedFirstTime:
          out.status === "generated" && out.attempts === 1,
        problems: out.problems,
        readabilityGrade: out.readability?.grade ?? null,
        inputTokensLastCall: inputTokens,
        outputTokensLastCall: outputTokens,
        estimatedDollarsLastCall: Number(
          (
            (inputTokens * PRICE_IN_PER_M + outputTokens * PRICE_OUT_PER_M) /
            1_000_000
          ).toFixed(4),
        ),
        requestHash: out.hash,
      });
    }
    const path = `${DEFAULT_FIXTURES_DIR}/recordings-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(
      path,
      JSON.stringify(
        {
          decision: "D-039",
          prices: { inputPerM: PRICE_IN_PER_M, outputPerM: PRICE_OUT_PER_M },
          estimates,
          recordings: report,
        },
        null,
        2,
      ) + "\n",
    );
    process.stdout.write(
      `${JSON.stringify(report, null, 2)}\nReport written to ${path}\n`,
    );
    expect(report).toHaveLength(RECORDINGS.length);
  }, 240_000);
});

describe.skipIf(enabled)("record model fixtures (skipped)", () => {
  it("needs GENERATION_RECORD=1, ANTHROPIC_API_KEY and ANTHROPIC_MODEL", () => {
    expect(enabled).toBe(false);
  });
});

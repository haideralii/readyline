// @vitest-environment node
/**
 * Every recorded fixture replays through the current pipeline (R-5, R-6):
 * no network, deterministic outcomes. The governance "purpose" recording
 * scored grade 11.8, so under the readability gate it must now report a
 * readability problem and fall back (its retry has no fixture); the first
 * behaviour-support "steps" recordings were cut at the 2,000 cap and must
 * be reported as truncations, not as bad JSON.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import { generateSection } from "./generate-section";
import {
  DEFAULT_FIXTURES_DIR,
  ReplayClient,
  type Fixture,
} from "./model-client";
import { loadReferenceCases } from "./reference-cases";
import { lintReviewCycles, lintTimeframes } from "./lint";
import { TailoredSection, blocksToProse, blocksToText } from "./section-schema";
import { readability } from "./readability";

const report = JSON.parse(
  readFileSync(
    join(DEFAULT_FIXTURES_DIR, "recordings-2026-10-12.json"),
    "utf8",
  ),
) as {
  recordings: { caseId: string; documentTypeId: string; sectionId: string }[];
};

const dataset = getStandardsDataset();
const cases = loadReferenceCases();
const allowed = dataset.registrationGroups.map((g) => g.name);
const client = new ReplayClient();

function replay(caseId: string, typeId: string, sectionId: string) {
  const c = cases.find((x) => x.id === caseId)!;
  const type = documentTypeById(typeId)!;
  const section = sectionsFor(type).find((s) => s.id === sectionId)!;
  const pack = buildContextPack({
    answers: c.answers,
    result: c.result,
    dataset,
    type,
    section,
  });
  return generateSection({
    pack,
    client,
    model: "claude-sonnet-5-5",
    allowedPhrases: allowed,
  });
}

describe("recorded fixtures replay through the current gate", () => {
  it("the sole-trader incident policy statement still passes and scores within the target", async () => {
    const out = await replay(
      "verification-sole-trader",
      "incident-management-policy-and-register",
      "policy-statement",
    );
    expect(out.status).toBe("generated");
    expect(out.attempts).toBe(1);
    expect(out.readability?.grade).toBeLessThanOrEqual(11);
  });

  it("the governance purpose recording fails the readability gate on its text (R-5); its request is orphaned by the D-041 purpose brief", () => {
    const dir = join(DEFAULT_FIXTURES_DIR, "governance-policy", "purpose");
    const fixtures = readdirSync(dir).map(
      (f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture,
    );
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fx of fixtures) {
      const blocks = TailoredSection.shape.blocks.parse(
        (JSON.parse(fx.reply) as { blocks: unknown }).blocks,
      );
      expect(readability(blocksToProse(blocks)).grade).toBe(11.8);
      expect(readability(blocksToProse(blocks)).level).toBe("fail");
    }
  });
  it("the first behaviour-support steps recordings stay on disk as truncations; the split sub-sections have no fixture until recorded (R-6, D-041)", async () => {
    const dir = join(
      DEFAULT_FIXTURES_DIR,
      "behaviour-support-plan-implementation-procedure",
      "steps",
    );
    const cut = readdirSync(dir)
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture)
      .filter((f) => f.usage?.outputTokens === f.request.maxTokens);
    expect(cut.length).toBeGreaterThan(0);
    const type = documentTypeById(
      "behaviour-support-plan-implementation-procedure",
    )!;
    const ids = sectionsFor(type).map((s) => s.id);
    expect(ids).not.toContain("steps");
    expect(ids.filter((id) => id.startsWith("steps-"))).toHaveLength(3);
    for (const id of ids.filter((x) => x.startsWith("steps-"))) {
      const out = await replay("behaviour-support-company", type.id, id);
      expect(["generated", "fallback"]).toContain(out.status);
      if (out.status === "fallback")
        expect(out.problems.join("\n")).toMatch(
          /No recorded fixture|truncated at \d+ output tokens/,
        );
    }
  });

  it("R-7: lists which recorded replies restate a statutory timeframe", () => {
    const results: Record<string, string[]> = {};
    for (const typeId of readdirSync(DEFAULT_FIXTURES_DIR)) {
      const typeDir = join(DEFAULT_FIXTURES_DIR, typeId);
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      for (const sectionId of readdirSync(typeDir)) {
        for (const file of readdirSync(join(typeDir, sectionId))) {
          const fx = JSON.parse(
            readFileSync(join(typeDir, sectionId, file), "utf8"),
          ) as Fixture;
          let blocks: unknown;
          try {
            blocks = (JSON.parse(fx.reply) as { blocks: unknown }).blocks;
          } catch {
            continue; // truncated or invalid replies never reach the lint
          }
          const parsed = TailoredSection.shape.blocks.safeParse(blocks);
          if (!parsed.success) continue;
          const hits = lintTimeframes(blocksToText(parsed.data)).map(
            (h) => h.match,
          );
          if (hits.length) results[`${typeId}/${sectionId}`] = hits;
        }
      }
    }
    // Expected after batch 11: sections 5 and 6 of the sole-trader incident policy restate the 24-hour and 5-business-day rules.
    expect(Object.keys(results).sort()).toEqual([
      "incident-management-policy-and-register/how-we-do-this",
      "incident-management-policy-and-register/responsibilities",
    ]);
  });
  it("every fixture on disk is listed in the recordings report", () => {
    const listed = new Set(
      report.recordings.map((r) => `${r.documentTypeId}/${r.sectionId}`),
    );
    for (const typeId of readdirSync(DEFAULT_FIXTURES_DIR)) {
      const typeDir = join(DEFAULT_FIXTURES_DIR, typeId);
      if (!existsSync(join(typeDir))) continue;
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      for (const sectionId of readdirSync(typeDir)) {
        expect(
          listed.has(`${typeId}/${sectionId}`),
          `${typeId}/${sectionId}`,
        ).toBe(true);
      }
    }
  });
  it("R-8: lists which recorded replies state a review cycle that is not a document fact", () => {
    const cycles = { policyMonths: 12, registerMonths: 3 };
    const results: Record<string, string[]> = {};
    for (const typeId of readdirSync(DEFAULT_FIXTURES_DIR)) {
      const typeDir = join(DEFAULT_FIXTURES_DIR, typeId);
      if (typeId.endsWith(".json") || typeId.endsWith(".md")) continue;
      for (const sectionId of readdirSync(typeDir)) {
        for (const file of readdirSync(join(typeDir, sectionId))) {
          const fx = JSON.parse(
            readFileSync(join(typeDir, sectionId, file), "utf8"),
          ) as Fixture;
          let blocks: unknown;
          try {
            blocks = (JSON.parse(fx.reply) as { blocks: unknown }).blocks;
          } catch {
            continue;
          }
          const parsed = TailoredSection.shape.blocks.safeParse(blocks);
          if (!parsed.success) continue;
          const hits = lintReviewCycles(blocksToText(parsed.data), cycles).map(
            (h) => h.match,
          );
          if (hits.length)
            results[`${typeId}/${sectionId}/${file.slice(0, 8)}`] = hits;
        }
      }
    }
    // Only the batch-11 and batch-12 recordings of sections 5 and 6 of the sole-trader incident policy (orphaned by the R-8 brief, kept as history) give the register a 12-month cycle; their batch-13 re-recordings pass.
    const sections = [
      ...new Set(
        Object.keys(results).map((k) => k.split("/").slice(0, 2).join("/")),
      ),
    ].sort();
    expect(sections).toEqual([
      "incident-management-policy-and-register/how-we-do-this",
      "incident-management-policy-and-register/responsibilities",
    ]);
  });

  it("D-043: the behaviour-support monitoring sub-section's monthly reporting cadence is not a review cycle", () => {
    const dir = join(
      DEFAULT_FIXTURES_DIR,
      "behaviour-support-plan-implementation-procedure",
      "steps-monitoring-reporting-and-review",
    );
    const fixtures = readdirSync(dir).map(
      (f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture,
    );
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fx of fixtures) {
      const blocks = TailoredSection.shape.blocks.parse(
        (JSON.parse(fx.reply) as { blocks: unknown }).blocks,
      );
      const text = blocksToText(blocks);
      expect(text).toMatch(/every month/i);
      expect(
        lintReviewCycles(text, { policyMonths: 12, registerMonths: 3 }),
      ).toEqual([]);
    }
  });
});

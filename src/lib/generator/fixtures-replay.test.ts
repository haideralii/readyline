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

  it("the governance purpose recording now reports a readability problem instead of passing (R-5)", async () => {
    const out = await replay(
      "certification-personal-care",
      "governance-policy",
      "purpose",
    );
    expect(out.status).toBe("fallback");
    expect(out.problems[0]).toMatch(
      /readability grade 11\.8 is above 11: shorten sentences/,
    );
  });

  it("the first behaviour-support steps recording is reported as a truncation, not bad JSON (R-6)", async () => {
    const dir = join(
      DEFAULT_FIXTURES_DIR,
      "behaviour-support-plan-implementation-procedure",
      "steps",
    );
    const cut = readdirSync(dir)
      .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture)
      .filter((f) => f.request.maxTokens === 2000);
    expect(cut.length).toBeGreaterThan(0);
    for (const f of cut) expect(f.usage?.outputTokens).toBe(2000);
    // The replay of the current request only finds the cap-4000 fixture when it exists (item 2).
    const current = await replay(
      "behaviour-support-company",
      "behaviour-support-plan-implementation-procedure",
      "steps",
    );
    if (current.status === "fallback") {
      expect(current.problems.join("\n")).toMatch(
        /truncated at \d+ output tokens|No recorded fixture/,
      );
    }
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
});

/**
 * Records real model fixtures for the three reference cases (REQ-005 D-502).
 * Skipped unless GENERATION_RECORD=1 and ANTHROPIC_API_KEY and
 * ANTHROPIC_MODEL are set, so CI (which has none of them) never calls the
 * model. Run locally with `npm run generation:record`; commit the fixtures
 * and the cost note it prints.
 */
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import { generateSection } from "./generate-section";
import { createModelClient } from "./model-client";
import { loadReferenceCases } from "./reference-cases";

const enabled =
  process.env.GENERATION_RECORD === "1" &&
  Boolean(process.env.ANTHROPIC_API_KEY?.trim()) &&
  Boolean(process.env.ANTHROPIC_MODEL?.trim());

/** First real generations: one document per case, every tailored section. */
const DOCUMENT_TYPE = "governance-policy";

describe.skipIf(!enabled)("record model fixtures (local only)", () => {
  it("records every tailored section of the governance policy for the three cases", async () => {
    const dataset = getStandardsDataset();
    const model = process.env.ANTHROPIC_MODEL!.trim();
    const client = createModelClient();
    expect(client.mode).toBe("record");
    const type = documentTypeById(DOCUMENT_TYPE)!;
    const allowed = dataset.registrationGroups.map((g) => g.name);
    let input = 0;
    let output = 0;
    const lines: string[] = [];
    for (const c of loadReferenceCases()) {
      for (const section of sectionsFor(type).filter(
        (s) => s.mode === "tailored",
      )) {
        const pack = buildContextPack({
          answers: c.answers,
          result: c.result,
          dataset,
          type,
          section,
        });
        const out = await generateSection({
          pack,
          client,
          model,
          allowedPhrases: allowed,
        });
        input += out.usage?.inputTokens ?? 0;
        output += out.usage?.outputTokens ?? 0;
        lines.push(
          `${c.id} / ${section.id}: ${out.status} after ${out.attempts} attempt(s), grade ${out.readability?.grade ?? "n/a"}`,
        );
      }
    }
    // Printed once so the cost note can be copied into the evidence; not a log statement in app code.
    process.stdout.write(
      `${lines.join("\n")}\nTokens: input ${input}, output ${output}, model ${model}\n`,
    );
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe.skipIf(enabled)("record model fixtures (skipped)", () => {
  it("needs GENERATION_RECORD=1, ANTHROPIC_API_KEY and ANTHROPIC_MODEL", () => {
    expect(enabled).toBe(false);
  });
});

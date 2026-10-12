// @vitest-environment node
/**
 * PO content review pack (REQ-005, batch 10 item 3; whole set from batch 16):
 * renders the sole-trader reference case's documents from the recorded
 * fixtures only (ReplayClient, no network) into
 * product/evidence/req-005/sole-trader/, with a sections note saying which
 * tailored sections are real model text, which answers they used, and which
 * fell back. Runs only with REVIEW_PACK=1.
 *
 * REVIEW_PACK_MODEL=<model> renders the three comparison documents from that
 * model's fixture directory into product/evidence/req-005/sole-trader-<model
 * family>/ (D-046).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import { buildSkeleton, type ResolvedSection } from "./document-model";
import { describeFactSources } from "./fact-sources";
import { buildProviderFacts } from "./facts";
import { generateSection } from "./generate-section";
import { DEFAULT_FIXTURES_DIR, ReplayClient } from "./model-client";
import { loadReferenceCases } from "./reference-cases";
import { renderDocx } from "./render-docx";
import { blocksToText } from "./section-schema";

const enabled = process.env.REVIEW_PACK === "1";
const CASE = "verification-sole-trader";
const modelOverride = process.env.REVIEW_PACK_MODEL?.trim() || null;
const family = modelOverride?.match(/^claude-([a-z]+)/)?.[1] ?? null;
const OUT = join(
  "product",
  "evidence",
  "req-005",
  family ? `sole-trader-${family}` : "sole-trader",
);
const FIXTURES_DIR = modelOverride
  ? `${DEFAULT_FIXTURES_DIR}-${modelOverride}`
  : DEFAULT_FIXTURES_DIR;
const COMPARISON_DOCUMENTS = [
  "incident-management-policy-and-register",
  "complaints-management-policy-and-register",
  "practice-standards-self-assessment",
];

describe.skipIf(!enabled)("REQ-005 review pack (sole trader)", () => {
  it("renders the documents from recorded fixtures and writes the sections note", async () => {
    const dataset = getStandardsDataset();
    const c = loadReferenceCases().find((x) => x.id === CASE)!;
    const facts = buildProviderFacts(c.answers, c.result);
    const model =
      modelOverride ??
      (process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5");
    const client = new ReplayClient(FIXTURES_DIR);
    const allowed = dataset.registrationGroups.map((g) => g.name);
    // The self-assessment sits beside the document set (it is not in result.documents).
    const documents = modelOverride
      ? COMPARISON_DOCUMENTS
      : [
          ...new Set([
            ...c.result.documents.map((d) => d.id),
            "practice-standards-self-assessment",
          ]),
        ];
    mkdirSync(OUT, { recursive: true });
    let generated = 0;
    let fallbacks = 0;
    const note: string[] = [
      `# REQ-005 review pack: sole-trader reference case${family ? ` (${modelOverride})` : ""}`,
      "",
      `Case: ${CASE} (${facts.tradingName}, ${facts.structure}, ${facts.states.join("; ")}; classes ${facts.supportTypes.map((s) => s.code).join(", ")}; ${facts.pathway}).`,
      `Rendered ${new Date().toISOString().slice(0, 10)} from recorded fixtures only (replay client, no model call); model id in the fixtures: ${model}; ${documents.length} documents.`,
      "Sections marked MODEL TEXT replay a recorded fixture that passed the schema, lint and readability gates; sections marked fallback show the marker the provider would see, with the reason the pipeline gave (no fixture recorded, readability fail after the retry, or a reply cut at the output cap).",
      "",
    ];
    for (const typeId of documents) {
      const type = documentTypeById(typeId);
      if (!type) continue;
      const skeleton = buildSkeleton({
        type,
        facts,
        dataset,
        result: c.result,
        version: "review-pack",
        generatedAt: new Date().toISOString().slice(0, 10),
      });
      const sections: ResolvedSection[] = [];
      note.push(`## ${type.title} (${typeId}.docx)`, "");
      for (const section of skeleton.sections) {
        const spec = sectionsFor(type).find((s) => s.id === section.id)!;
        if (spec.mode !== "tailored") {
          sections.push(section);
          note.push(
            `- ${section.number ? `${section.number} ` : ""}${section.heading}: fixed text.`,
          );
          continue;
        }
        const pack = buildContextPack({
          answers: c.answers,
          result: c.result,
          dataset,
          type,
          section: spec,
        });
        const out = await generateSection({
          pack,
          client,
          model,
          allowedPhrases: allowed,
        });
        sections.push({
          ...section,
          status: out.status,
          blocks: out.blocks,
          usedFacts: out.usedFacts,
        });
        if (out.status === "generated") {
          generated++;
          const sources = describeFactSources(out.usedFacts)
            .map((s) => `${s.question} (step ${s.step})`)
            .join("; ");
          note.push(
            `- ${section.number} ${section.heading}: MODEL TEXT (recorded fixture${out.attempts > 1 ? ", passed on the retry" : ""}). Used answers: ${sources}. Readability grade ${out.readability?.grade}.`,
            "",
            "  > " + blocksToText(out.blocks).split("\n").join("\n  > "),
            "",
          );
        } else {
          fallbacks++;
          note.push(
            `- ${section.number} ${section.heading}: fallback marker: ${out.problems[0] ?? "no fixture"}`,
          );
        }
      }
      const docx = await renderDocx({ ...skeleton, sections });
      writeFileSync(join(OUT, `${typeId}.docx`), docx);
      note.push("");
    }
    note.splice(
      5,
      0,
      `Tailored sections: ${generated} with model text, ${fallbacks} with a fallback marker.`,
    );
    writeFileSync(join(OUT, "sections.md"), note.join("\n") + "\n");
    expect(generated).toBeGreaterThan(0);
  }, 600_000);
});

describe.skipIf(enabled)("review pack (skipped)", () => {
  it("runs only with REVIEW_PACK=1", () => {
    expect(enabled).toBe(false);
  });
});

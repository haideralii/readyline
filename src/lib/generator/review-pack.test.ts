// @vitest-environment node
/**
 * PO content review pack (REQ-005, batch 10 item 3): renders three documents
 * of the sole-trader reference case from the recorded fixtures only
 * (ReplayClient, no network) into product/evidence/req-005/sole-trader/,
 * with a sections note saying which tailored sections are real model text,
 * which answers they used, and which fell back. Runs only with REVIEW_PACK=1.
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
import { ReplayClient } from "./model-client";
import { loadReferenceCases } from "./reference-cases";
import { renderDocx } from "./render-docx";
import { blocksToText } from "./section-schema";

const enabled = process.env.REVIEW_PACK === "1";
const OUT = join("product", "evidence", "req-005", "sole-trader");
const CASE = "verification-sole-trader";
const DOCUMENTS = [
  "incident-management-policy-and-register",
  "complaints-management-policy-and-register",
  "practice-standards-self-assessment",
];

describe.skipIf(!enabled)("REQ-005 review pack (sole trader)", () => {
  it("renders the three documents from recorded fixtures and writes the sections note", async () => {
    const dataset = getStandardsDataset();
    const c = loadReferenceCases().find((x) => x.id === CASE)!;
    const facts = buildProviderFacts(c.answers, c.result);
    const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
    const client = new ReplayClient();
    const allowed = dataset.registrationGroups.map((g) => g.name);
    mkdirSync(OUT, { recursive: true });
    const note: string[] = [
      "# REQ-005 review pack: sole-trader reference case",
      "",
      `Case: ${CASE} (${facts.tradingName}, ${facts.structure}, ${facts.states.join("; ")}; classes ${facts.supportTypes.map((s) => s.code).join(", ")}; ${facts.pathway}).`,
      `Rendered ${new Date().toISOString().slice(0, 10)} from recorded fixtures only (replay client, no model call); model id in the fixtures: ${model}.`,
      "Sections marked MODEL TEXT replay a recorded fixture that passed the schema, lint and readability gates; sections marked fallback show the marker the provider would see, with the reason the pipeline gave (no fixture recorded, readability fail after the retry, or a reply cut at the output cap).",
      "",
    ];
    for (const typeId of DOCUMENTS) {
      const type = documentTypeById(typeId)!;
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
          const sources = describeFactSources(out.usedFacts)
            .map((s) => `${s.question} (step ${s.step})`)
            .join("; ");
          note.push(
            `- ${section.number} ${section.heading}: MODEL TEXT (recorded fixture). Used answers: ${sources}. Readability grade ${out.readability?.grade}.`,
            "",
            "  > " + blocksToText(out.blocks).split("\n").join("\n  > "),
            "",
          );
        } else {
          note.push(
            `- ${section.number} ${section.heading}: fallback marker: ${out.problems[0] ?? "no fixture"}`,
          );
        }
      }
      const docx = await renderDocx({ ...skeleton, sections });
      writeFileSync(join(OUT, `${typeId}.docx`), docx);
      note.push("");
    }
    writeFileSync(join(OUT, "sections.md"), note.join("\n") + "\n");
    expect(note.some((l) => l.includes("MODEL TEXT"))).toBe(true);
  });
});

describe.skipIf(enabled)("review pack (skipped)", () => {
  it("runs only with REVIEW_PACK=1", () => {
    expect(enabled).toBe(false);
  });
});

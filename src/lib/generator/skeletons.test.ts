/**
 * REQ-005 Session A: for each reference case, every document in its set is
 * resolved to a skeleton model (fixed text in place, tailored sections as
 * placeholders), snapshot-tested by structure, rendered to .docx and checked
 * for the structure Word will show. With WRITE_SKELETONS=1 the .docx files
 * are also written to out/skeletons/<case>/ for the LibreOffice CI job.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { GENERAL_INFORMATION_NOTICE } from "@/lib/brand";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById } from "./catalogue";
import {
  buildSkeleton,
  modelStructure,
  type DocumentModel,
} from "./document-model";
import { buildProviderFacts } from "./facts";
import { lintErrors, lintText } from "./lint";
import { loadReferenceCases } from "./reference-cases";
import { renderDocx } from "./render-docx";
import { blocksToText } from "./section-schema";

const GENERATED_AT = "2026-10-12";
const VERSION = "0.1.0-skeleton";
const SELF_ASSESSMENT = "practice-standards-self-assessment";

const dataset = getStandardsDataset();
const cases = loadReferenceCases();
const classNames = dataset.registrationGroups.map((g) => g.name);
const write = process.env.WRITE_SKELETONS === "1";

function docxXml(buffer: Buffer, path: string): string {
  const files = unzipSync(new Uint8Array(buffer));
  const file = files[path];
  if (!file) throw new Error(`${path} missing from the .docx`);
  return strFromU8(file);
}

function skeletonsFor(caseId: string) {
  const c = cases.find((x) => x.id === caseId)!;
  const facts = buildProviderFacts(c.answers, c.result);
  const typeIds = [...c.result.documents.map((d) => d.id), SELF_ASSESSMENT];
  return typeIds.map((id) => {
    const type = documentTypeById(id);
    if (!type) throw new Error(`no catalogue entry for ${id}`);
    return buildSkeleton({
      type,
      facts,
      dataset,
      result: c.result,
      version: VERSION,
      generatedAt: GENERATED_AT,
    });
  });
}

describe.each(cases.map((c) => [c.id] as const))(
  "skeletons for %s",
  (caseId) => {
    const models = skeletonsFor(caseId);

    it("resolves every document in the set and the self-assessment", () => {
      expect(models.length).toBeGreaterThan(17);
      for (const m of models) {
        expect(m.sections[0].id).toBe("document-control");
        expect(m.sections.at(-1)?.id).toBe("notice");
        expect(m.sections.some((s) => s.status === "placeholder")).toBe(true);
        const numbered = m.sections
          .filter((s) => s.number)
          .map((s) => s.number);
        expect(numbered).toEqual(numbered.map((_, i) => String(i + 1)));
      }
    });

    it("matches the structure snapshot", () => {
      expect(models.map(modelStructure)).toMatchSnapshot();
    });

    it("carries the provider's name, the notice and no lint errors in fixed text", () => {
      for (const m of models) {
        const fixed = m.sections.filter((s) => s.status === "fixed");
        const text = fixed.map((s) => blocksToText(s.blocks)).join("\n");
        expect(text).toContain(m.facts.tradingName);
        expect(text).toContain(GENERAL_INFORMATION_NOTICE);
        const errors = lintErrors(
          lintText(text, { allowedPhrases: classNames }),
        );
        expect(
          errors,
          `${m.typeId}: ${errors.map((e) => `${e.rule} "${e.match}"`).join(", ")}`,
        ).toEqual([]);
      }
    });

    it("renders every skeleton to a .docx with one Heading 1 per section and the footer", async () => {
      if (write)
        mkdirSync(join("out", "skeletons", caseId), { recursive: true });
      const manifest: { typeId: string; file: string; bytes: number }[] = [];
      for (const m of models) {
        const buffer = await renderDocx(m);
        expect(buffer.subarray(0, 2).toString("binary")).toBe("PK");
        const body = docxXml(buffer, "word/document.xml");
        const headings =
          body.match(/<w:pStyle w:val="Heading1"\/>/g)?.length ?? 0;
        expect(headings, m.typeId).toBe(m.sections.length);
        expect(body).toContain(escapeXml(m.facts.tradingName));
        const footer = docxXml(buffer, "word/footer1.xml");
        expect(footer).toContain("Prepared with");
        if (write) {
          const file = `${m.typeId}.docx`;
          writeFileSync(join("out", "skeletons", caseId, file), buffer);
          manifest.push({ typeId: m.typeId, file, bytes: buffer.length });
        }
      }
      if (write)
        writeFileSync(
          join("out", "skeletons", caseId, "manifest.json"),
          JSON.stringify(
            { caseId, generatedAt: GENERATED_AT, documents: manifest },
            null,
            2,
          ),
        );
    }, 60_000);
  },
);

describe("skeleton facts", () => {
  it("never include free text or the existing-step answers (SR-3 at the model level)", () => {
    const c = cases[0];
    const facts = buildProviderFacts(
      {
        ...c.answers,
        supports: {
          ...c.answers.supports,
          servicesNote: "CANARY-NOTE participant Jane",
        },
      },
      c.result,
    );
    const json = JSON.stringify(facts);
    expect(json).not.toContain("CANARY");
    expect(json).not.toContain("Jane");
    expect(Object.keys(facts).sort()).toEqual(
      [
        "abn",
        "hasRiskAssessedRoles",
        "keyPersonnelCount",
        "modules",
        "pathway",
        "states",
        "structure",
        "supportTypes",
        "tradingName",
        "usesRestrictivePractices",
        "workerCountBand",
      ].sort(),
    );
  });

  it("differ between the reference cases (AC-3 groundwork)", () => {
    const [a, b] = cases;
    const ma: DocumentModel = skeletonsFor(a.id)[0];
    const mb: DocumentModel = skeletonsFor(b.id)[0];
    expect(JSON.stringify(ma.sections[0])).not.toEqual(
      JSON.stringify(mb.sections[0]),
    );
  });
});

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

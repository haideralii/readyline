// @vitest-environment node
/**
 * REQ-016 FR-1: every rendered document in the three reference sets meets
 * the document standard (S-2, S-3, S-5, S-7, FR-0a, S-8, D-058), and the
 * lint catches a document that drifts (AC-2: 11 pt body text; no change
 * log). With DOCX_REPORT=1 the fonts and heading styles found are printed
 * for the LibreOffice CI job. Also runs over the sole-trader set replayed
 * through the recorded fixtures (every section generated, no model call).
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById, sectionsFor } from "./catalogue";
import { buildContextPack } from "./context-pack";
import { buildSkeleton, type DocumentModel } from "./document-model";
import { lintDocx, lintSetOrder } from "./docx-lint";
import { buildProviderFacts } from "./facts";
import { generateSection } from "./generate-section";
import { ReplayClient } from "./model-client";
import { loadReferenceCases } from "./reference-cases";
import { buildDocx, renderDocx } from "./render-docx";
import { auditOrder } from "./set-order";
import { Packer } from "docx";

const dataset = getStandardsDataset();
const cases = loadReferenceCases();
const allowed = dataset.registrationGroups.map((g) => g.name);
const SELF_ASSESSMENT = "practice-standards-self-assessment";

function modelsFor(caseId: string): DocumentModel[] {
  const c = cases.find((x) => x.id === caseId)!;
  const facts = buildProviderFacts(c.answers, c.result);
  const typeIds = auditOrder([
    ...c.result.documents.map((d) => d.id),
    SELF_ASSESSMENT,
  ]);
  return typeIds.map((id) =>
    buildSkeleton({
      type: documentTypeById(id)!,
      facts,
      dataset,
      result: c.result,
      version: "1",
      generatedAt: "2026-10-13",
    }),
  );
}

const report: string[] = [];

describe.each(cases.map((c) => [c.id] as const))(
  "docx lint over the %s skeleton set (REQ-016 FR-1)",
  (caseId) => {
    const models = modelsFor(caseId);

    it("every document meets S-2, S-3, S-5, FR-0a and S-8", async () => {
      for (const m of models) {
        const buffer = await renderDocx(m);
        const r = lintDocx(new Uint8Array(buffer), {
          title: m.title,
          expectedSections: m.sections.length,
        });
        report.push(
          `${caseId}/${m.typeId}: fonts ${r.fonts.join(",")}; sizes ${r.sizes.map((s) => s / 2).join(",")} pt; styles ${r.headingStyles.join(",")}; ${r.headings} headings`,
        );
        expect(
          r.findings.map((f) => `${f.rule}: ${f.detail}`),
          m.typeId,
        ).toEqual([]);
        expect(r.fonts).toEqual(["Calibri"]);
      }
    }, 120_000);

    it("the set is in audit order (S-7) and carries no AI document (S-6)", () => {
      const ids = models.map((m) => m.typeId);
      expect(lintSetOrder(ids)).toEqual([]);
      expect(ids.some((id) => id.startsWith("ai-"))).toBe(false);
      expect(ids[0]).toBe("governance-policy");
      expect(ids.at(-1)).toBe(SELF_ASSESSMENT);
    });
  },
);

describe("the lint catches drift (AC-2)", () => {
  const model = modelsFor("verification-sole-trader")[0];

  it("fails a document rendered with 11 pt body text", async () => {
    const doc = buildDocx(model);
    // Seed the drift: rewrite the default run size in the packed XML.
    const buffer = new Uint8Array(await Packer.toBuffer(doc));
    const { unzipSync, zipSync, strFromU8, strToU8 } = await import("fflate");
    const files = unzipSync(buffer);
    const styles = strFromU8(files["word/styles.xml"]).replace(
      /<w:sz w:val="24"\/>/,
      '<w:sz w:val="22"/>',
    );
    files["word/styles.xml"] = strToU8(styles);
    const r = lintDocx(zipSync(files));
    expect(r.findings.map((f) => f.rule)).toContain("s3-size");
  });

  it("fails a document without a change log", async () => {
    const without: DocumentModel = {
      ...model,
      sections: model.sections.filter((s) => s.id !== "change-log"),
    };
    const r = lintDocx(new Uint8Array(await renderDocx(without)));
    expect(r.findings.map((f) => f.rule)).toContain("s2-change-log");
  });

  it("fails a placeholder that carries the generator's instruction", async () => {
    const leaky: DocumentModel = {
      ...model,
      sections: model.sections.map((s) =>
        s.id === "purpose"
          ? {
              ...s,
              blocks: [
                {
                  type: "callout",
                  text: "[Provider to complete: Purpose. Never restate statutory timeframes; refer to the outline.]",
                },
              ],
            }
          : s,
      ),
    };
    const r = lintDocx(new Uint8Array(await renderDocx(leaky)));
    expect(r.findings.map((f) => f.rule)).toContain("fr0a-instruction");
  });

  it("fails a blank inside a sentence that is an instruction or too long (S-8)", async () => {
    const bad: DocumentModel = {
      ...model,
      sections: model.sections.map((s) =>
        s.id === "scope"
          ? {
              ...s,
              blocks: [
                {
                  type: "paragraph",
                  text: "Our key person is [add the name of the person responsible here]. Workers reach them by [phone or email].",
                },
              ],
            }
          : s,
      ),
    };
    const r = lintDocx(new Uint8Array(await renderDocx(bad)));
    const blanks = r.findings.filter((f) => f.rule === "s8-blank");
    expect(blanks).toHaveLength(1);
    expect(blanks[0].detail).toMatch(/add the name/);
  });

  it("fails a set out of audit order", () => {
    expect(lintSetOrder([SELF_ASSESSMENT, "governance-policy"])).toHaveLength(
      1,
    );
  });
});

describe("the sole-trader set replayed through the recorded fixtures (FR-0c)", () => {
  it("ships with zero undrafted sections and passes the lint", async () => {
    const c = cases.find((x) => x.id === "verification-sole-trader")!;
    const facts = buildProviderFacts(c.answers, c.result);
    const client = new ReplayClient();
    let sections = 0;
    let blanks = 0;
    let generic = 0;
    for (const m of modelsFor(c.id)) {
      const type = documentTypeById(m.typeId)!;
      const filled = { ...m, sections: [...m.sections] };
      for (let i = 0; i < filled.sections.length; i += 1) {
        const s = filled.sections[i];
        const spec = sectionsFor(type).find((x) => x.id === s.id)!;
        if (spec.mode !== "tailored") continue;
        const out = await generateSection({
          pack: buildContextPack({
            answers: c.answers,
            result: c.result,
            dataset,
            type,
            section: spec,
          }),
          client,
          model: "claude-sonnet-5-5",
          allowedPhrases: allowed,
        });
        filled.sections[i] = { ...s, status: out.status, blocks: out.blocks };
        if (out.status === "fallback") generic += 1;
      }
      expect(
        filled.sections.filter((s) => s.status === "placeholder"),
        m.typeId,
      ).toEqual([]);
      sections += filled.sections.length;
      const { sectionsWithBlanks } = await import("./blanks");
      blanks += sectionsWithBlanks(filled);
      const r = lintDocx(new Uint8Array(await renderDocx(filled)), {
        title: filled.title,
        expectedSections: filled.sections.length,
      });
      expect(
        r.findings.map((f) => `${f.rule}: ${f.detail}`),
        m.typeId,
      ).toEqual([]);
      void facts;
    }
    report.push(
      `verification-sole-trader replay: ${sections} sections, ${blanks} with a blank for the provider (${Math.round((100 * blanks) / sections)}%), ${generic} generic`,
    );
    // Reported, not gated, until the PO reads the figure: see the Dev response (AC under FR-0c).
    expect(generic).toBeLessThanOrEqual(sections);
  }, 120_000);
});

describe("report", () => {
  it("prints the fonts and heading styles found when asked", () => {
    if (process.env.DOCX_REPORT === "1")
      writeFileSync("out/docx-lint-report.txt", report.join("\n") + "\n");
    expect(report.length).toBeGreaterThan(0);
  });
});

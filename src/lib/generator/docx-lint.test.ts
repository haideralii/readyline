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
import { applyFacts } from "./facts-fill";
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

/**
 * D-541 as amended: with the owner's name on the account (name, role, and
 * the approval date from adoption) the three fixed blanks in every document
 * are gone, and the sole-trader set replayed through the fixtures must have
 * fact blanks in under 10 percent of its sections. The figure before the
 * account facts is reported beside it.
 */
const OWNER_FACTS = {
  name: "Jane Citizen",
  role: "Owner",
  "owner-role": "Owner",
  date: "14 October 2026",
};
const MAX_BLANK_SECTION_SHARE = 0.1;
/** Backlog 4: the sole-trader pack is the full 16-document pack (15 documents and the self-assessment); the CI step names it, so the count is pinned here. */
const SOLE_TRADER_PACK_SIZE = 16;

describe("the sole-trader set replayed through the recorded fixtures (FR-0c)", () => {
  it("ships with zero undrafted sections, passes the lint, and with the owner's name has fact blanks in under 10 percent of sections (D-541)", async () => {
    const c = cases.find((x) => x.id === "verification-sole-trader")!;
    expect(modelsFor(c.id)).toHaveLength(SOLE_TRADER_PACK_SIZE);
    const facts = buildProviderFacts(c.answers, c.result);
    const client = new ReplayClient();
    let sections = 0;
    let blanks = 0;
    let generic = 0;
    const perDocument: string[] = [];
    let withOwner = { sections: 0, factBlanks: 0, sectionsWithFactBlanks: 0 };
    let withoutOwner = { sections: 0, sectionsWithFactBlanks: 0 };
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
      expect(r.blanks.sections, m.typeId).toBe(filled.sections.length);
      withoutOwner = {
        sections: withoutOwner.sections + r.blanks.sections,
        sectionsWithFactBlanks:
          withoutOwner.sectionsWithFactBlanks + r.blanks.sectionsWithFactBlanks,
      };
      // The same document once the account holds the owner's name (D-541 as amended).
      const owned = lintDocx(
        new Uint8Array(await renderDocx(applyFacts(filled, OWNER_FACTS))),
        { title: filled.title, expectedSections: filled.sections.length },
      );
      expect(owned.findings, m.typeId).toEqual([]);
      withOwner = {
        sections: withOwner.sections + owned.blanks.sections,
        factBlanks: withOwner.factBlanks + owned.blanks.factBlanks,
        sectionsWithFactBlanks:
          withOwner.sectionsWithFactBlanks +
          owned.blanks.sectionsWithFactBlanks,
      };
      perDocument.push(
        `  ${m.typeId}: ${owned.blanks.sectionsWithFactBlanks} of ${owned.blanks.sections} sections with a fact blank (${owned.blanks.factBlanks} blanks) once the owner's name is on the account; ${r.blanks.sectionsWithFactBlanks} before`,
      );
      void facts;
    }
    const share = withOwner.sectionsWithFactBlanks / withOwner.sections;
    report.push(
      `verification-sole-trader replay: ${sections} sections, ${blanks} with any blank (${Math.round((100 * blanks) / sections)}%), ${generic} generic; fact blanks in ${withoutOwner.sectionsWithFactBlanks} sections (${Math.round((100 * withoutOwner.sectionsWithFactBlanks) / withoutOwner.sections)}%) before the owner's name, ${withOwner.sectionsWithFactBlanks} (${Math.round(100 * share)}%) after`,
      ...perDocument,
    );
    expect(generic).toBeLessThanOrEqual(sections);
    // D-541 as amended: under 10 percent of sections with a fact blank once the account has the owner's name.
    expect(
      share,
      `sections with a fact blank after the owner's name: ${withOwner.sectionsWithFactBlanks} of ${withOwner.sections}\n${perDocument.join("\n")}`,
    ).toBeLessThan(MAX_BLANK_SECTION_SHARE);
  }, 120_000);
});

describe("report", () => {
  it("prints the fonts and heading styles found when asked", () => {
    if (process.env.DOCX_REPORT === "1")
      writeFileSync("out/docx-lint-report.txt", report.join("\n") + "\n");
    expect(report.length).toBeGreaterThan(0);
  });
});

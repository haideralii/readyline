// @vitest-environment node
/**
 * REQ-033 Session B (AC-B4, AC-B5; FR-B2, FR-B3, FR-B5): the redraft request
 * carries the section, its brief, the standard, the finding and the outline
 * headings and nothing else; the reply reading refuses a section that names
 * the audit, quotes the finding or drops the provider's anchors; the new
 * version's model replaces the one section and adds the change-log row.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { documentTypeById, readabilityGateFor, sectionsFor } from "./catalogue";
import { outlineFor, type DocumentModel } from "./document-model";
import {
  REDRAFT_PROMPT_VERSION,
  REDRAFT_REFUSED_MESSAGE,
  buildRedraftRequest,
  readRedraftReply,
  redraftChangeText,
  redraftChecks,
  redraftModel,
  redraftTarget,
} from "./redraft";
import type { Block } from "./section-schema";
import { getStandardsDataset } from "@/lib/standards/dataset";

const model = JSON.parse(
  readFileSync("data/samples/complaints-policy.json", "utf8"),
) as DocumentModel;
const type = documentTypeById(model.typeId)!;
const standard = {
  name: "Feedback and complaints management",
  outcome:
    "Each participant has knowledge of and access to the provider's complaints management and resolution system.",
  indicators: [
    "Complaints and other feedback made by all parties are welcomed, acknowledged, respected and well-managed.",
  ],
};
const finding =
  "The scope of the complaints policy does not say that family members and advocates can complain on a participant's behalf. The provider must widen the scope and tell participants.";
const scope = model.sections.find((s) => s.id === "scope")!;
const allowed = getStandardsDataset().registrationGroups.map((g) => g.name);
const gate = readabilityGateFor(
  type,
  sectionsFor(type).find((s) => s.id === "scope"),
);

function reading(
  blocks: Block[],
  text = JSON.stringify({ sectionId: "scope", blocks }),
) {
  return readRedraftReply({
    text,
    sectionId: "scope",
    current: scope.blocks,
    finding,
    tradingName: model.facts.tradingName,
    allowedPhrases: allowed,
    readabilityGate: gate,
  });
}

/** A redraft that keeps the current section and adds one sentence to its first paragraph. */
function goodBlocks(): Block[] {
  const [first, ...rest] = scope.blocks;
  return [
    {
      type: "paragraph",
      text: `${(first as { text: string }).text} Family members, nominees and advocates can complain for a participant, and we tell each participant this when supports begin.`,
    },
    ...rest,
  ];
}

describe("buildRedraftRequest (FR-B2, AC-B5)", () => {
  const request = buildRedraftRequest({
    type,
    model,
    sectionId: "scope",
    standard,
    finding,
    modelId: "claude-sonnet-5-5",
  });

  it("carries the section, its brief, the standard, the indicator, the finding and the outline headings", () => {
    expect(request.promptVersion).toBe(REDRAFT_PROMPT_VERSION);
    expect(request.user).toContain("<<<CURRENT SECTION>>>");
    expect(request.user).toContain("This policy covers Example Supports");
    expect(request.user).toContain("Section brief:");
    expect(request.user).toContain("<<<STANDARD>>>");
    expect(request.user).toContain(standard.indicators[0]);
    expect(request.user).toContain("<<<FINDING>>>");
    expect(request.user).toContain(finding);
    expect(request.user).toContain("<<<OUTLINE>>>");
    for (const o of outlineFor(type))
      expect(request.user).toContain(`${o.number} ${o.heading}`);
    expect(request.user).toContain('sectionId must be "scope"');
    expect(request.user).toBe(
      `${request.blocks.document}

${request.blocks.section}`,
    );
  });

  it("carries no facts block, no other section's text, no register row, no email and no token", () => {
    expect(request.user).not.toContain("<<<FACTS>>>");
    expect(request.user).not.toMatch(/tradingName:|workerCountBand:|abn:/);
    // The procedure section's own words are not in the request.
    const procedure = model.sections.find((s) => s.id === "procedure")!;
    const firstProcedureText = (procedure.blocks[0] as { text: string }).text;
    expect(request.user).not.toContain(firstProcedureText.slice(0, 60));
    expect(request.user).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(request.user).not.toMatch(/\btoken\b/i);
    expect(request.user).not.toMatch(/\bINC-\d{4}\b|\bCMP-\d{4}\b/);
  });

  it("refuses a fixed section or one that is not in the document", () => {
    expect(redraftTarget(type, model, "definitions")).toBeNull();
    expect(redraftTarget(type, model, "no-such-section")).toBeNull();
    expect(() =>
      buildRedraftRequest({
        type,
        model,
        sectionId: "definitions",
        standard,
        finding,
        modelId: "m",
      }),
    ).toThrow(/not a tailored section/);
  });
});

describe("readRedraftReply and the redraft checks (FR-B3, AC-B4)", () => {
  it("accepts a redraft that keeps the current words and adds what was missing", () => {
    const r = reading(goodBlocks());
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it("refuses a section that names the audit, the auditor, the finding or a closed non-conformity", () => {
    for (const word of [
      "audit",
      "auditor",
      "finding",
      "non-conformity",
      "closed",
    ]) {
      const blocks = goodBlocks();
      blocks.push({
        type: "paragraph",
        text: `This was updated after the ${word} of 2026.`,
      });
      const r = reading(blocks);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problems.join(" ")).toMatch(/names the audit/);
    }
  });

  it("refuses a section that quotes the finding's sentence", () => {
    const blocks = goodBlocks();
    blocks.push({ type: "paragraph", text: finding.split(". ")[0] + "." });
    const r = reading(blocks);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join(" ")).toMatch(/quoted/);
  });

  it("refuses a section that drops the provider's name or its state", () => {
    const without = goodBlocks().map((b) =>
      b.type === "paragraph"
        ? { ...b, text: b.text.split("Example Supports").join("we") }
        : b.type === "table"
          ? {
              ...b,
              rows: b.rows.map((r) =>
                r.map((c) =>
                  c
                    .split("Example Supports")
                    .join("we")
                    .split("New South Wales")
                    .join("our state"),
                ),
              ),
            }
          : b,
    ) as Block[];
    const problems = redraftChecks({
      current: scope.blocks,
      proposed: without,
      finding,
      tradingName: model.facts.tradingName,
    });
    expect(problems).toContain('the redraft dropped "Example Supports"');
    expect(problems).toContain('the redraft dropped "New South Wales"');
  });

  it("refuses a reply that is not JSON, has the wrong section id or an unknown block", () => {
    expect(reading([], "Sorry, I cannot help with that.").ok).toBe(false);
    const wrong = reading(
      goodBlocks(),
      JSON.stringify({ sectionId: "purpose", blocks: goodBlocks() }),
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok)
      expect(wrong.problems[0]).toMatch(/sectionId must be "scope"/);
    const unknown = reading(
      goodBlocks(),
      JSON.stringify({
        sectionId: "scope",
        blocks: [{ type: "heading", text: "Scope" }],
      }),
    );
    expect(unknown.ok).toBe(false);
  });

  it("names the one message the page shows when the checks refuse (D-2957)", () => {
    expect(REDRAFT_REFUSED_MESSAGE).toBe(
      "The redraft did not pass our checks; nothing was changed.",
    );
  });
});

describe("redraftModel (FR-B5, FR-B6; D-2855, D-2958)", () => {
  const next = redraftModel(model, {
    sectionId: "scope",
    blocks: goodBlocks(),
    version: 2,
    today: "2026-10-19",
    reference: "FND-0001",
    previous: { name: "Sam Example", role: "Owner" },
  });

  it("replaces the one section as generated and leaves every other section as it was", () => {
    const scopeAfter = next.sections.find((s) => s.id === "scope")!;
    expect(scopeAfter.status).toBe("generated");
    expect((scopeAfter.blocks[0] as { text: string }).text).toContain(
      "advocates can complain",
    );
    for (const s of model.sections)
      if (!["scope", "document-control", "change-log"].includes(s.id))
        expect(next.sections.find((x) => x.id === s.id)).toEqual(s);
  });

  it("moves the version and adds the change-log row an auditor looks for, bracketed for the snapshot", () => {
    expect(next.version).toBe("2");
    const control = next.sections.find((s) => s.id === "document-control")!;
    const table = control.blocks.find((b) => b.type === "table") as {
      rows: string[][];
    };
    expect(table.rows.find((r) => r[0] === "Version")?.[1]).toBe("2");
    const log = next.sections.find((s) => s.id === "change-log")!;
    const rows = (
      log.blocks.find((b) => b.type === "table") as { rows: string[][] }
    ).rows;
    expect(rows.at(-1)).toEqual([
      "2",
      "19 October 2026",
      redraftChangeText("2", "Scope", "FND-0001"),
      "[name]",
    ]);
    expect(rows.at(-1)![2]).toBe(
      "Section 2 Scope redrafted after audit finding FND-0001; approved by [role]",
    );
    // The earlier row names the approver who signed it.
    expect(rows[0][3]).toBe("Sam Example");
  });

  it("leaves the earlier rows bracketed when the earlier version was never adopted", () => {
    const unadopted = redraftModel(model, {
      sectionId: "scope",
      blocks: goodBlocks(),
      version: 2,
      today: "2026-10-19",
      reference: "FND-0002",
      previous: null,
    });
    const log = unadopted.sections.find((s) => s.id === "change-log")!;
    const rows = (
      log.blocks.find((b) => b.type === "table") as { rows: string[][] }
    ).rows;
    expect(rows[0][3]).toBe("[name]");
  });
});

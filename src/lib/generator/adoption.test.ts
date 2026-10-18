// @vitest-environment node
/**
 * Retro review of REQ-018 to 021, finding 3 (PO decision 3, 15 Oct 2026):
 * after adoption the document's own control table carries the register's
 * adoption date and next review date, not the drafting day plus the cycle.
 */
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentControlRows } from "@/lib/registers/document-control";
import { blocksToText } from "./section-schema";
import {
  APPROVAL_DATE_LABEL,
  NEXT_REVIEW_LABEL,
  adoptionsByType,
  applyAdoption,
  type Adoption,
  applyProviderAbn,
  fillForRead,
} from "./adoption";
import { documentTypeById } from "./catalogue";
import { buildSkeleton, type DocumentModel } from "./document-model";
import { buildProviderFacts } from "./facts";
import { applyFacts } from "./facts-fill";
import { loadReferenceCases } from "./reference-cases";

const dataset = getStandardsDataset();
const c = loadReferenceCases()[0];
const facts = buildProviderFacts(c.answers, c.result);
const DRAFTED = "2026-10-14";
const ADOPTED = "2026-10-15";

function skeleton(typeId: string): DocumentModel {
  const type = documentTypeById(typeId);
  if (!type) throw new Error(`no document type ${typeId}`);
  return buildSkeleton({
    type,
    facts,
    dataset,
    result: c.result,
    version: "1",
    generatedAt: DRAFTED,
  });
}

function controlCell(model: DocumentModel, label: string): string | undefined {
  const section = model.sections.find((s) => s.id === "document-control");
  const table = section?.blocks.find((b) => b.type === "table");
  if (!table || table.type !== "table") return undefined;
  return table.rows.find((r) => r[0] === label)?.[1];
}

function reviewText(model: DocumentModel): string {
  const section = model.sections.find((s) => s.id === "review");
  return section ? blocksToText(section.blocks) : "";
}

/** The register's row for the fixture document, as the adopt flow writes it (adopted today, a 12-month cycle). */
function registerRow(model: DocumentModel) {
  return documentControlRows(
    {
      documents: [
        {
          document_type_id: model.typeId,
          title: model.title,
          version: 1,
          created_at: `${DRAFTED}T03:00:00Z`,
          // REQ-024 A0 (D-2427): the version's own adoption date is the register's truth.
          adopted_on: ADOPTED,
        },
      ],
      changes: [],
      reviews: [
        {
          document_type_id: model.typeId,
          adopted_on: ADOPTED,
          review_cycle_months: 12,
          last_reviewed_on: null,
          next_review_on: null,
        },
      ],
      circulations: [],
      adoptedByRole: "Owner",
    },
    ADOPTED,
  )[0];
}

function adoptionFor(map: Map<string, Adoption>, typeId: string): Adoption {
  const a = map.get(typeId);
  if (!a) throw new Error(`no adoption for ${typeId}`);
  return a;
}

describe("the control table after adoption (retro 018-021 finding 3)", () => {
  const drafted = applyFacts(skeleton("governance-policy"), {
    name: "Jane Citizen",
    role: "Owner",
    date: "14 October 2026",
  });
  const row = registerRow(drafted);
  const adoptions = adoptionsByType([row]);
  const adopted = applyAdoption(
    drafted,
    adoptionFor(adoptions, drafted.typeId),
  );

  it("the drafted document shows the drafting day plus the cycle, which is not what the register holds", () => {
    expect(controlCell(drafted, NEXT_REVIEW_LABEL)).toBe("14 October 2027");
    expect(controlCell(drafted, APPROVAL_DATE_LABEL)).toBe("14 October 2026");
    expect(row.adopted_on).toBe(ADOPTED);
    expect(row.next_review_on).toBe("2027-10-15");
  });

  it("writes the register's adoption and next review dates into the table, the review sentence and the model", () => {
    expect(controlCell(adopted, APPROVAL_DATE_LABEL)).toBe("15 October 2026");
    expect(controlCell(adopted, NEXT_REVIEW_LABEL)).toBe("15 October 2027");
    expect(reviewText(adopted)).toContain("Next review: 15 October 2027.");
    expect(reviewText(adopted)).not.toContain("14 October 2027");
    expect(adopted.reviewDueAt).toBe("2027-10-15");
    // The rest of the table and every other section are untouched.
    expect(controlCell(adopted, "Drafted")).toBe("14 October 2026");
    expect(controlCell(adopted, "Approver")).toBe("Jane Citizen, Owner");
    const others = (m: DocumentModel) =>
      m.sections.filter(
        (s) => s.id !== "document-control" && s.id !== "review",
      );
    expect(others(adopted)).toEqual(others(drafted));
  });

  it("is idempotent, so a later re-render with the same dates adds no version", () => {
    const again = applyAdoption(
      adopted,
      adoptionFor(adoptions, drafted.typeId),
    );
    expect(JSON.stringify(again)).toBe(JSON.stringify(adopted));
  });

  it("skips a register row that is not adopted, so an unadopted document keeps its drafted dates", () => {
    const map = adoptionsByType([
      { document_type_id: "x", adopted_on: null, next_review_on: null },
      { document_type_id: "y", adopted_on: ADOPTED, next_review_on: null },
      {
        document_type_id: "z",
        adopted_on: ADOPTED,
        next_review_on: "2027-10-15",
      },
    ]);
    expect([...map.keys()]).toEqual(["z"]);
  });

  it("covers every document type in the fixture set: each control table carries both labels for the adoption to write", () => {
    for (const d of c.result.documents) {
      const model = skeleton(d.id);
      expect(controlCell(model, APPROVAL_DATE_LABEL), d.id).toBe("[date]");
      expect(controlCell(model, NEXT_REVIEW_LABEL), d.id).toBe(
        "14 October 2027",
      );
      const after = applyAdoption(model, {
        adoptedOn: ADOPTED,
        nextReviewOn: "2027-10-15",
      });
      expect(controlCell(after, APPROVAL_DATE_LABEL), d.id).toBe(
        "15 October 2026",
      );
      expect(controlCell(after, NEXT_REVIEW_LABEL), d.id).toBe(
        "15 October 2027",
      );
    }
  });
});

describe("REQ-029: the adoption snapshot fills the four fixed blanks; a draft keeps them (FR-3, FR-4, FR-5; D-2854, D-2855)", () => {
  const template = skeleton("governance-policy");
  const snapshot = {
    adoptedOn: "2026-10-18",
    nextReviewOn: "2027-10-18",
    approverName: "Jane Citizen",
    approverRole: "Owner",
  };
  const cells = (m: DocumentModel, sectionId: string) =>
    m.sections
      .find((s) => s.id === sectionId)!
      .blocks.flatMap((b) => (b.type === "table" ? b.rows : []));

  it("fills the Approver row, the approval date, the responsibilities role and the change-log author from the snapshot alone", () => {
    const adopted = applyAdoption(template, snapshot);
    expect(controlCell(adopted, "Approver")).toBe("Jane Citizen, Owner");
    expect(controlCell(adopted, APPROVAL_DATE_LABEL)).toBe("18 October 2026");
    expect(controlCell(adopted, NEXT_REVIEW_LABEL)).toBe("18 October 2027");
    expect(cells(adopted, "change-log")[0]?.at(-1)).toBe("Jane Citizen");
    const roles = adopted.sections
      .flatMap((s) => s.blocks)
      .flatMap((b) => (b.type === "table" ? b.rows : []))
      .map((r) => r[0]);
    expect(roles).toContain("Owner");
    expect(JSON.stringify(adopted)).not.toMatch(/\[name\]|\[role\]|\[date\]/);
    // The template is untouched.
    expect(JSON.stringify(template)).toContain("[name], [role]");
  });

  it("a snapshot without a role leaves [role] as a visible blank beside the name (FR-4)", () => {
    const adopted = applyAdoption(template, {
      ...snapshot,
      approverRole: null,
    });
    expect(controlCell(adopted, "Approver")).toBe("Jane Citizen, [role]");
  });

  it("a version adopted before the snapshot existed fills no name: its text already carries the values (FR-9)", () => {
    const dated = applyAdoption(template, {
      adoptedOn: "2026-10-18",
      nextReviewOn: "2027-10-18",
    });
    expect(controlCell(dated, "Approver")).toBe("[name], [role]");
    expect(controlCell(dated, APPROVAL_DATE_LABEL)).toBe("18 October 2026");
  });

  it("FR-8: only the ABN part of the Provider cell rebuilds; the trading name stays; no ABN leaves the name alone", () => {
    const withAbn = applyProviderAbn(template, "51 824 753 556");
    const provider = controlCell(withAbn, "Provider") ?? "";
    expect(provider).toMatch(/ \(ABN 51 824 753 556\)$/);
    const name = provider.replace(/ \(ABN .*\)$/, "");
    expect(
      controlCell(applyProviderAbn(withAbn, "11 111 111 111"), "Provider"),
    ).toBe(`${name} (ABN 11 111 111 111)`);
    expect(controlCell(applyProviderAbn(withAbn, null), "Provider")).toBe(name);
  });

  it("fillForRead on a draft fills the contact blank and keeps the approver's; on an adopted version it fills both", () => {
    const facts = {
      name: "Someone Else",
      role: "Director",
      "phone-or-email": "0400 000 000",
    };
    const draft = fillForRead(template, { facts, adoption: null, abn: null });
    expect(JSON.stringify(draft)).not.toContain("[phone or email]");
    expect(controlCell(draft, "Approver")).toBe("[name], [role]");
    expect(JSON.stringify(draft)).not.toContain("Someone Else");
    const adopted = fillForRead(template, {
      facts,
      adoption: snapshot,
      abn: "51 824 753 556",
    });
    expect(controlCell(adopted, "Approver")).toBe("Jane Citizen, Owner");
    expect(JSON.stringify(adopted)).not.toContain("Someone Else");
    expect(controlCell(adopted, "Provider")).toContain("(ABN 51 824 753 556)");
  });
});

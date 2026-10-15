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

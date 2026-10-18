/** REQ-029 FR-6 (D-2855): a changed approver is a re-approval, a new version whose change log says so. */
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { applyAdoption } from "./adoption";
import { documentTypeById } from "./catalogue";
import { buildSkeleton, type DocumentModel } from "./document-model";
import { buildProviderFacts } from "./facts";
import { loadReferenceCases } from "./reference-cases";
import {
  REAPPROVAL_CHANGE_TEXT,
  needsReapproval,
  reapprovalModel,
} from "./reapproval";

const c = loadReferenceCases()[0];
const facts = buildProviderFacts(c.answers, c.result);
const dataset = getStandardsDataset();
const template = buildSkeleton({
  type: documentTypeById("governance-policy")!,
  facts,
  dataset,
  result: c.result,
  version: "1",
  generatedAt: "2026-10-14",
});

const rows = (m: DocumentModel, sectionId: string) =>
  m.sections
    .find((s) => s.id === sectionId)!
    .blocks.flatMap((b) => (b.type === "table" ? b.rows : []));

describe("needsReapproval", () => {
  const adopted = {
    adopted_on: "2026-10-18",
    approver_name: "Jane Citizen",
    approver_role: "Owner",
  };
  it("is true when the name or the role behind an adopted snapshot has changed, false otherwise", () => {
    expect(
      needsReapproval(adopted, { name: "Jane Citizen", role: "Owner" }),
    ).toBe(false);
    expect(
      needsReapproval(adopted, { name: "Jane Citizen", role: "Director" }),
    ).toBe(true);
    expect(
      needsReapproval(adopted, { name: "Sam Worker", role: "Owner" }),
    ).toBe(true);
    expect(
      needsReapproval(adopted, { name: " Jane Citizen ", role: " Owner " }),
    ).toBe(false);
  });
  it("is false for a draft, for a version adopted before the snapshot existed, and for an account with no name", () => {
    expect(
      needsReapproval(
        {
          adopted_on: null,
          approver_name: "Jane Citizen",
          approver_role: "Owner",
        },
        { name: "X", role: "Y" },
      ),
    ).toBe(false);
    expect(
      needsReapproval(
        { adopted_on: "2026-10-01", approver_name: null, approver_role: null },
        { name: "X", role: "Y" },
      ),
    ).toBe(false);
    expect(needsReapproval(adopted, { role: "Director" })).toBe(false);
  });
});

describe("reapprovalModel", () => {
  const v2 = reapprovalModel(template, {
    version: 2,
    today: "2026-10-18",
    previous: { name: "Jane Citizen", role: "Owner" },
  });

  it("moves the version, names the earlier approver on the earlier change-log rows and appends the bracketed re-approval row", () => {
    expect(v2.version).toBe("2");
    expect(
      rows(v2, "document-control").find((r) => r[0] === "Version")?.[1],
    ).toBe("2");
    const log = rows(v2, "change-log");
    expect(log).toHaveLength(2);
    expect(log[0].at(-1)).toBe("Jane Citizen");
    expect(log[1]).toEqual([
      "2",
      "18 October 2026",
      REAPPROVAL_CHANGE_TEXT,
      "[name]",
    ]);
    // The Approver row stays bracketed for the new snapshot; nothing else moved.
    expect(
      rows(v2, "document-control").find((r) => r[0] === "Approver")?.[1],
    ).toBe("[name], [role]");
    expect(
      v2.sections.filter(
        (s) => s.id !== "document-control" && s.id !== "change-log",
      ),
    ).toEqual(
      template.sections.filter(
        (s) => s.id !== "document-control" && s.id !== "change-log",
      ),
    );
  });

  it("filled with the new snapshot, the document reads the new approver and the log reads 'Approver changed to Director; re-approved' by the new name", () => {
    const filled = applyAdoption(v2, {
      adoptedOn: "2026-10-18",
      nextReviewOn: "2027-10-18",
      approverName: "Jane Citizen",
      approverRole: "Director",
    });
    expect(
      rows(filled, "document-control").find((r) => r[0] === "Approver")?.[1],
    ).toBe("Jane Citizen, Director");
    const log = rows(filled, "change-log");
    expect(log[0].at(-1)).toBe("Jane Citizen");
    expect(log[1]).toEqual([
      "2",
      "18 October 2026",
      "Approver changed to Director; re-approved",
      "Jane Citizen",
    ]);
    expect(JSON.stringify(filled)).not.toMatch(/\[name\]|\[role\]|\[date\]/);
  });
});

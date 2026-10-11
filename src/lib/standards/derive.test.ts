/**
 * REQ-001 AC-2, AC-3, AC-10 and the PO's Session A review items 2 (reasons,
 * silEligibility, midTermAudit). Decision-table style: every branch in the
 * rules code is exercised (definition of done, item 2).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { StandardsDataset } from "./schema";
import {
  DerivationError,
  applicableStandards,
  deriveApplicability,
  type DeriveInput,
} from "./derive";

const dataset = StandardsDataset.parse(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "data/standards.json"), "utf8"),
  ),
);

const base: Omit<DeriveInput, "groups"> = {
  businessStructure: "sole-trader",
  usesRestrictivePractices: false,
};
const derive = (groups: string[], extra: Partial<DeriveInput> = {}) =>
  deriveApplicability(dataset, { ...base, groups, ...extra });

const sourceIds = new Set(dataset.sources.map((s) => s.id));

describe("AC-2: every registration group on its own", () => {
  for (const g of dataset.registrationGroups) {
    it(`${g.code} ${g.name}: at least one module and a pathway`, () => {
      const extra: Partial<DeriveInput> =
        g.code === "0138"
          ? {
              silEligibility: {
                fewHoursOnly: false,
                participantManagesOwnWorkers: false,
              },
            }
          : {};
      const result = derive([g.code], extra);
      expect(result.modules.length).toBeGreaterThan(0);
      expect(result.pathway).toBe(g.auditType);
      expect(result.reasons.length).toBeGreaterThan(0);
      for (const reason of result.reasons)
        expect(sourceIds.has(reason.sourceId), reason.rule).toBe(true);
    });
  }
});

describe("AC-3: verification versus certification", () => {
  it("[0120] alone is verification with the verification module only", () => {
    const r = derive(["0120"]);
    expect(r.pathway).toBe("verification");
    expect(r.modules).toEqual(["verification"]);
    expect(r.reasons.map((x) => x.rule)).toContain("verification-pathway");
    expect(r.midTermAudit.applies).toBe(false);
  });

  it("[0120, 0107] is certification without the verification module", () => {
    const r = derive(["0120", "0107"]);
    expect(r.pathway).toBe("certification");
    expect(r.modules).toEqual(["core"]);
    expect(r.modules).not.toContain("verification");
    const mixed = r.reasons.find((x) => x.rule === "mixed-audit")!;
    expect(mixed.effect).toBe("pathway");
    expect(mixed.sourceId).toBe(dataset.rules.mixedAuditSourceId);
    expect(r.midTermAudit.applies).toBe(true);
  });

  it("[0107, 0104, 0110] adds the high intensity and specialist behaviour support modules in dataset order", () => {
    const r = derive(["0110", "0104", "0107"]);
    expect(r.modules).toEqual(["core", "hidpa", "sbs"]);
    expect(
      r.reasons.filter((x) => x.effect === "add-module").map((x) => x.target),
    ).toEqual(["core", "sbs", "hidpa"]);
  });
});

describe("AC-10: SDA-only and modified certification", () => {
  it("[0131] alone shows the SDA module without the core module and no mid-term audit", () => {
    const r = derive(["0131"]);
    expect(r.pathway).toBe("certification");
    expect(r.modules).toEqual(["sda"]);
    expect(r.reasons.find((x) => x.rule === "sda-only")?.effect).toBe(
      "remove-module",
    );
    expect(r.midTermAudit.applies).toBe(false);
    expect(r.midTermAudit.exemptReason).toMatch(
      /specialist disability accommodation/,
    );
  });

  it("[0131, 0120] brings the core module back in", () => {
    const r = derive(["0131", "0120"]);
    expect(r.modules).toEqual(["core", "sda"]);
    expect(r.midTermAudit.applies).toBe(true);
  });

  it("[0118] as a sole trader shows modified certification", () => {
    const r = derive(["0118"], { businessStructure: "sole-trader" });
    expect(r.pathway).toBe("certification");
    expect(r.modifiedCertification).toBe(true);
    expect(r.modules).toEqual(["core", "ec"]);
    expect(r.coreStandardIds).toEqual(
      dataset.rules.modifiedCertification.coreStandardIds,
    );
    expect(
      r.reasons.find((x) => x.rule === "modified-certification")?.effect,
    ).toBe("limit-core");
    expect(r.midTermAudit.applies).toBe(false);
    expect(r.midTermAudit.exemptReason).toMatch(/early childhood/);
    const standards = applicableStandards(dataset, r);
    expect(
      standards.filter((s) => s.moduleId === "core").map((s) => s.id),
    ).toEqual(dataset.rules.modifiedCertification.coreStandardIds);
    expect(standards.filter((s) => s.moduleId === "ec")).toHaveLength(7);
  });

  it("[0118, 0120] as a partnership is still modified certification (verification groups do not count)", () => {
    const r = derive(["0118", "0120"], { businessStructure: "partnership" });
    expect(r.modifiedCertification).toBe(true);
    expect(r.modules).toEqual(["core", "ec"]);
    // PO Session B review note (a): the Commission text does not settle this combination.
    const reason = r.reasons.find((x) => x.rule === "modified-certification")!;
    expect(reason.unverified).toBe(true);
    expect(reason.text).toMatch(/unconfirmed/);
  });

  it("[0118] as a company is full certification", () => {
    const r = derive(["0118"], { businessStructure: "company" });
    expect(r.modifiedCertification).toBe(false);
    expect(r.coreStandardIds).toBeNull();
    expect(r.modules).toEqual(["core", "ec"]);
    expect(r.midTermAudit.applies).toBe(true);
  });

  it("[0118, 0107] as a sole trader is full certification because another certification class is present", () => {
    const r = derive(["0118", "0107"]);
    expect(r.modifiedCertification).toBe(false);
    expect(
      applicableStandards(dataset, r).filter((s) => s.moduleId === "core"),
    ).toHaveLength(24);
  });
});

describe("SIL eligibility (PO review item 2)", () => {
  const eligible = { fewHoursOnly: false, participantManagesOwnWorkers: false };

  it("0138 with both exclusions false keeps the SIL module and the core module", () => {
    const r = derive(["0138"], { silEligibility: eligible });
    expect(r.groups).toEqual(["0138"]);
    expect(r.modules).toEqual(["core", "sil"]);
    expect(r.reasons.find((x) => x.rule === "sil-definition")?.effect).toBe(
      "info",
    );
  });

  it("0138 is removed when the participant only receives a few hours of support", () => {
    const r = derive(["0138", "0107"], {
      silEligibility: { ...eligible, fewHoursOnly: true },
    });
    expect(r.groups).toEqual(["0107"]);
    expect(r.modules).toEqual(["core"]);
    const reason = r.reasons.find((x) => x.rule === "sil-definition")!;
    expect(reason.effect).toBe("remove-group");
    expect(reason.target).toBe("0138");
    expect(reason.sourceId).toBe(dataset.rules.silDefinition.sourceId);
  });

  it("0138 is removed when the participant manages their own workers", () => {
    const r = derive(["0138", "0120"], {
      silEligibility: { ...eligible, participantManagesOwnWorkers: true },
    });
    expect(r.groups).toEqual(["0120"]);
    expect(r.pathway).toBe("verification");
  });

  it("0138 alone with an exclusion leaves nothing to assess", () => {
    expect(() =>
      derive(["0138"], { silEligibility: { ...eligible, fewHoursOnly: true } }),
    ).toThrow(DerivationError);
  });

  it("0138 without the eligibility answers is an error", () => {
    expect(() => derive(["0138"])).toThrow(/SIL eligibility/);
  });
});

describe("restrictive practices", () => {
  it("adds the implementing behaviour support plans module to a certification pathway", () => {
    const r = derive(["0107"], { usesRestrictivePractices: true });
    expect(r.modules).toEqual(["core", "ibsp"]);
    const reason = r.reasons.find(
      (x) => x.rule === "restrictive-practices" && x.effect === "add-module",
    )!;
    expect(reason.sourceId).toBe(dataset.rules.restrictivePracticesSourceId);
  });

  it("does not duplicate the module when a group already brings it in", () => {
    const r = derive(["0110"], { usesRestrictivePractices: true });
    expect(r.modules).toEqual(["core", "sbs", "ibsp"]);
    expect(r.reasons.filter((x) => x.target === "ibsp")).toHaveLength(1);
  });

  it("on a verification pathway adds the module and an unverified note about the audit type", () => {
    const r = derive(["0120"], { usesRestrictivePractices: true });
    expect(r.pathway).toBe("verification");
    expect(r.modules).toEqual(["ibsp", "verification"]);
    expect(
      r.reasons.some((x) => x.rule === "restrictive-practices" && x.unverified),
    ).toBe(true);
  });
});

describe("input handling", () => {
  it("rejects an unknown group code", () => {
    expect(() => derive(["0199"])).toThrow(/Unknown registration group/);
  });

  it("rejects an empty selection", () => {
    expect(() => derive([])).toThrow(DerivationError);
  });

  it("ignores duplicate codes", () => {
    expect(derive(["0120", "0120"]).groups).toEqual(["0120"]);
  });

  it("is deterministic", () => {
    const a = derive(["0107", "0104"], { usesRestrictivePractices: true });
    const b = derive(["0104", "0107"], { usesRestrictivePractices: true });
    expect(a.modules).toEqual(b.modules);
    expect(a.pathway).toBe(b.pathway);
  });
});

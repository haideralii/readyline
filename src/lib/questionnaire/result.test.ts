/**
 * REQ-003 AC-1 to AC-6 and AC-10 at the model level (the UI renders this
 * result verbatim), plus the adapter rule that the services note never
 * reaches derivation.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { StandardsDataset } from "@/lib/standards/schema";
import { toDeriveInput } from "./adapter";
import { buildResult } from "./result";
import { QuestionnaireAnswers } from "./schema";
import { validAnswers } from "./schema.test";

const dataset = StandardsDataset.parse(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "data/standards.json"), "utf8"),
  ),
);

const answers = (over: Partial<Record<keyof typeof validAnswers, unknown>>) =>
  QuestionnaireAnswers.parse({ ...validAnswers, ...over });

const build = (over: Partial<Record<keyof typeof validAnswers, unknown>>) => {
  const out = buildResult(dataset, answers(over));
  if (!out.ok) throw new Error(out.message);
  return out.result;
};

describe("adapter", () => {
  it("never passes the services note to derivation (PO item 1, SR-2)", () => {
    const secret = "Participant Jane Doe lives at 12 Example St";
    const { input } = toDeriveInput(
      answers({ supports: { groups: ["0120"], servicesNote: secret } }),
    );
    expect(JSON.stringify(input)).not.toContain("servicesNote");
    expect(JSON.stringify(input)).not.toContain("Jane");
    expect(Object.keys(input).sort()).toEqual([
      "businessStructure",
      "groups",
      "usesRestrictivePractices",
    ]);
  });

  it("treats 'not sure' about restrictive practices as yes and flags it", () => {
    const unsure = toDeriveInput(
      answers({ practices: { restrictivePractices: "not-sure" } }),
    );
    expect(unsure.input.usesRestrictivePractices).toBe(true);
    expect(unsure.flags.restrictivePracticesAssumed).toBe(true);
    const yes = toDeriveInput(
      answers({ practices: { restrictivePractices: "yes" } }),
    );
    expect(yes.input.usesRestrictivePractices).toBe(true);
    expect(yes.flags.restrictivePracticesAssumed).toBe(false);
    expect(toDeriveInput(answers({})).input.usesRestrictivePractices).toBe(
      false,
    );
  });
});

describe("buildResult", () => {
  it("AC-1: [0120] is verification with the verification module, no mid-term audit, source cited", () => {
    const r = build({ supports: { groups: ["0120"] } });
    expect(r.pathway).toBe("verification");
    expect(r.modules.map((m) => m.id)).toEqual(["verification"]);
    expect(r.modules[0].standardCount).toBe(4);
    expect(r.midTermAudit.applies).toBe(false);
    const pathwayReason = r.reasons.find((x) => x.effect === "pathway")!;
    expect(pathwayReason.source.id).toBe("registration-groups");
    expect(pathwayReason.source.url).toMatch(
      /^https:\/\/www\.ndiscommission\.gov\.au\//,
    );
    expect(r.documents.map((d) => d.id)).toEqual(
      // REQ-016 S-6: the AI content lives in the privacy policy; no standalone AI document.
      expect.arrayContaining([
        "governance-policy",
        "privacy-and-information-management-policy",
      ]),
    );
    expect(
      r.documents.some((d) => d.id === "medication-management-procedure"),
    ).toBe(false);
    expect(r.documents.some((d) => d.id.startsWith("ai-"))).toBe(false);
  });

  it("AC-2: [0120, 0107] is certification with the core module and a mid-term audit on governance", () => {
    const r = build({ supports: { groups: ["0120", "0107"] } });
    expect(r.pathway).toBe("certification");
    expect(r.modules.map((m) => m.id)).toEqual(["core"]);
    expect(r.modules[0].standardCount).toBe(24);
    expect(r.midTermAudit.applies).toBe(true);
    expect(r.midTermAudit.monthsAfterRegistration).toBe(18);
    expect(r.midTermAudit.assessedDivisionIds).toEqual(["governance"]);
    expect(
      r.documents.some((d) => d.id === "medication-management-procedure"),
    ).toBe(true); // 0107 is a personal care class
  });

  it("AC-3: [0131] alone is SDA without core; adding [0120] brings core back", () => {
    const alone = build({ supports: { groups: ["0131"] } });
    expect(alone.modules.map((m) => m.id)).toEqual(["sda"]);
    expect(alone.reasons.some((x) => x.rule === "sda-only")).toBe(true);
    const withTasks = build({ supports: { groups: ["0131", "0120"] } });
    expect(withTasks.modules.map((m) => m.id)).toEqual(["core", "sda"]);
  });

  it("AC-4: [0118] as a sole trader is modified certification with the single core standard named", () => {
    const r = build({ supports: { groups: ["0118"] } });
    expect(r.modifiedCertification).toBe(true);
    const core = r.modules.find((m) => m.id === "core")!;
    expect(core.standardCount).toBe(1);
    expect(core.standards[0].name).toMatch(/Violence, abuse, neglect/);
    expect(r.midTermAudit.applies).toBe(false);
  });

  it("AC-5: restrictive practices yes or not sure adds the implementing module; no does not", () => {
    for (const v of ["yes", "not-sure"] as const) {
      const r = build({
        supports: { groups: ["0107"] },
        practices: { restrictivePractices: v },
      });
      expect(r.modules.map((m) => m.id)).toContain("ibsp");
      expect(r.flags.restrictivePracticesAssumed).toBe(v === "not-sure");
      expect(r.reasons.some((x) => x.rule === "restrictive-practices")).toBe(
        true,
      );
    }
    expect(
      build({ supports: { groups: ["0107"] } }).modules.map((m) => m.id),
    ).not.toContain("ibsp");
  });

  it("AC-6: [0138] with an exclusion removes SIL from the modules with the reason shown", () => {
    const r = build({
      supports: {
        groups: ["0138", "0107"],
        silEligibility: {
          fewHoursOnly: true,
          participantManagesOwnWorkers: false,
        },
      },
    });
    expect(r.flags.silExcluded).toBe(true);
    expect(r.groups.map((g) => g.code)).toEqual(["0107"]);
    expect(r.modules.map((m) => m.id)).not.toContain("sil");
    const reason = r.reasons.find((x) => x.rule === "sil-definition")!;
    expect(reason.effect).toBe("remove-group");
    expect(reason.text).toMatch(/not supported independent living/);
    expect(reason.source.id).toBe("mandatory-sil");
  });

  it("[0138] eligible keeps SIL and brings in the SIL documents", () => {
    const r = build({
      supports: {
        groups: ["0138"],
        silEligibility: {
          fewHoursOnly: false,
          participantManagesOwnWorkers: false,
        },
      },
    });
    expect(r.modules.map((m) => m.id)).toEqual(["core", "sil"]);
    expect(r.documents.map((d) => d.id)).toContain(
      "supported-decision-making-procedure",
    );
    expect(r.flags.silExcluded).toBe(false);
  });

  it("0138 alone with an exclusion returns a derivation message instead of a result", () => {
    const out = buildResult(
      dataset,
      answers({
        supports: {
          groups: ["0138"],
          silEligibility: {
            fewHoursOnly: true,
            participantManagesOwnWorkers: false,
          },
        },
      }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("no-groups");
  });

  it("documents reflect what the provider already has and registers are listed", () => {
    const r = build({});
    const incidents = r.documents.find(
      (d) => d.id === "incident-management-policy-and-register",
    )!;
    expect(incidents.have).toBe("no");
    const complaints = r.documents.find(
      (d) => d.id === "complaints-management-policy-and-register",
    )!;
    expect(complaints.have).toBe("not-sure");
    expect(r.registers.map((x) => x.id)).toEqual([
      "incidents",
      "complaints",
      "worker-clearances",
      "training",
      "policy-reviews",
    ]);
    expect(r.registers.find((x) => x.id === "incidents")?.have).toBe("no");
  });

  it("the restrictive practice use register appears only when the implementing module is in scope (PO batch 7)", () => {
    const plain = build({ supports: { groups: ["0120", "0107"] } });
    expect(plain.registers.map((x) => x.id)).not.toContain(
      "restrictive-practices",
    );
    const withPractices = build({
      supports: { groups: ["0120", "0107"] },
      practices: { restrictivePractices: "yes" },
    });
    expect(withPractices.modules.map((m) => m.id)).toContain("ibsp");
    expect(withPractices.registers.map((x) => x.id)).toContain(
      "restrictive-practices",
    );
    expect(
      withPractices.documents.some(
        (d) => d.id === "support-planning-and-transitions-procedure",
      ),
    ).toBe(true);
    expect(
      withPractices.documents.some(
        (d) => d.id === "participant-money-and-property-procedure",
      ),
    ).toBe(true);
  });

  it("flags large providers above the threshold and 0108 adds the transport procedure", () => {
    const r = build({
      supports: { groups: ["0108"] },
      workforce: { ...validAnswers.workforce, workerCount: 26 },
    });
    expect(r.flags.largeProvider).toBe(true);
    expect(r.pathway).toBe("verification");
    // Transport procedure sits under the core module in the PO's mapping, so a verification-only provider does not get it.
    expect(r.documents.some((d) => d.id === "transport-safety-procedure")).toBe(
      false,
    );
    const cert = build({ supports: { groups: ["0108", "0107"] } });
    expect(
      cert.documents.some((d) => d.id === "transport-safety-procedure"),
    ).toBe(true);
  });

  it("REQ-013 AC-4: the not-sure helper resolves to yes or no and the assumption is shown only for yes", () => {
    const allNo = build({
      supports: { groups: ["0107"] },
      practices: {
        restrictivePractices: "not-sure",
        notSureHelper: {
          locksOrBarriers: false,
          holdsOrRestraint: false,
          medicationForBehaviour: false,
        },
      },
    });
    expect(allNo.modules.map((m) => m.id)).not.toContain("ibsp");
    expect(allNo.flags.restrictivePracticesAssumed).toBe(false);
    const oneYes = build({
      supports: { groups: ["0107"] },
      practices: {
        restrictivePractices: "not-sure",
        notSureHelper: {
          locksOrBarriers: false,
          holdsOrRestraint: true,
          medicationForBehaviour: false,
        },
      },
    });
    expect(oneYes.modules.map((m) => m.id)).toContain("ibsp");
    expect(oneYes.flags.restrictivePracticesAssumed).toBe(true);
  });
  it("AC-10: result copy carries the general-information notice and no prohibited claims", () => {
    const r = build({
      supports: { groups: ["0120", "0107", "0104"] },
      practices: { restrictivePractices: "not-sure" },
    });
    expect(r.notice).toMatch(/general information/i);
    const text = [
      r.pathwayDescription,
      r.notice,
      ...r.modules.map((m) => `${m.name} ${m.description}`),
      ...r.reasons.map((x) => x.text),
      ...r.documents.map((d) => d.title),
      ...r.registers.map((x) => x.title),
    ].join("\n");
    expect(findProhibitedClaims(text)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  canOpenStep,
  firstIncompleteStep,
  isStepId,
  nextStep,
  previousStep,
} from "./navigation";
import type { QuestionnaireDraft } from "./schema";

const business = {
  tradingName: "x",
  structure: "sole-trader" as const,
  states: ["NSW" as const],
};
const supports = { groups: ["0120"] };
const practices = { restrictivePractices: "no" as const };
const workforce = {
  workerCount: 1,
  keyPersonnelCount: 1,
  hasRiskAssessedRoles: false,
  allRiskAssessedScreened: "not-applicable" as const,
};
const existing = {
  policies: "no" as const,
  incidentRegister: "no" as const,
  complaintsRegister: "no" as const,
  insuranceCertificate: "no" as const,
  workerInductionRecords: "no" as const,
};

describe("step navigation", () => {
  it("orders steps and knows the ends", () => {
    expect(nextStep("business")).toBe("supports");
    expect(previousStep("business")).toBeNull();
    expect(nextStep("result")).toBeNull();
    expect(previousStep("result")).toBe("existing");
    expect(isStepId("supports")).toBe(true);
    expect(isStepId("admin")).toBe(false);
  });

  it("gates later steps until earlier ones are complete (FR-4)", () => {
    const none: QuestionnaireDraft["answers"] = {};
    expect(firstIncompleteStep(none)).toBe("business");
    expect(canOpenStep("business", none)).toBe(true);
    expect(canOpenStep("supports", none)).toBe(false);
    expect(canOpenStep("result", none)).toBe(false);

    const partial: QuestionnaireDraft["answers"] = { business, supports };
    expect(firstIncompleteStep(partial)).toBe("practices");
    expect(canOpenStep("practices", partial)).toBe(true);
    expect(canOpenStep("workforce", partial)).toBe(false);

    const all: QuestionnaireDraft["answers"] = {
      business,
      supports,
      practices,
      workforce,
      existing,
    };
    expect(firstIncompleteStep(all)).toBe("result");
    expect(canOpenStep("result", all)).toBe(true);
  });
});

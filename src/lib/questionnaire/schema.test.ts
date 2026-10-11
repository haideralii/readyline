import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/validation";
import {
  ABN_MESSAGE,
  QuestionnaireAnswers,
  QuestionnaireDraft,
  answersSchemaFor,
} from "./schema";

export const validAnswers = {
  answersVersion: 1 as const,
  business: {
    tradingName: "Sunrise Supports",
    structure: "sole-trader" as const,
    states: ["NSW" as const],
    abn: "51 824 753 556",
  },
  supports: { groups: ["0120", "0107"] },
  practices: { restrictivePractices: "no" as const },
  workforce: {
    workerCount: 1,
    keyPersonnelCount: 1,
    hasRiskAssessedRoles: true,
    allRiskAssessedScreened: "yes" as const,
  },
  existing: {
    policies: "no" as const,
    incidentRegister: "no" as const,
    complaintsRegister: "not-sure" as const,
    insuranceCertificate: "yes" as const,
    workerInductionRecords: "no" as const,
  },
};

describe("QuestionnaireAnswers", () => {
  it("accepts a complete answer set and normalises the ABN", () => {
    const r = parseInput(QuestionnaireAnswers, validAnswers);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.business.abn).toBe("51824753556");
  });

  it("treats a blank ABN as absent (optional field)", () => {
    const r = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      business: { ...validAnswers.business, abn: "  " },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.business.abn).toBeUndefined();
  });

  it("rejects a malformed ABN with the plain-English message (AC-8)", () => {
    const r = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      business: { ...validAnswers.business, abn: "12345678901" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors["business.abn"]).toEqual([ABN_MESSAGE]);
  });

  it("rejects unknown keys at every level (SR-1)", () => {
    const r = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      isAdmin: true,
    });
    expect(r.ok).toBe(false);
    const r2 = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      business: { ...validAnswers.business, extra: 1 },
    });
    expect(r2.ok).toBe(false);
  });

  it("requires the SIL eligibility answers when 0138 is chosen", () => {
    const r = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      supports: { groups: ["0138"] },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.fieldErrors["supports.silEligibility"]?.[0]).toMatch(
        /supported independent living/,
      );
    const ok = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      supports: {
        groups: ["0138"],
        silEligibility: {
          fewHoursOnly: false,
          participantManagesOwnWorkers: false,
        },
      },
    });
    expect(ok.ok).toBe(true);
  });

  it("caps the services note at 500 characters and the trading name at 120", () => {
    const long = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      supports: { groups: ["0120"], servicesNote: "x".repeat(501) },
    });
    expect(long.ok).toBe(false);
    const name = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      business: { ...validAnswers.business, tradingName: "x".repeat(121) },
    });
    expect(name.ok).toBe(false);
  });

  it("bounds worker counts", () => {
    const r = parseInput(QuestionnaireAnswers, {
      ...validAnswers,
      workforce: { ...validAnswers.workforce, workerCount: 0 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.fieldErrors["workforce.workerCount"][0]).toMatch(
        /Count yourself/,
      );
  });

  it("answersSchemaFor rejects classes that are not in the dataset", () => {
    const schema = answersSchemaFor(new Set(["0120"]));
    const r = parseInput(schema, validAnswers);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.fieldErrors["supports.groups.1"]).toEqual([
        "Unknown registration group",
      ]);
  });
});

describe("QuestionnaireDraft", () => {
  it("accepts a partial draft where completed steps are fully valid", () => {
    const r = parseInput(QuestionnaireDraft, {
      answersVersion: 1,
      answers: { business: validAnswers.business },
      currentStep: "supports",
      updatedAt: "2026-10-11T10:00:00.000Z",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a draft from another version so it can be migrated or discarded", () => {
    const r = parseInput(QuestionnaireDraft, {
      answersVersion: 2,
      answers: {},
      currentStep: "business",
      updatedAt: "2026-10-11T10:00:00.000Z",
    });
    expect(r.ok).toBe(false);
  });
});

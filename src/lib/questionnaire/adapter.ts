/**
 * Turns questionnaire answers into the input `deriveApplicability` needs
 * (REQ-003 Q1). The free-text `servicesNote` is never passed on (PO review
 * item 1; SR-2): derivation sees only structured answers about the business.
 */
import type { DeriveInput } from "@/lib/standards/derive";
import type { QuestionnaireAnswers } from "./schema";

export type DeriveAdapterResult = {
  input: DeriveInput;
  flags: {
    /** True when "not sure" about restrictive practices was treated as "yes". */
    restrictivePracticesAssumed: boolean;
  };
};

export function toDeriveInput(
  answers: QuestionnaireAnswers,
): DeriveAdapterResult {
  const rp = answers.practices.restrictivePractices;
  const input: DeriveInput = {
    groups: [...answers.supports.groups],
    businessStructure: answers.business.structure,
    usesRestrictivePractices: rp !== "no",
  };
  if (answers.supports.silEligibility) {
    input.silEligibility = { ...answers.supports.silEligibility };
  }
  return { input, flags: { restrictivePracticesAssumed: rp === "not-sure" } };
}

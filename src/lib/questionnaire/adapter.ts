/**
 * Turns questionnaire answers into the input `deriveApplicability` needs
 * (REQ-003 Q1). The free-text `servicesNote` is never passed on (PO review
 * item 1; SR-2): derivation sees only structured answers about the business.
 * REQ-013 FR-4: "not sure" about restrictive practices is resolved through
 * the three helper questions when they were answered.
 */
import type { DeriveInput } from "@/lib/standards/derive";
import {
  resolveRestrictivePractices,
  type QuestionnaireAnswers,
} from "./schema";

export type DeriveAdapterResult = {
  input: DeriveInput;
  flags: {
    /** True when "not sure" about restrictive practices resolved to "yes". */
    restrictivePracticesAssumed: boolean;
  };
};

export function toDeriveInput(
  answers: QuestionnaireAnswers,
): DeriveAdapterResult {
  const resolved = resolveRestrictivePractices(
    answers.practices.restrictivePractices,
    answers.practices.notSureHelper,
  );
  const input: DeriveInput = {
    groups: [...answers.supports.groups],
    businessStructure: answers.business.structure,
    usesRestrictivePractices: resolved.uses,
  };
  if (answers.supports.silEligibility) {
    input.silEligibility = { ...answers.supports.silEligibility };
  }
  return { input, flags: { restrictivePracticesAssumed: resolved.assumed } };
}

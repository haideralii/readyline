/**
 * Which questionnaire answers each fact comes from (REQ-005 FR-5): the
 * reviewer view shows "this section used: trading name (step 1), states
 * (step 1), support types (step 2)". Labels match the questionnaire steps.
 */
import type { FactKey } from "./facts";

export type FactSource = {
  step: 1 | 2 | 3 | 4;
  stepTitle: string;
  question: string;
};

export const FACT_SOURCES: Record<FactKey, FactSource> = {
  tradingName: {
    step: 1,
    stepTitle: "About your business",
    question: "Trading name",
  },
  abn: { step: 1, stepTitle: "About your business", question: "ABN" },
  structure: {
    step: 1,
    stepTitle: "About your business",
    question: "Business structure",
  },
  states: {
    step: 1,
    stepTitle: "About your business",
    question: "States and territories",
  },
  supportTypes: {
    step: 2,
    stepTitle: "The supports you deliver",
    question: "Registration groups",
  },
  pathway: {
    step: 2,
    stepTitle: "The supports you deliver",
    question: "Registration groups (audit type derived)",
  },
  modules: {
    step: 2,
    stepTitle: "The supports you deliver",
    question: "Registration groups (modules derived)",
  },
  workerCountBand: {
    step: 4,
    stepTitle: "Your workforce",
    question: "Number of workers",
  },
  keyPersonnelCount: {
    step: 4,
    stepTitle: "Your workforce",
    question: "Number of key personnel",
  },
  hasRiskAssessedRoles: {
    step: 4,
    stepTitle: "Your workforce",
    question: "Risk-assessed roles",
  },
  usesRestrictivePractices: {
    step: 3,
    stepTitle: "Restrictive practices",
    question: "Regulated restrictive practices",
  },
};

export function describeFactSources(keys: readonly string[]): FactSource[] {
  return keys
    .filter((k): k is FactKey => k in FACT_SOURCES)
    .map((k) => FACT_SOURCES[k])
    .filter(
      (s, i, all) => all.findIndex((x) => x.question === s.question) === i,
    );
}

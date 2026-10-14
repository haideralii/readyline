/**
 * The questionnaire's step ids, option lists and small pure rules, with no
 * schema library behind them (backlog 2, D-1012). Every step page used to
 * load zod and all five schemas before its first paint, through the
 * navigation gate, the draft store and the forms' option lists; the pages
 * now take these constants and load `schema.ts` only when a draft has to be
 * read or a step is submitted. `schema.ts` builds its enums from these
 * arrays and re-exports them, so the server and the tests see one source.
 */

export const STEP_IDS = [
  "business",
  "supports",
  "practices",
  "workforce",
  "existing",
  "result",
] as const;
export type StepId = (typeof STEP_IDS)[number];

export const ANSWER_STEP_IDS = [
  "business",
  "supports",
  "practices",
  "workforce",
  "existing",
] as const;
export type AnswerStepId = (typeof ANSWER_STEP_IDS)[number];

export const ANSWERS_VERSION = 1 as const;

export const STATE_CODES = [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "ACT",
  "NT",
] as const;

export const BUSINESS_STRUCTURES = [
  "sole-trader",
  "partnership",
  "company",
  "incorporated-association",
  "trust",
  "other",
] as const;

export const YES_NO_UNSURE = ["yes", "no", "not-sure"] as const;

export const SCREENING_ANSWERS = [
  "yes",
  "no",
  "not-sure",
  "not-applicable",
] as const;

export const SIL_CODE = "0138";

/** Above this many workers the result shows a positioning note (PO review item 1). */
export const LARGE_PROVIDER_THRESHOLD = 25;

export type NotSureHelperAnswer = {
  locksOrBarriers: boolean;
  holdsOrRestraint: boolean;
  medicationForBehaviour: boolean;
};

/**
 * REQ-013 FR-4: when a provider is not sure, three plain yes/no questions
 * resolve the answer. Present only with "not-sure"; any "yes" resolves to
 * yes (and the result says so), all "no" resolves to no.
 */
export function resolveRestrictivePractices(
  answer: (typeof YES_NO_UNSURE)[number],
  helper?: NotSureHelperAnswer,
): { uses: boolean; assumed: boolean } {
  if (answer === "yes") return { uses: true, assumed: false };
  if (answer === "no") return { uses: false, assumed: false };
  if (!helper) return { uses: true, assumed: true };
  const uses =
    helper.locksOrBarriers ||
    helper.holdsOrRestraint ||
    helper.medicationForBehaviour;
  return { uses, assumed: uses };
}

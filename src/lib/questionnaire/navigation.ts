/**
 * Step order, titles and the gate that keeps the result unreachable until the
 * required answers are valid (REQ-003 FR-4).
 */
import type { QuestionnaireDraft } from "./schema";
import {
  ANSWER_STEP_IDS,
  STEP_IDS,
  type AnswerStepId,
  type StepId,
} from "./steps";

export const STEP_TITLES: Record<StepId, string> = {
  business: "About your business",
  supports: "The supports you deliver",
  practices: "Restrictive practices",
  workforce: "Your workforce",
  existing: "What you already have",
  result: "Your result",
};

export const STEP_SHORT: Record<StepId, string> = {
  business: "Business",
  supports: "Supports",
  practices: "Practices",
  workforce: "Workforce",
  existing: "Already have",
  result: "Result",
};

export function isStepId(value: string): value is StepId {
  return (STEP_IDS as readonly string[]).includes(value);
}

export function stepIndex(step: StepId): number {
  return STEP_IDS.indexOf(step);
}

export function nextStep(step: StepId): StepId | null {
  const i = stepIndex(step);
  return i >= 0 && i < STEP_IDS.length - 1 ? STEP_IDS[i + 1] : null;
}

export function previousStep(step: StepId): StepId | null {
  const i = stepIndex(step);
  return i > 0 ? STEP_IDS[i - 1] : null;
}

/** The first answer step that has no valid saved data, or "result" when every step is complete. */
export function firstIncompleteStep(
  answers: QuestionnaireDraft["answers"],
): StepId {
  for (const id of ANSWER_STEP_IDS) if (!answers[id]) return id;
  return "result";
}

/** A step may be opened when every earlier answer step is complete. */
export function canOpenStep(
  step: StepId,
  answers: QuestionnaireDraft["answers"],
): boolean {
  return stepIndex(step) <= stepIndex(firstIncompleteStep(answers));
}

export function isAnswerStep(step: StepId): step is AnswerStepId {
  return step !== "result";
}

export function stepHref(step: StepId): string {
  return `/start/${step}`;
}

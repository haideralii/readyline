/**
 * Validates one step's answers on submit, loading the schema (and zod) at
 * that moment rather than with the page (backlog 2, D-1012): the forms show
 * their fields from `steps.ts`, and the first submit is the first time the
 * browser needs a schema.
 */
import type { ParseFailed } from "@/lib/validation";
import type { QuestionnaireAnswers } from "./schema";
import type { AnswerStepId } from "./steps";

export type StepParse<K extends AnswerStepId> =
  { ok: true; data: QuestionnaireAnswers[K] } | ParseFailed;

export async function parseStep<K extends AnswerStepId>(
  step: K,
  input: unknown,
): Promise<StepParse<K>> {
  const [{ STEP_SCHEMAS }, { parseInput }] = await Promise.all([
    import("./schema"),
    import("@/lib/validation"),
  ]);
  return parseInput(STEP_SCHEMAS[step], input) as StepParse<K>;
}

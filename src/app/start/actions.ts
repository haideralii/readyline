"use server";
/**
 * The one server action of the questionnaire (REQ-003 Q3, accepted): takes the
 * full answer set, re-validates it against the dataset's known classes and
 * returns the derived result. Nothing is stored (SR-3, SR-4) and the free-text
 * services note never reaches derivation (the adapter drops it).
 */
import { deriveChecklist } from "@/lib/checklist/derive";
import { parseInput, type ParseFailed } from "@/lib/validation";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  buildResult,
  type QuestionnaireResult,
} from "@/lib/questionnaire/result";
import { answersSchemaFor } from "@/lib/questionnaire/schema";

export type DeriveResultResponse =
  | {
      ok: true;
      result: QuestionnaireResult;
      /** How many readiness checklist items the result yields (REQ-006 FR-5 teaser). */
      checklistTotal: number;
    }
  | {
      ok: false;
      kind: "validation";
      fieldErrors: ParseFailed["fieldErrors"];
      formErrors: string[];
    }
  | { ok: false; kind: "derivation"; message: string };

export async function deriveResult(
  input: unknown,
): Promise<DeriveResultResponse> {
  const dataset = getStandardsDataset();
  const schema = answersSchemaFor(
    new Set(dataset.registrationGroups.map((g) => g.code)),
  );
  const parsed = parseInput(schema, input);
  if (!parsed.ok) {
    return {
      ok: false,
      kind: "validation",
      fieldErrors: parsed.fieldErrors,
      formErrors: parsed.formErrors,
    };
  }
  const outcome = buildResult(dataset, parsed.data);
  if (!outcome.ok)
    return { ok: false, kind: "derivation", message: outcome.message };
  return {
    ok: true,
    result: outcome.result,
    checklistTotal: deriveChecklist(outcome.result, parsed.data, dataset).total,
  };
}

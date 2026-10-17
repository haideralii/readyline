/**
 * REQ-028 FR-3 (AC-3; audit 9, 10, 12, 13, 14; QA F8): a field's error, its
 * summary entry and `aria-invalid` clear when the field validates on
 * change, before the next submit. The step forms keep one errors object;
 * on a change to a field that carries an error the step's schema runs
 * again over the current values and that field's entry alone follows the
 * result. Pure where it can be; the schema import is the one await.
 */
import type { AnswerStepId } from "@/lib/questionnaire/steps";
import { parseStep } from "@/lib/questionnaire/validate-step";
import type { FieldErrors } from "./fields";

/** The errors object with `name` set to the field's fresh messages, or without `name` when it passes; other keys untouched. */
export function clearFieldError(
  errors: FieldErrors,
  name: string,
  fresh: Readonly<Record<string, string[] | undefined>>,
): FieldErrors {
  const next = { ...errors };
  const messages = fresh[name];
  if (messages && messages.length) next[name] = messages;
  else delete next[name];
  return next;
}

/**
 * Re-validates one field from the step's current values. Returns the same
 * object when the field carries no error (nothing to clear), so a form
 * can call it on every change.
 */
export async function revalidateField<K extends AnswerStepId>(
  step: K,
  values: unknown,
  name: string,
  errors: FieldErrors,
): Promise<FieldErrors> {
  if (!errors[name]) return errors;
  const parsed = await parseStep(step, values);
  const fresh = parsed.ok ? {} : parsed.fieldErrors;
  return clearFieldError(errors, name, fresh);
}

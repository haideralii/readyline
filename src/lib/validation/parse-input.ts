/**
 * Input validation at every boundary (REQ-002 FR-3; threat model "Input and
 * output"). Route handlers and server actions call `parseInput` with a schema
 * built from `strictObject`, so unknown keys are rejected and the caller gets
 * field-level errors it can render. Never throw raw zod errors to the client.
 *
 * Convention (checked by src/lib/validation/handlers.test.ts):
 *   - every `src/app/**\/route.ts` and every file containing "use server"
 *     imports from "@/lib/validation"
 *   - schemas live in src/lib/validation/schemas/*.ts and use `strictObject`
 *   - free text is capped with `text(max)` and trimmed
 */
import { z } from "zod";

/** An object schema that rejects unknown keys. Use this, not z.object, at boundaries. */
export const strictObject = z.strictObject;

/** Trimmed free text with a hard length cap; control characters are rejected. */
export function text(max: number, min = 0) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s), {
      message: "Control characters are not allowed",
    });
}

export type ParseOk<T> = { ok: true; data: T };
export type ParseFailed = {
  ok: false;
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
};
export type ParseResult<T> = ParseOk<T> | ParseFailed;

export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): ParseResult<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join(".");
    const message =
      issue.code === "unrecognized_keys" ? "Unexpected field" : issue.message;
    if (path) (fieldErrors[path] ??= []).push(message);
    else formErrors.push(message);
  }
  return { ok: false, fieldErrors, formErrors };
}

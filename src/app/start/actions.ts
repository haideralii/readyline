"use server";
/**
 * The one server action of the questionnaire (REQ-003 Q3, accepted): takes the
 * full answer set, re-validates it against the dataset's known classes and
 * returns the derived result. Nothing is stored (SR-3, SR-4) and the free-text
 * services note never reaches derivation (the adapter drops it).
 */
import { headers } from "next/headers";
import { deriveChecklist } from "@/lib/checklist/derive";
import { MemoryRateLimiter } from "@/lib/ops/health";
import { parseInput, type ParseFailed } from "@/lib/validation";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  buildResult,
  type QuestionnaireResult,
} from "@/lib/questionnaire/result";
import { answersSchemaFor } from "@/lib/questionnaire/schema";
import { clientIp } from "@/server/auth/paths";

/**
 * Backlog 5 (ASVS L1, REQ-004 SR-3): the one public action is pure compute
 * and stores nothing, so it needs no database limiter, but a loop could
 * still burn a function's time. 120 derivations per address per minute is
 * far above a person stepping back and forth, and above a whole Playwright
 * run from one address; the counter is per instance, like the health
 * route's (D-424).
 */
const DERIVE_LIMIT = { limit: 120, windowMs: 60_000 } as const;
const limiter = new MemoryRateLimiter(
  DERIVE_LIMIT.limit,
  DERIVE_LIMIT.windowMs,
);
const LIMITED_MESSAGE =
  "Too many requests from your connection just now. Wait a minute and try again.";

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
  const address = clientIp(await headers()) ?? "local";
  if (!limiter.allow(address))
    return { ok: false, kind: "derivation", message: LIMITED_MESSAGE };
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

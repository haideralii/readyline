/**
 * The context pack is everything the model is allowed to see for one tailored
 * section (REQ-005 FR-2 step 1, SR-2, SR-3). Its schema is strict and has no
 * field that could carry participant information, register contents or the
 * questionnaire's free text; the builder reads only named answer fields, and
 * the test proves the excluded fields are never even accessed.
 */
import { z } from "zod";
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import type { StandardsDataset } from "@/lib/standards/schema";
import { strictObject } from "@/lib/validation";
import type { DocumentTypeSpec, SectionSpec } from "./catalogue";
import { buildProviderFacts, FACT_KEYS } from "./facts";
import { HOUSE_STYLE_VERSION } from "./house-style";
import { standardsForType } from "./document-model";

export const PROMPT_VERSION = "2026-10-12.1";

const FactsSchema = strictObject({
  tradingName: z.string().min(1).max(120),
  abn: z.string().nullable(),
  structure: z.string().min(1).max(40),
  states: z.array(z.string().min(1).max(40)).min(1).max(8),
  supportTypes: z
    .array(
      strictObject({
        code: z.string().regex(/^\d{4}$/),
        name: z.string().min(1).max(160),
      }),
    )
    .min(1)
    .max(38),
  pathway: z.enum(["verification", "certification"]),
  modules: z.array(z.string().min(1).max(120)).max(9),
  workerCountBand: z.enum(["sole", "2-5", "6-10", "11-25", "26+"]),
  keyPersonnelCount: z.number().int().min(1).max(50),
  hasRiskAssessedRoles: z.boolean(),
  usesRestrictivePractices: z.enum(["yes", "no", "not-sure"]),
});

export const ContextPack = strictObject({
  promptVersion: z.literal(PROMPT_VERSION),
  houseStyleVersion: z.string().min(1),
  facts: FactsSchema,
  document: strictObject({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.string().min(1),
    purpose: z.string().min(1),
  }),
  section: strictObject({
    id: z.string().min(1),
    heading: z.string().min(1),
    brief: z.string().min(1),
  }),
  standards: z.array(
    strictObject({
      id: z.string().min(1),
      name: z.string().min(1),
      outcome: z.string().min(1),
      indicators: z.array(z.string().min(1)),
    }),
  ),
  registers: z.array(z.string().min(1)),
});
export type ContextPack = z.infer<typeof ContextPack>;

/** The fact keys, exported so tests can prove the pack's vocabulary matches. */
export const CONTEXT_FACT_KEYS = FACT_KEYS;

export function buildContextPack(input: {
  answers: QuestionnaireAnswers;
  result: QuestionnaireResult;
  dataset: StandardsDataset;
  type: DocumentTypeSpec;
  section: SectionSpec;
}): ContextPack {
  const { answers, result, dataset, type, section } = input;
  const facts = buildProviderFacts(answers, result);
  const wantedRegisters = new Set(type.registers);
  const pack = {
    promptVersion: PROMPT_VERSION,
    houseStyleVersion: HOUSE_STYLE_VERSION,
    facts,
    document: {
      id: type.id,
      title: type.title,
      kind: type.kind,
      purpose: type.purpose,
    },
    section: { id: section.id, heading: section.heading, brief: section.brief },
    standards: standardsForType(type, dataset, result).map((s) => ({
      id: s.id,
      name: s.name,
      outcome: s.outcome,
      indicators: s.indicators,
    })),
    registers: result.registers
      .filter((r) => wantedRegisters.has(r.id))
      .map((r) => r.title),
  };
  // Parsing our own object guarantees the strict shape even if a caller passes extras later.
  return ContextPack.parse(pack);
}

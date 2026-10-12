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
import { buildProviderFacts, FACT_KEYS, type ProviderFacts } from "./facts";
import { HOUSE_STYLE_VERSION } from "./house-style";
import {
  outlineFor,
  rulesSectionFor,
  standardsForType,
} from "./document-model";
import { reviewCyclesFor } from "./catalogue";

/** .2 (batch 15, D-531): the user prompt carries the document outline (R-9). .3 (batch 16, D-046): document block first, section block last, for caching. */
export const PROMPT_VERSION = "2026-10-12.3";

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
  /** The document's numbered outline; cross-references must match it (R-9, D-044). */
  outline: z
    .array(
      strictObject({
        number: z.string().min(1),
        id: z.string().min(1),
        heading: z.string().min(1),
      }),
    )
    .min(1),
  /** The fixed section holding the statutory rule for this document, if any (R-7). */
  rulesSection: strictObject({
    id: z.string().min(1),
    number: z.string(),
    heading: z.string().min(1),
  }).optional(),
  /** Review cycles are provider facts the model must use, never choose (R-8, D-042). */
  reviewCycles: strictObject({
    policyMonths: z.number().int().positive(),
    registerMonths: z.number().int().positive(),
  }),
});

/** Fills the [review cycles] marker a brief may carry with the document's fixed cycles. */
export function briefWithCycles(
  brief: string,
  cycles: { policyMonths: number; registerMonths: number },
): string {
  return brief.replace(
    "[review cycles]",
    `policy review every ${cycles.policyMonths} months; register review every ${cycles.registerMonths} months`,
  );
}
export type ContextPack = z.infer<typeof ContextPack>;

/** The fact keys, exported so tests can prove the pack's vocabulary matches. */
export const CONTEXT_FACT_KEYS = FACT_KEYS;

/** Same pack from already-built facts (regeneration of a stored version). */
export function buildContextPackFromFacts(input: {
  facts: ProviderFacts;
  result: QuestionnaireResult;
  dataset: StandardsDataset;
  type: DocumentTypeSpec;
  section: SectionSpec;
}): ContextPack {
  const { facts, result, dataset, type, section } = input;
  const wantedRegisters = new Set(type.registers);
  return ContextPack.parse({
    promptVersion: PROMPT_VERSION,
    houseStyleVersion: HOUSE_STYLE_VERSION,
    facts,
    document: {
      id: type.id,
      title: type.title,
      kind: type.kind,
      purpose: type.purpose,
    },
    section: {
      id: section.id,
      heading: section.heading,
      brief: briefWithCycles(section.brief, reviewCyclesFor(type)),
    },
    standards: standardsForType(type, dataset, result).map((s) => ({
      id: s.id,
      name: s.name,
      outcome: s.outcome,
      indicators: s.indicators,
    })),
    registers: result.registers
      .filter((r) => wantedRegisters.has(r.id))
      .map((r) => r.title),
    outline: outlineFor(type),
    ...(rulesSectionFor(type) ? { rulesSection: rulesSectionFor(type)! } : {}),
    reviewCycles: reviewCyclesFor(type),
  });
}

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
    section: {
      id: section.id,
      heading: section.heading,
      brief: briefWithCycles(section.brief, reviewCyclesFor(type)),
    },
    standards: standardsForType(type, dataset, result).map((s) => ({
      id: s.id,
      name: s.name,
      outcome: s.outcome,
      indicators: s.indicators,
    })),
    registers: result.registers
      .filter((r) => wantedRegisters.has(r.id))
      .map((r) => r.title),
    outline: outlineFor(type),
    ...(rulesSectionFor(type) ? { rulesSection: rulesSectionFor(type)! } : {}),
    reviewCycles: reviewCyclesFor(type),
  };
  // Parsing our own object guarantees the strict shape even if a caller passes extras later.
  return ContextPack.parse(pack);
}

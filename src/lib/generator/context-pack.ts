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
import { readabilityGateFor, reviewCyclesFor } from "./catalogue";
import { STATE_FACT_SECTIONS, stateFactsFor } from "./state-facts";

/**
 * .2 (batch 15, D-531): the user prompt carries the document outline (R-9).
 * .3 (batch 16, D-046): document block first, section block last, for caching.
 * 2026-10-13.1 (batch 33, D-542): the house style's blank rule (S-8) and its
 * fixed-text paragraph (D-058); fixtures re-keyed, replies unchanged.
 * 2026-10-14.1 (batch 35, D-1801, D-1802): the STATE FACTS block in the
 * section prompt of the state-tailored sections, and per-document brief
 * additions; fixtures re-keyed, the affected sections' replies predate the
 * change and are listed for the next recording session.
 * 2026-10-14.2 (batch 40, D-544): house style version 2 in the system
 * prompt, the audit test sentence on every tailored brief, and the new
 * section briefs; fixtures re-keyed under the new prompts, replies
 * unchanged and listed for recording.
 */
export const PROMPT_VERSION = "2026-10-14.2";

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
    /** The obligation the document rests on when the case cites none of its standards (D-045, R-12); null otherwise. */
    basisReason: z.string().min(1).nullable(),
  }),
  /** The readability gate for this document's tailored sections (D-047); not part of the prompt. */
  readabilityGate: strictObject({
    failAbove: z.number().positive(),
    shortSectionWords: z.number().int().positive(),
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
  /**
   * State and territory facts for the provider's states, from
   * data/state-reference.json only (A1, D-1801); present for the
   * state-tailored sections and rendered as the STATE FACTS block.
   */
  stateFacts: z
    .array(
      strictObject({
        code: z.string().min(2).max(3),
        name: z.string().min(1),
        lines: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
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

/**
 * R-12 / D-050: when the case cites none of the document's standards, the
 * purpose and policy-statement briefs name the obligation the document rests
 * on instead of a standard, so the model never asks the provider for one.
 */
/**
 * House style version 2 (batch 40, D-544): every tailored brief ends with
 * the audit test, so the model writes steps that leave records behind.
 */
export const AUDIT_TEST_SENTENCE =
  "Audit test: if a worker followed this exactly, the records named below would exist.";

export function briefFor(
  section: SectionSpec,
  type: DocumentTypeSpec,
  standardsCount: number,
  cycles: { policyMonths: number; registerMonths: number },
  options: { auditTest?: boolean } = {},
): string {
  const noStandard = standardsCount === 0 && type.basis !== "practice-standard";
  const reason = type.basisReason ?? "";
  let brief = section.brief;
  if (noStandard && section.id === "purpose")
    brief = `Two short sentences, each under 15 words: what this document is for, and which obligation it supports: ${reason}; nothing else. Never name or ask for a Practice Standard.`;
  if (noStandard && section.id === "policy-statement")
    brief = `The commitments, in the provider's voice, each resting on the obligation this document is kept for: ${reason}. If you use a table, its columns are "Our commitment" and "What we do"; never add a quality-indicator column and never ask the provider to name a standard or indicator.`;
  // Batch 35 (D-1802): a document-specific sentence on a shared outline brief.
  const addition = type.briefAdditions?.[section.id];
  if (addition) brief = `${brief} ${addition}`;
  // Batch 40 (D-544): the audit test closes every tailored brief; the re-key tool turns it off to rebuild a previous brief.
  if (options.auditTest !== false && section.mode === "tailored")
    brief = `${brief} ${AUDIT_TEST_SENTENCE}`;
  return briefWithCycles(brief, cycles);
}

function basisReasonFor(
  type: DocumentTypeSpec,
  standardsCount: number,
): string | null {
  return standardsCount === 0 && type.basis !== "practice-standard"
    ? (type.basisReason ?? null)
    : null;
}
export type ContextPack = z.infer<typeof ContextPack>;

/** The fact keys, exported so tests can prove the pack's vocabulary matches. */
export const CONTEXT_FACT_KEYS = FACT_KEYS;

/** The pack for one section, from facts already built (shared by both builders). */
function assemble(input: {
  facts: ProviderFacts;
  result: QuestionnaireResult;
  dataset: StandardsDataset;
  type: DocumentTypeSpec;
  section: SectionSpec;
}): ContextPack {
  const { facts, result, dataset, type, section } = input;
  const wantedRegisters = new Set(type.registers);
  const standards = standardsForType(type, dataset, result);
  const cycles = reviewCyclesFor(type);
  const pack = {
    promptVersion: PROMPT_VERSION,
    houseStyleVersion: HOUSE_STYLE_VERSION,
    facts,
    document: {
      id: type.id,
      title: type.title,
      kind: type.kind,
      purpose: type.purpose,
      basisReason: basisReasonFor(type, standards.length),
    },
    // REQ-016 S-4: a section may carry its own gate (the plain-language summary fails above Year 6).
    readabilityGate: readabilityGateFor(type, section),
    section: {
      id: section.id,
      heading: section.heading,
      brief: briefFor(section, type, standards.length, cycles),
    },
    standards: standards.map((s) => ({
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
    reviewCycles: cycles,
    // A1 (D-1801): the state-tailored sections see the reference facts for the provider's states and nothing else.
    ...(STATE_FACT_SECTIONS.has(section.id)
      ? { stateFacts: stateFactsFor(facts.states) }
      : {}),
  };
  // Parsing our own object guarantees the strict shape even if a caller passes extras later.
  return ContextPack.parse(pack);
}

/** Same pack from already-built facts (regeneration of a stored version). */
export function buildContextPackFromFacts(input: {
  facts: ProviderFacts;
  result: QuestionnaireResult;
  dataset: StandardsDataset;
  type: DocumentTypeSpec;
  section: SectionSpec;
}): ContextPack {
  return assemble(input);
}

export function buildContextPack(input: {
  answers: QuestionnaireAnswers;
  result: QuestionnaireResult;
  dataset: StandardsDataset;
  type: DocumentTypeSpec;
  section: SectionSpec;
}): ContextPack {
  const { answers, result, dataset, type, section } = input;
  return assemble({
    facts: buildProviderFacts(answers, result),
    result,
    dataset,
    type,
    section,
  });
}

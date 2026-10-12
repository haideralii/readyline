/**
 * The document model (REQ-005 D-501): a document type resolved to numbered
 * sections, each holding validated blocks. `buildSkeleton` resolves every
 * fixed section from the fixed text and marks every tailored section as a
 * placeholder; Session B fills placeholders from the model's validated
 * output. The model is what snapshot tests compare and what the renderer
 * consumes, so prompts and outlines change here first and visibly.
 */
import type { StandardsDataset } from "@/lib/standards/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import { BRAND } from "@/lib/brand";
import {
  reviewCycleMonths,
  sectionsFor,
  type DocumentTypeSpec,
  type SectionSpec,
} from "./catalogue";
import type { ProviderFacts } from "./facts";
import {
  fixedBlocks,
  placeholderBlocks,
  type FixedContext,
} from "./fixed-text";
import type { Block } from "./section-schema";

export type SectionStatus = "fixed" | "placeholder" | "generated" | "fallback";

export type ResolvedSection = {
  id: string;
  /** "1", "2", ... or "" for front and back matter. */
  number: string;
  heading: string;
  mode: SectionSpec["mode"];
  status: SectionStatus;
  blocks: Block[];
  usedFacts?: string[];
};

export type DocumentModel = {
  typeId: string;
  title: string;
  kind: DocumentTypeSpec["kind"];
  version: string;
  generatedAt: string;
  reviewDueAt: string;
  facts: ProviderFacts;
  sections: ResolvedSection[];
  footer: string;
};

export type StandardSummary = {
  id: string;
  name: string;
  outcome: string;
  indicators: string[];
  evidence: { kind: string; title: string }[];
};

const UNNUMBERED = new Set(["document-control", "notice"]);

/** Section numbers as the rendered document shows them (front and back matter unnumbered). */
export function sectionNumbers(type: DocumentTypeSpec): Map<string, string> {
  const map = new Map<string, string>();
  let n = 0;
  for (const spec of sectionsFor(type))
    map.set(spec.id, UNNUMBERED.has(spec.id) ? "" : String(++n));
  return map;
}

export type OutlineEntry = { number: string; id: string; heading: string };

/** The document's numbered outline as rendered, fixed and tailored sections alike (R-9, D-044). */
export function outlineFor(type: DocumentTypeSpec): OutlineEntry[] {
  const numbers = sectionNumbers(type);
  return sectionsFor(type)
    .map((spec) => ({
      number: numbers.get(spec.id) ?? "",
      id: spec.id,
      heading: spec.heading,
    }))
    .filter((entry) => entry.number !== "");
}

/** Fixed sections that carry a statutory rule tailored text must refer to rather than restate (R-7). */
const RULE_SECTION_IDS = ["reportable-incidents"];

export function rulesSectionFor(
  type: DocumentTypeSpec,
): { id: string; number: string; heading: string } | null {
  const numbers = sectionNumbers(type);
  for (const spec of sectionsFor(type)) {
    if (spec.mode === "fixed" && RULE_SECTION_IDS.includes(spec.id))
      return {
        id: spec.id,
        number: numbers.get(spec.id) ?? "",
        heading: spec.heading,
      };
  }
  return null;
}

export function standardsForType(
  type: DocumentTypeSpec,
  dataset: StandardsDataset,
  result: QuestionnaireResult,
): StandardSummary[] {
  // R-10 / D-044: a document only cites standards from the modules the case is
  // audited against; a verification provider never sees core-module indicators.
  const applicable = new Set(
    result.modules.flatMap((m) => m.standards.map((s) => s.id)),
  );
  const ids =
    type.standardsSelection === "all-applicable"
      ? [...applicable]
      : type.standards.filter((id) => applicable.has(id));
  const wanted = new Set(ids);
  return dataset.standards
    .filter((s) => wanted.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      outcome: s.outcome,
      indicators: s.indicators,
      evidence: s.evidence.map((e) => ({ kind: e.kind, title: e.title })),
    }));
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function buildSkeleton(input: {
  type: DocumentTypeSpec;
  facts: ProviderFacts;
  dataset: StandardsDataset;
  result: QuestionnaireResult;
  version: string;
  /** ISO date, e.g. "2026-10-12". */
  generatedAt: string;
}): DocumentModel {
  const { type, facts, dataset, result } = input;
  const reviewDueAt = addMonths(input.generatedAt, reviewCycleMonths(type));
  const ctx: FixedContext = {
    type,
    facts,
    standards: standardsForType(type, dataset, result),
    documents: result.documents.map((d) => ({ id: d.id, title: d.title })),
    registers: result.registers.map((r) => ({ id: r.id, title: r.title })),
    version: input.version,
    generatedAt: input.generatedAt,
    reviewDueAt,
  };
  let n = 0;
  const sections: ResolvedSection[] = sectionsFor(type).map((spec) => {
    const number = UNNUMBERED.has(spec.id) ? "" : String(++n);
    if (spec.mode === "fixed") {
      return {
        id: spec.id,
        number,
        heading: spec.heading,
        mode: "fixed",
        status: "fixed",
        blocks: fixedBlocks(spec, ctx),
      };
    }
    return {
      id: spec.id,
      number,
      heading: spec.heading,
      mode: "tailored",
      status: "placeholder",
      blocks: placeholderBlocks(spec),
    };
  });
  return {
    typeId: type.id,
    title: type.title,
    kind: type.kind,
    version: input.version,
    generatedAt: input.generatedAt,
    reviewDueAt,
    facts,
    sections,
    footer: `Prepared with ${BRAND}`,
  };
}

/** Compact shape for structure snapshots: ids, numbering, modes and block types only. */
export function modelStructure(model: DocumentModel) {
  return {
    typeId: model.typeId,
    title: model.title,
    kind: model.kind,
    sections: model.sections.map((s) => ({
      id: s.id,
      number: s.number,
      heading: s.heading,
      mode: s.mode,
      status: s.status,
      blocks: s.blocks.map((b) => b.type),
    })),
  };
}

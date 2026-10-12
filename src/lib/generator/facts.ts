/**
 * The provider facts a document may use (REQ-005 FR-2 step 1, SR-3). This is
 * the whole vocabulary: the context pack has no field that could hold
 * participant information, register contents or the questionnaire's free
 * text. `FACT_KEYS` doubles as the allowed values of `usedFacts`.
 */
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";

export const FACT_KEYS = [
  "tradingName",
  "abn",
  "structure",
  "states",
  "supportTypes",
  "pathway",
  "modules",
  "workerCountBand",
  "keyPersonnelCount",
  "hasRiskAssessedRoles",
  "usesRestrictivePractices",
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

export type WorkerCountBand = "sole" | "2-5" | "6-10" | "11-25" | "26+";

export type ProviderFacts = {
  tradingName: string;
  /** Formatted "51 824 753 556" or null when not given. */
  abn: string | null;
  /** Plain-English structure, e.g. "sole trader", "company". */
  structure: string;
  /** Full state and territory names in the order answered. */
  states: string[];
  /** Registration classes in scope: code and Commission name. */
  supportTypes: { code: string; name: string }[];
  pathway: "verification" | "certification";
  /** Practice Standards module names in scope. */
  modules: string[];
  workerCountBand: WorkerCountBand;
  keyPersonnelCount: number;
  hasRiskAssessedRoles: boolean;
  usesRestrictivePractices: "yes" | "no" | "not-sure";
};

export const STRUCTURE_LABELS: Record<
  QuestionnaireAnswers["business"]["structure"],
  string
> = {
  "sole-trader": "sole trader",
  partnership: "partnership",
  company: "company",
  "incorporated-association": "incorporated association",
  trust: "trust",
  other: "business",
};

export const STATE_NAMES: Record<string, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};

export function workerCountBand(count: number): WorkerCountBand {
  if (count <= 1) return "sole";
  if (count <= 5) return "2-5";
  if (count <= 10) return "6-10";
  if (count <= 25) return "11-25";
  return "26+";
}

export function formatAbn(abn: string | undefined | null): string | null {
  if (!abn) return null;
  const digits = abn.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

/**
 * Builds the facts from validated answers and the derived result. Only the
 * named fields are read; `supports.servicesNote` and the "existing" step are
 * never touched (SR-3), which the context-pack test proves.
 */
export function buildProviderFacts(
  answers: QuestionnaireAnswers,
  result: QuestionnaireResult,
): ProviderFacts {
  return {
    tradingName: answers.business.tradingName,
    abn: formatAbn(answers.business.abn),
    structure: STRUCTURE_LABELS[answers.business.structure],
    states: answers.business.states.map((s) => STATE_NAMES[s] ?? s),
    supportTypes: result.groups.map((g) => ({ code: g.code, name: g.name })),
    pathway: result.pathway,
    modules: result.modules.map((m) => m.name),
    workerCountBand: workerCountBand(answers.workforce.workerCount),
    keyPersonnelCount: answers.workforce.keyPersonnelCount,
    hasRiskAssessedRoles: answers.workforce.hasRiskAssessedRoles,
    usesRestrictivePractices: answers.practices.restrictivePractices,
  };
}

/** Sentence fragments reused by fixed text and prompts. */
export function describeProvider(f: ProviderFacts): string {
  const states =
    f.states.length === 1
      ? f.states[0]
      : `${f.states.slice(0, -1).join(", ")} and ${f.states[f.states.length - 1]}`;
  return `${f.tradingName}, a ${f.structure} delivering supports in ${states}`;
}

export function describeWorkforce(f: ProviderFacts): string {
  switch (f.workerCountBand) {
    case "sole":
      return "The provider is a sole worker with no other workers.";
    case "2-5":
      return "The provider has a small team of up to five workers.";
    case "6-10":
      return "The provider has a team of six to ten workers.";
    case "11-25":
      return "The provider has a team of eleven to twenty-five workers.";
    default:
      return "The provider has more than twenty-five workers.";
  }
}

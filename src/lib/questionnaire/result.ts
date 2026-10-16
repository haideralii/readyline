/**
 * Builds the questionnaire result from validated answers (REQ-003 FR-2, FR-7).
 * Pure: dataset in, result out. The server action is a thin wrapper.
 */
import { GENERAL_INFORMATION_NOTICE } from "@/lib/brand";
import {
  DerivationError,
  applicableStandards,
  deriveApplicability,
  type Applicability,
  type AuditPathway,
} from "@/lib/standards/derive";
import type { StandardsDataset } from "@/lib/standards/schema";
import { toDeriveInput } from "./adapter";
import { auditTypeDescription, moduleDescription } from "./content";
import { deriveDocumentSet, type DocumentSet } from "./document-set";
import {
  LARGE_PROVIDER_THRESHOLD,
  SIL_CODE,
  type QuestionnaireAnswers,
} from "./schema";

export type ResultReason = {
  rule: string;
  effect: Applicability["reasons"][number]["effect"];
  text: string;
  unverified: boolean;
  source: { id: string; title: string; url: string };
};

export type ResultModule = {
  id: string;
  name: string;
  description: string;
  standardCount: number;
  standards: { id: string; name: string }[];
};

export type QuestionnaireResult = {
  pathway: AuditPathway;
  pathwayDescription: string;
  modifiedCertification: boolean;
  groups: { code: string; name: string; auditType: AuditPathway }[];
  modules: ResultModule[];
  midTermAudit: Applicability["midTermAudit"];
  reasons: ResultReason[];
  documents: DocumentSet["documents"];
  registers: DocumentSet["registers"];
  flags: {
    restrictivePracticesAssumed: boolean;
    largeProvider: boolean;
    silExcluded: boolean;
    hasUnverified: boolean;
    /** REQ-027 D-2716, D-2726: a sole trader whatever the worker count; optional, since results stored before A2 lack it, read with `=== true`. */
    soleTrader?: boolean;
  };
  notice: string;
};

export type BuildResultOutcome =
  | { ok: true; result: QuestionnaireResult }
  | { ok: false; code: DerivationError["code"]; message: string };

export function buildResult(
  dataset: StandardsDataset,
  answers: QuestionnaireAnswers,
): BuildResultOutcome {
  const { input, flags } = toDeriveInput(answers);
  let applicability: Applicability;
  try {
    applicability = deriveApplicability(dataset, input);
  } catch (e) {
    if (e instanceof DerivationError)
      return { ok: false, code: e.code, message: e.message };
    throw e;
  }

  const sources = new Map(dataset.sources.map((s) => [s.id, s]));
  const standards = applicableStandards(dataset, applicability);
  const groupsByCode = new Map(
    dataset.registrationGroups.map((g) => [g.code, g]),
  );

  const modules: ResultModule[] = applicability.modules.map((id) => {
    const m = dataset.modules.find((x) => x.id === id)!;
    const list = standards
      .filter((s) => s.moduleId === id)
      .map((s) => ({ id: s.id, name: s.name }));
    return {
      id,
      name: m.name,
      description: moduleDescription(id) ?? "",
      standardCount: list.length,
      standards: list,
    };
  });

  const reasons: ResultReason[] = applicability.reasons.map((r) => {
    const s = sources.get(r.sourceId)!;
    return {
      rule: r.rule,
      effect: r.effect,
      text: r.text,
      unverified: Boolean(r.unverified),
      source: { id: s.id, title: s.title, url: s.url },
    };
  });

  const docs = deriveDocumentSet(
    applicability.modules,
    applicability.groups,
    answers.existing,
  );

  return {
    ok: true,
    result: {
      pathway: applicability.pathway,
      pathwayDescription: auditTypeDescription(applicability.pathway),
      modifiedCertification: applicability.modifiedCertification,
      groups: applicability.groups.map((code) => {
        const g = groupsByCode.get(code)!;
        return { code, name: g.name, auditType: g.auditType };
      }),
      modules,
      midTermAudit: applicability.midTermAudit,
      reasons,
      documents: docs.documents,
      registers: docs.registers,
      flags: {
        restrictivePracticesAssumed: flags.restrictivePracticesAssumed,
        largeProvider: answers.workforce.workerCount > LARGE_PROVIDER_THRESHOLD,
        soleTrader: answers.business.structure === "sole-trader",
        silExcluded:
          answers.supports.groups.includes(SIL_CODE) &&
          !applicability.groups.includes(SIL_CODE),
        hasUnverified: reasons.some((r) => r.unverified),
      },
      notice: GENERAL_INFORMATION_NOTICE,
    },
  };
}

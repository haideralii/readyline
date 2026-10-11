/**
 * Derives which Practice Standards modules and which audit pathway apply to a
 * provider from its registration groups and a few questionnaire answers
 * (REQ-001 FR-3, as extended by the PO's reviews).
 *
 * Every decision is explained in `reasons[]` with the rule that fired and the
 * Commission source it rests on, so the questionnaire can show its working.
 * The function is pure: same dataset and input, same output.
 *
 * Imports use explicit `.ts` extensions so the module also runs under Node's
 * built-in type stripping (see scripts/standards/report.ts).
 */
import type { RegistrationGroup, StandardsDataset } from "./schema.ts";

export type BusinessStructure =
  | "sole-trader"
  | "partnership"
  | "company"
  | "incorporated-association"
  | "trust"
  | "other";

/**
 * Answers to the Commission's two "it is not supported independent living if"
 * questions. Either `true` means class 0138 does not apply.
 */
export type SilEligibility = {
  /** The participant only receives a few hours of support a day or week. */
  fewHoursOnly: boolean;
  /** The participant chooses and manages their own support workers (directing, planning, rostering). */
  participantManagesOwnWorkers: boolean;
};

export type DeriveInput = {
  /** Four-digit registration class codes, e.g. ["0107", "0120"]. */
  groups: string[];
  businessStructure: BusinessStructure;
  /** Whether the provider uses, or plans to use, regulated restrictive practices in any support. */
  usesRestrictivePractices: boolean;
  /** Required when 0138 is among the groups; ignored otherwise. */
  silEligibility?: SilEligibility;
};

export type AuditPathway = "verification" | "certification";

export type ReasonEffect =
  | "pathway"
  | "add-module"
  | "remove-module"
  | "remove-group"
  | "limit-core"
  | "mid-term"
  | "info";

export type Reason = {
  /** Stable rule id, e.g. "mixed-audit". */
  rule: string;
  effect: ReasonEffect;
  /** Module id, group code or standard id the reason is about, if any. */
  target?: string;
  /** Id of the source in the dataset that the rule rests on. */
  sourceId: string;
  /** Plain-English explanation suitable for showing to the provider. */
  text: string;
  /** True when the Commission's material does not settle the point. */
  unverified?: boolean;
};

export type MidTermAudit = {
  applies: boolean;
  exemptReason?: string;
  monthsAfterRegistration: number;
  prepareFromMonth: number;
  /** Core-module division ids assessed at mid-term. */
  assessedDivisionIds: string[];
  sourceId: string;
};

export type Applicability = {
  /** Groups after exclusions (for example 0138 removed when the SIL definition is not met). */
  groups: string[];
  pathway: AuditPathway;
  /** True when the pathway is the "modified certification" for individuals or partnerships delivering only early childhood supports. */
  modifiedCertification: boolean;
  /** Module ids in dataset order. */
  modules: string[];
  /** When the core module is limited to named standards (modified certification); null means the whole module. */
  coreStandardIds: string[] | null;
  midTermAudit: MidTermAudit;
  reasons: Reason[];
};

export type DerivationErrorCode =
  "unknown-group" | "no-groups" | "sil-eligibility-missing";

export class DerivationError extends Error {
  readonly code: DerivationErrorCode;

  constructor(code: DerivationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DerivationError";
  }
}

const label = (g: RegistrationGroup) => `${g.code} ${g.name}`;

export function deriveApplicability(
  dataset: StandardsDataset,
  input: DeriveInput,
): Applicability {
  const byCode = new Map(dataset.registrationGroups.map((g) => [g.code, g]));
  const reasons: Reason[] = [];
  const r = dataset.rules;

  const requested = [...new Set(input.groups.map((c) => c.trim()))];
  if (requested.length === 0) {
    throw new DerivationError(
      "no-groups",
      "At least one registration group is required.",
    );
  }
  for (const code of requested) {
    if (!byCode.has(code)) {
      throw new DerivationError(
        "unknown-group",
        `Unknown registration group "${code}".`,
      );
    }
  }

  // 1. SIL definition: class 0138 only applies when neither exclusion is true.
  let groups = requested.map((c) => byCode.get(c)!);
  const silGroup = groups.find((g) => g.moduleIds.includes("sil"));
  if (silGroup) {
    const e = input.silEligibility;
    if (!e) {
      throw new DerivationError(
        "sil-eligibility-missing",
        `Group ${silGroup.code} requires answers to the SIL eligibility questions.`,
      );
    }
    if (e.fewHoursOnly || e.participantManagesOwnWorkers) {
      groups = groups.filter((g) => g !== silGroup);
      reasons.push({
        rule: "sil-definition",
        effect: "remove-group",
        target: silGroup.code,
        sourceId: r.silDefinition.sourceId,
        text: e.fewHoursOnly
          ? "The Commission says it is not supported independent living when a person only receives a few hours of support a day or week, so class 0138 was left out."
          : "The Commission says it is not supported independent living when a person chooses and manages their own support workers, so class 0138 was left out.",
      });
      if (groups.length === 0) {
        throw new DerivationError(
          "no-groups",
          "Class 0138 was excluded by the SIL definition and no other group was selected.",
        );
      }
    } else {
      reasons.push({
        rule: "sil-definition",
        effect: "info",
        target: silGroup.code,
        sourceId: r.silDefinition.sourceId,
        text: "Neither SIL exclusion applies, so class 0138 (assistance with supported independent living) stays in scope. Registration for it has been mandatory since 1 July 2026.",
      });
    }
  }

  // 2. Pathway.
  const certificationGroups = groups.filter(
    (g) => g.auditType === "certification",
  );
  const verificationGroups = groups.filter(
    (g) => g.auditType === "verification",
  );
  const pathway: AuditPathway =
    certificationGroups.length > 0 ? "certification" : "verification";
  if (pathway === "verification") {
    reasons.push({
      rule: "verification-pathway",
      effect: "pathway",
      target: "verification",
      sourceId: r.mixedAuditSourceId,
      text: `Every selected group (${groups.map(label).join("; ")}) is a lower-risk class that needs a verification audit.`,
    });
  } else if (verificationGroups.length > 0) {
    reasons.push({
      rule: "mixed-audit",
      effect: "pathway",
      target: "certification",
      sourceId: r.mixedAuditSourceId,
      text: `The selection mixes verification and certification classes; the Commission's rule is that the whole registration then needs a certification audit (certification classes: ${certificationGroups.map(label).join("; ")}).`,
    });
  } else {
    reasons.push({
      rule: "certification-pathway",
      effect: "pathway",
      target: "certification",
      sourceId: r.mixedAuditSourceId,
      text: `Every selected group (${groups.map(label).join("; ")}) is a higher-risk class that needs a certification audit.`,
    });
  }

  // 3. Modules.
  const modules = new Set<string>();
  let coreStandardIds: string[] | null = null;
  let modifiedCertification = false;

  if (pathway === "verification") {
    modules.add("verification");
    reasons.push({
      rule: "verification-module",
      effect: "add-module",
      target: "verification",
      sourceId: r.restrictivePracticesSourceId,
      text: "Verification-audit classes are assessed against the verification module only (human resource management, incident management, complaints management, risk management).",
    });
  } else {
    const mc = r.modifiedCertification;
    const ecGroup = groups.find((g) => g.code === mc.groupCode);
    const onlyEcIsCertification =
      Boolean(ecGroup) &&
      certificationGroups.every((g) => g.code === mc.groupCode);
    const structureQualifies = (mc.businessStructures as string[]).includes(
      input.businessStructure,
    );

    if (ecGroup && onlyEcIsCertification && structureQualifies) {
      modifiedCertification = true;
      modules.add("core");
      coreStandardIds = [...mc.coreStandardIds];
      for (const id of ecGroup.moduleIds) modules.add(id);
      reasons.push({
        rule: "modified-certification",
        effect: "limit-core",
        target: "core",
        sourceId: mc.sourceId,
        text: `An individual or partnership whose only certification class is ${label(ecGroup)} is assessed under modified certification: the core module is limited to the freedom from violence, abuse, neglect, exploitation or discrimination outcome, plus the early childhood supports module.${verificationGroups.length > 0 ? ' The Commission\'s mapping document lists this case as early childhood "and any other verification registration"; whether a verification class alongside early childhood keeps the modified scope is not stated, so treat this as unconfirmed and check the scope of audit with the Commission or your auditor.' : ""}`,
        ...(verificationGroups.length > 0 ? { unverified: true } : {}),
      });
      for (const id of ecGroup.moduleIds) {
        reasons.push({
          rule: "group-module",
          effect: "add-module",
          target: id,
          sourceId: mc.sourceId,
          text: `${label(ecGroup)} brings in the ${moduleName(dataset, id)}.`,
        });
      }
    } else {
      const soleAndExempt =
        groups.length === 1 && r.coreExemptWhenSole.includes(groups[0].code);
      const needsCore = groups.some((g) => g.requiresCore) && !soleAndExempt;
      if (needsCore) {
        modules.add("core");
        reasons.push({
          rule: "core-module",
          effect: "add-module",
          target: "core",
          sourceId: r.coreExemptWhenSoleSourceId,
          text: "Certification classes are assessed against the core module (rights and responsibilities; provider governance and operational management; provision of supports; provision of supports environments).",
        });
      } else if (soleAndExempt) {
        reasons.push({
          rule: "sda-only",
          effect: "remove-module",
          target: "core",
          sourceId: r.coreExemptWhenSoleSourceId,
          text: `${label(groups[0])} on its own is assessed against its supplementary module without the core module. Adding any other class brings the core module in.`,
        });
      }
      for (const g of certificationGroups) {
        for (const id of g.moduleIds) {
          if (!modules.has(id)) {
            modules.add(id);
            reasons.push({
              rule: "group-module",
              effect: "add-module",
              target: id,
              sourceId: moduleSourceFor(g, r.restrictivePracticesSourceId),
              text: `${label(g)} brings in the ${moduleName(dataset, id)}.`,
            });
          }
        }
      }
    }
  }

  // 4. Restrictive practices add the implementing behaviour support plans module regardless of groups.
  if (input.usesRestrictivePractices) {
    const id = r.restrictivePracticesModuleId;
    if (!modules.has(id)) {
      modules.add(id);
      reasons.push({
        rule: "restrictive-practices",
        effect: "add-module",
        target: id,
        sourceId: r.restrictivePracticesSourceId,
        text: `Providers using restrictive practices in the delivery of any NDIS supports must also meet the ${moduleName(dataset, id)}.`,
      });
    }
    if (pathway === "verification") {
      reasons.push({
        rule: "restrictive-practices",
        effect: "info",
        sourceId: r.restrictivePracticesSourceId,
        text: "The Commission requires registration to use regulated restrictive practices. Whether their use changes a verification audit into a certification audit is not stated in the material we hold; confirm the scope of audit with the Commission or your auditor.",
        unverified: true,
      });
    }
  }

  // 5. Mid-term audit (D-106).
  const mt = r.midTermAudit;
  const midTerm: MidTermAudit = {
    applies: false,
    monthsAfterRegistration: mt.monthsAfterRegistration,
    prepareFromMonth: mt.prepareFromMonth,
    assessedDivisionIds: [...mt.assessedDivisionIds],
    sourceId: mt.sourceId,
  };
  if (pathway === "verification") {
    midTerm.exemptReason =
      "Mid-term audits apply to providers that completed a certification audit.";
  } else if (modifiedCertification) {
    midTerm.exemptReason = mt.exemptions[0];
  } else if (
    groups.length === 1 &&
    r.coreExemptWhenSole.includes(groups[0].code)
  ) {
    midTerm.exemptReason = mt.exemptions[1];
  } else {
    midTerm.applies = true;
  }
  reasons.push({
    rule: "mid-term-audit",
    effect: "mid-term",
    sourceId: mt.sourceId,
    text: midTerm.applies
      ? `A mid-term audit against the provider governance and operational management standards falls ${mt.monthsAfterRegistration} months after registration; prepare from month ${mt.prepareFromMonth}. Transitioned providers are exempt.`
      : `No mid-term audit: ${midTerm.exemptReason}`,
  });

  const ordered = dataset.modules
    .map((m) => m.id)
    .filter((id) => modules.has(id));

  return {
    groups: groups.map((g) => g.code),
    pathway,
    modifiedCertification,
    modules: ordered,
    coreStandardIds,
    midTermAudit: midTerm,
    reasons,
  };
}

/** The source that states a group's module mapping: the mapping PDF where it covers the class, else the Commission's transition page for the new classes. */
function moduleSourceFor(
  g: RegistrationGroup,
  mappingSourceId: string,
): string {
  const preferred = [mappingSourceId, "mandatory-sil", "mandatory-digital"];
  return preferred.find((id) => g.sourceIds.includes(id)) ?? g.sourceIds[0];
}

function moduleName(dataset: StandardsDataset, id: string): string {
  return dataset.modules.find((m) => m.id === id)?.name ?? id;
}

/** Standards that apply under a derived result, in dataset order. */
export function applicableStandards(
  dataset: StandardsDataset,
  result: Applicability,
) {
  const limit = result.coreStandardIds ? new Set(result.coreStandardIds) : null;
  return dataset.standards.filter((s) => {
    if (!result.modules.includes(s.moduleId)) return false;
    if (s.moduleId === "core" && limit) return limit.has(s.id);
    return true;
  });
}

/**
 * Schema for data/standards.json (Phase 1).
 *
 * Principles (CLAUDE.md 4.6 and 8):
 * - Outcome and indicator text is copied verbatim from the NDIS Quality and
 *   Safeguards Commission's published Practice Standards. Nothing is
 *   paraphrased from memory.
 * - Every record points at a `sources[]` entry carrying the URL, the
 *   Commission's own version label and the date we fetched it.
 * - Anything we could not confirm from the Commission's site carries
 *   `verification.status = "unverified"` with a note. Tests fail if an
 *   unverified record has no note.
 * - `evidence[]` is OUR guidance about what an auditor typically asks for.
 *   It is never presented as Commission text, and each item cites the
 *   source it was derived from where one exists.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/, "kebab or dotted id");

export const VerificationStatus = z.enum(["verified", "unverified"]);

export const Verification = z
  .object({
    status: VerificationStatus,
    /** Required when status is "unverified": what is missing and where to look. */
    note: z.string().optional(),
    /** Date the record was last checked against the source. */
    checkedAt: isoDate,
  })
  .refine((v) => v.status === "verified" || Boolean(v.note), {
    message: "unverified records must carry a note",
  });

export const Source = z.object({
  id: slug,
  title: z.string().min(1),
  publisher: z.enum([
    "NDIS Quality and Safeguards Commission",
    "Federal Register of Legislation",
  ]),
  url: z.string().url(),
  /** The Commission's own label, e.g. "Version 4, November 2021". Null if the page shows none. */
  versionLabel: z.string().nullable(),
  /** Date the content is stated to be effective from, if any. */
  effectiveFrom: isoDate.nullable(),
  fetchedAt: isoDate,
  /** Repo-relative path to the text snapshot we extracted, for diffing. */
  snapshotPath: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const ModuleKind = z.enum(["core", "supplementary", "verification"]);

export const Division = z.object({
  id: slug,
  name: z.string().min(1),
  sourceId: slug,
});

export const Module = z.object({
  /** Stable id used in registration-group mapping, e.g. "core", "hidpa", "sil". */
  id: slug,
  kind: ModuleKind,
  name: z.string().min(1),
  /** Core module only: the four parts of the core module. */
  divisions: z.array(Division).default([]),
  /** Commission's description of who the module applies to, verbatim. */
  appliesTo: z.string().min(1),
  effectiveFrom: isoDate.nullable(),
  sourceIds: z.array(slug).min(1),
  verification: Verification,
});

export const EvidenceKind = z.enum([
  "policy",
  "procedure",
  "register",
  "record",
  "form",
  "agreement",
  "training",
  "insurance",
  "plan",
  "other",
]);

/** Our guidance on what an auditor typically asks to see for a standard. */
export const EvidenceItem = z.object({
  /** True until the PO has reviewed the item (REQ-001 FR-4). */
  draft: z.boolean().default(true),
  kind: EvidenceKind,
  title: z.string().min(1),
  note: z.string().optional(),
  /** Id of a generated document type (Phase 3) that satisfies this item, if any. */
  documentTypeId: slug.optional(),
  /** Source the expectation is drawn from, if any (e.g. the Commission's "Types of audits" page). */
  sourceId: slug.optional(),
});

export const ExpectationStatements = z.object({
  participant: z.string().min(1),
  worker: z.string().min(1),
  provider: z.string().min(1),
});

export const Standard = z.object({
  /** "<moduleId>.<divisionId?>.<standard-slug>", e.g. "core.rights.person-centred-supports". */
  id: slug,
  moduleId: slug,
  divisionId: slug.optional(),
  name: z.string().min(1),
  /** Verbatim outcome statement. */
  outcome: z.string().min(1),
  /** Verbatim quality indicators, in published order. Sub-points (a), (b) stay inside the indicator. */
  indicators: z.array(z.string().min(1)).min(1),
  /** SIL module only. */
  intent: z.string().optional(),
  expectationStatements: ExpectationStatements.optional(),
  /**
   * Guidance the Commission prints with the standard that is not itself a
   * quality indicator (for example a training restriction). Verbatim.
   */
  note: z.string().optional(),
  sourceId: slug,
  /** Where in the source: page anchor, heading, or "PDF p.12". */
  sourceLocator: z.string().min(1),
  evidence: z.array(EvidenceItem).default([]),
  verification: Verification,
});

export const AuditType = z.enum(["verification", "certification"]);

export const RegistrationGroup = z.object({
  /** Four-digit class code, e.g. "0107". */
  code: z.string().regex(/^\d{4}$/),
  name: z.string().min(1),
  auditType: AuditType,
  /**
   * Modules this group brings in on its own. The core module is added by the
   * derivation rules whenever `requiresCore` is true for any selected group;
   * it is not listed here so SDA-only and modified-certification cases stay
   * expressible.
   */
  moduleIds: z.array(slug),
  requiresCore: z.boolean(),
  /** Mandatory-registration commencement for this class, if one applies. */
  mandatoryFrom: isoDate.nullable(),
  notes: z.string().optional(),
  sourceIds: z.array(slug).min(1),
  verification: Verification,
});

export const MidTermAuditRule = z.object({
  monthsAfterRegistration: z.number().int().positive(),
  prepareFromMonth: z.number().int().positive(),
  /** Division ids assessed at mid-term (plus any corrective-action standards). */
  assessedDivisionIds: z.array(slug).min(1),
  exemptions: z.array(z.string().min(1)),
  sourceId: slug,
});

export const Rules = z.object({
  /** "If a provider's application includes registration groups associated with both ... they will need to complete a certification audit." */
  mixedAuditResolvesTo: AuditType,
  mixedAuditSourceId: slug,
  /** Module added when the provider uses restrictive practices in any support. */
  restrictivePracticesModuleId: slug,
  restrictivePracticesSourceId: slug,
  /** Group codes that do NOT bring in the core module when they are the only group selected. */
  coreExemptWhenSole: z.array(z.string().regex(/^\d{4}$/)),
  coreExemptWhenSoleSourceId: slug,
  /**
   * Individuals or partnerships whose only certification group is early
   * childhood: core module limited to the listed standard id(s).
   */
  modifiedCertification: z.object({
    groupCode: z.string().regex(/^\d{4}$/),
    businessStructures: z.array(z.enum(["sole-trader", "partnership"])),
    coreStandardIds: z.array(slug).min(1),
    sourceId: slug,
  }),
  registrationPeriodYears: z.number().int().positive(),
  registrationPeriodSourceId: slug,
  midTermAudit: MidTermAuditRule,
  /**
   * The Commission's definition of assistance with supported independent living
   * (class 0138), verbatim, so the questionnaire can ask the exclusion questions
   * before 0138 is included (PO review of REQ-001, item 2).
   */
  silDefinition: z.object({
    appliesWhen: z.array(z.string().min(1)).min(1),
    notSilWhen: z.array(z.string().min(1)).min(1),
    /** Date by which providers already delivering SIL must have applied, per the Commission's transition page. */
    applicationDeadline: isoDate,
    sourceId: slug,
  }),
  /** Audit report ratings as published, highest first. */
  ratings: z.array(
    z.object({ value: z.number().int(), label: z.string().min(1) }),
  ),
  ratingsSourceId: slug,
});

export const StandardsDataset = z.object({
  schemaVersion: z.literal(1),
  /** Semver of the dataset content (REQ-001 FR-6); bump on any source change. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver"),
  /** Date this dataset was assembled. */
  generatedAt: isoDate,
  /** Plain statement shown wherever evidence guidance is displayed. */
  evidenceDisclaimer: z.string().min(1),
  sources: z.array(Source).min(1),
  modules: z.array(Module).min(1),
  standards: z.array(Standard).min(1),
  registrationGroups: z.array(RegistrationGroup).min(1),
  rules: Rules,
});

export type Source = z.infer<typeof Source>;
export type Module = z.infer<typeof Module>;
export type Standard = z.infer<typeof Standard>;
export type EvidenceItem = z.infer<typeof EvidenceItem>;
export type RegistrationGroup = z.infer<typeof RegistrationGroup>;
export type Rules = z.infer<typeof Rules>;
export type StandardsDataset = z.infer<typeof StandardsDataset>;

/**
 * Cross-record integrity checks that a JSON schema cannot express.
 * Returns a list of human-readable problems; empty means the dataset is consistent.
 */
export function checkIntegrity(d: StandardsDataset): string[] {
  const problems: string[] = [];
  const sourceIds = new Set(d.sources.map((s) => s.id));
  const moduleIds = new Set(d.modules.map((m) => m.id));
  const standardIds = new Set(d.standards.map((s) => s.id));
  const divisionIds = new Map<string, Set<string>>();

  const dupes = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`duplicate ${what} id: ${id}`);
      seen.add(id);
    }
  };
  dupes(
    d.sources.map((s) => s.id),
    "source",
  );
  dupes(
    d.modules.map((m) => m.id),
    "module",
  );
  dupes(
    d.standards.map((s) => s.id),
    "standard",
  );
  dupes(
    d.registrationGroups.map((g) => g.code),
    "registration group",
  );

  const needSource = (id: string, where: string) => {
    if (!sourceIds.has(id)) problems.push(`${where}: unknown source "${id}"`);
  };

  for (const m of d.modules) {
    m.sourceIds.forEach((id) => needSource(id, `module ${m.id}`));
    divisionIds.set(m.id, new Set(m.divisions.map((dv) => dv.id)));
    m.divisions.forEach((dv) =>
      needSource(dv.sourceId, `division ${m.id}.${dv.id}`),
    );
    if (m.kind !== "core" && m.divisions.length > 0) {
      problems.push(`module ${m.id}: only the core module has divisions`);
    }
  }

  for (const s of d.standards) {
    if (!moduleIds.has(s.moduleId))
      problems.push(`standard ${s.id}: unknown module "${s.moduleId}"`);
    if (s.divisionId && !divisionIds.get(s.moduleId)?.has(s.divisionId)) {
      problems.push(
        `standard ${s.id}: unknown division "${s.divisionId}" in module "${s.moduleId}"`,
      );
    }
    const expectedPrefix = s.divisionId
      ? `${s.moduleId}.${s.divisionId}.`
      : `${s.moduleId}.`;
    if (!s.id.startsWith(expectedPrefix)) {
      problems.push(`standard ${s.id}: id must start with "${expectedPrefix}"`);
    }
    needSource(s.sourceId, `standard ${s.id}`);
    s.evidence.forEach(
      (e) => e.sourceId && needSource(e.sourceId, `evidence on ${s.id}`),
    );
  }

  for (const m of d.modules) {
    if (!d.standards.some((s) => s.moduleId === m.id)) {
      problems.push(`module ${m.id}: has no standards`);
    }
  }

  for (const g of d.registrationGroups) {
    g.moduleIds.forEach((id) => {
      if (!moduleIds.has(id))
        problems.push(`group ${g.code}: unknown module "${id}"`);
    });
    g.sourceIds.forEach((id) => needSource(id, `group ${g.code}`));
    if (g.moduleIds.length === 0 && !g.requiresCore) {
      problems.push(`group ${g.code}: maps to no module at all`);
    }
    if (
      g.auditType === "verification" &&
      (g.requiresCore || !g.moduleIds.includes("verification"))
    ) {
      problems.push(
        `group ${g.code}: verification groups map to the verification module only`,
      );
    }
    if (
      g.auditType === "certification" &&
      g.moduleIds.includes("verification")
    ) {
      problems.push(
        `group ${g.code}: certification groups must not map to the verification module`,
      );
    }
  }

  const r = d.rules;
  needSource(r.mixedAuditSourceId, "rules.mixedAudit");
  needSource(r.restrictivePracticesSourceId, "rules.restrictivePractices");
  needSource(r.coreExemptWhenSoleSourceId, "rules.coreExemptWhenSole");
  needSource(r.registrationPeriodSourceId, "rules.registrationPeriod");
  needSource(r.silDefinition.sourceId, "rules.silDefinition");
  r.coreExemptWhenSole.forEach((code) => {
    if (!d.registrationGroups.some((g) => g.code === code)) {
      problems.push(`rules.coreExemptWhenSole: unknown group "${code}"`);
    }
  });
  if (
    !d.registrationGroups.some(
      (g) => g.code === r.modifiedCertification.groupCode,
    )
  ) {
    problems.push(
      `rules.modifiedCertification: unknown group "${r.modifiedCertification.groupCode}"`,
    );
  }
  needSource(r.modifiedCertification.sourceId, "rules.modifiedCertification");
  needSource(r.midTermAudit.sourceId, "rules.midTermAudit");
  needSource(r.ratingsSourceId, "rules.ratings");
  if (!moduleIds.has(r.restrictivePracticesModuleId)) {
    problems.push(
      `rules: unknown restrictive-practices module "${r.restrictivePracticesModuleId}"`,
    );
  }
  r.modifiedCertification.coreStandardIds.forEach((id) => {
    if (!standardIds.has(id))
      problems.push(`rules.modifiedCertification: unknown standard "${id}"`);
  });
  const coreDivisions = divisionIds.get("core") ?? new Set<string>();
  r.midTermAudit.assessedDivisionIds.forEach((id) => {
    if (!coreDivisions.has(id))
      problems.push(`rules.midTermAudit: unknown core division "${id}"`);
  });

  return problems;
}

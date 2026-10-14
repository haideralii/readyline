/**
 * Typed access to data/readyline-content/document-types.json (REQ-005 FR-1).
 * Validated once at import so a malformed catalogue fails at build time.
 */
import { z } from "zod";
import catalogueJson from "../../../data/readyline-content/document-types.json";

const slug = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);

export const SectionSpec = z.object({
  id: slug,
  heading: z.string().min(1),
  mode: z.enum(["fixed", "tailored"]),
  /** The model's instruction for a tailored section. Never shown to a customer (REQ-016 FR-0a). */
  brief: z.string().min(1),
  /** For an extra section: place it right after this outline section instead of before the back matter. */
  insertAfter: slug.optional(),
  /** What the customer reads while the section is undrafted, in the ui-copy voice; the placeholders module supplies one otherwise. */
  placeholder: z.string().min(1).optional(),
  /** A section-level readability gate (REQ-016 S-4: the plain-language summary fails above Year 6). */
  readabilityFailAbove: z.number().positive().optional(),
});
export type SectionSpec = z.infer<typeof SectionSpec>;

export const DocumentTypeSpec = z
  .object({
    id: slug,
    title: z.string().min(1),
    kind: z.enum([
      "policy",
      "procedure",
      "plan",
      "template",
      "acknowledgement",
      "framework",
      "self-assessment",
    ]),
    outline: z.string().min(1),
    purpose: z.string().min(1),
    standards: z.array(slug),
    standardsSelection: z.literal("all-applicable").optional(),
    /** Why the document exists when a case cites none of its standards (D-045). */
    basis: z.enum([
      "practice-standard",
      "code-of-conduct",
      "commission-rules",
      "privacy-act",
      "good-practice",
    ]),
    /** Plain one-line reason, required unless the basis is a Practice Standard. */
    basisReason: z.string().min(1).optional(),
    evidenceAliases: z.array(slug),
    registers: z.array(slug),
    reviewCycleMonths: z.number().int().positive().optional(),
    /** Register review cycle for this document (R-8); defaults to the catalogue default. */
    registerReviewMonths: z.number().int().positive().optional(),
    /** Readability grade above which a tailored section fails (D-047); defaults to the catalogue default. */
    readabilityFailAbove: z.number().positive().optional(),
    extraSections: z.array(SectionSpec),
    /** Outline sections this document does not use (for example a split steps section, D-041). */
    omitSections: z.array(slug).optional(),
    proposed: z.boolean().optional(),
    /** No longer produced for new sets; existing sets keep their copy (REQ-016 S-6). */
    retired: z.boolean().optional(),
    retiredNote: z.string().min(1).optional(),
    /** Read by participants: carries a plain-language summary at Year 6 and a place for an Easy Read version (REQ-016 S-4). */
    participantFacing: z.boolean().optional(),
  })
  .refine((t) => t.basis === "practice-standard" || Boolean(t.basisReason), {
    message: "basisReason is required unless the basis is a Practice Standard",
    path: ["basisReason"],
  });
export type DocumentTypeSpec = z.infer<typeof DocumentTypeSpec>;

/** The sentence a document carries when the case is not audited against any of its standards (D-045). */
export function keptBecause(type: DocumentTypeSpec): string {
  const reason =
    type.basisReason ??
    "an auditor still asks how we handle what this document covers";
  return `Verification providers are not audited against this document under the NDIS Practice Standards. We keep it because ${reason}.`;
}

const Catalogue = z.object({
  note: z.string(),
  author: z.literal("readyline"),
  status: z.string(),
  defaults: z
    .object({
      reviewCycleMonths: z.number().int().positive(),
      registerReviewMonths: z.number().int().positive(),
      readabilityFailAbove: z.number().positive(),
      shortSectionWords: z.number().int().positive(),
    })
    .passthrough(),
  outlines: z.record(z.string(), z.array(SectionSpec).min(1)),
  items: z.array(DocumentTypeSpec).min(1),
});

export const catalogue = Catalogue.parse(catalogueJson);

/** Fixed sections that close every outline; extras are inserted before the first of these. */
const BACK_MATTER = new Set([
  "records-and-evidence",
  "related-documents",
  "review",
  "change-log",
  "notice",
  "signatures",
  "acknowledgement",
  "gaps",
]);

const byId = new Map(catalogue.items.map((i) => [i.id, i]));

export function documentTypeById(id: string): DocumentTypeSpec | undefined {
  return byId.get(id);
}

/** True for a type no new set produces (REQ-016 S-6); stored sets still render and regenerate it. */
export function isRetired(id: string): boolean {
  return Boolean(byId.get(id)?.retired);
}

/** The reading level a participant can manage (REQ-016 S-4): Flesch-Kincaid grade 6. */
export const PARTICIPANT_READING_GRADE = 6;

/**
 * The two sections every participant-facing document opens with (S-4): a
 * tailored summary at Year 6 and a marked place for an Easy Read version.
 * Defined here, not in the catalogue JSON, so the five types share one spec.
 */
export const PLAIN_LANGUAGE_SUMMARY: SectionSpec = {
  id: "plain-language-summary",
  heading: "In plain words",
  mode: "tailored",
  brief:
    "Four to six sentences a participant can read on their own, Year 6 level: what this document means for them, what they can expect from us, and who to talk to. Sentences under 12 words, everyday words, no jargon, second person (you) for the participant and we for the provider.",
  insertAfter: "document-control",
  placeholder:
    "[In plain words: what this document means for you, what you can expect from us, and who to talk to.]",
  readabilityFailAbove: PARTICIPANT_READING_GRADE,
};
export const EASY_READ_PLACE: SectionSpec = {
  id: "easy-read",
  heading: "Easy Read version",
  mode: "fixed",
  brief: "A marked place for the provider's Easy Read version of the summary.",
  insertAfter: "plain-language-summary",
};

/** Outline sections followed by the document's own extra sections. */
export function sectionsFor(type: DocumentTypeSpec): SectionSpec[] {
  const outline = catalogue.outlines[type.outline];
  if (!outline)
    throw new Error(
      `document type ${type.id}: unknown outline ${type.outline}`,
    );
  // Document-specific sections sit before the fixed back matter so the change log stays last.
  const omitted = new Set(type.omitSections ?? []);
  const base = outline.filter((s) => !omitted.has(s.id));
  const extras = type.participantFacing
    ? [PLAIN_LANGUAGE_SUMMARY, EASY_READ_PLACE, ...type.extraSections]
    : type.extraSections;
  const anchored = extras.filter((s) => s.insertAfter);
  const trailing = extras.filter((s) => !s.insertAfter);
  // Anchored extras follow their anchor (in catalogue order, chaining allowed).
  let result: SectionSpec[] = [...base];
  for (const extra of anchored) {
    const i = result.findIndex((s) => s.id === extra.insertAfter);
    if (i === -1)
      throw new Error(
        `document type ${type.id}: ${extra.id} has no anchor ${extra.insertAfter}`,
      );
    result = [...result.slice(0, i + 1), extra, ...result.slice(i + 1)];
  }
  const cut = result.findIndex((s) => BACK_MATTER.has(s.id));
  const at = cut === -1 ? result.length : cut;
  return [...result.slice(0, at), ...trailing, ...result.slice(at)];
}

export function reviewCycleMonths(type: DocumentTypeSpec): number {
  return type.reviewCycleMonths ?? catalogue.defaults.reviewCycleMonths;
}

export function registerReviewMonths(type: DocumentTypeSpec): number {
  return type.registerReviewMonths ?? catalogue.defaults.registerReviewMonths;
}

/**
 * The readability gate for a tailored section (D-047): fail above this
 * grade, except in short sections. A section's own gate (REQ-016 S-4) beats
 * the document's, which beats the catalogue default.
 */
export function readabilityGateFor(
  type: DocumentTypeSpec,
  section?: Pick<SectionSpec, "readabilityFailAbove">,
): {
  failAbove: number;
  shortSectionWords: number;
} {
  return {
    failAbove:
      section?.readabilityFailAbove ??
      type.readabilityFailAbove ??
      catalogue.defaults.readabilityFailAbove,
    shortSectionWords: catalogue.defaults.shortSectionWords,
  };
}

/** The review cycles the model must use (D-042). */
export function reviewCyclesFor(type: DocumentTypeSpec): {
  policyMonths: number;
  registerMonths: number;
} {
  return {
    policyMonths: reviewCycleMonths(type),
    registerMonths: registerReviewMonths(type),
  };
}

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
  brief: z.string().min(1),
  /** For an extra section: place it right after this outline section instead of before the back matter. */
  insertAfter: slug.optional(),
});
export type SectionSpec = z.infer<typeof SectionSpec>;

export const DocumentTypeSpec = z.object({
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
  evidenceAliases: z.array(slug),
  registers: z.array(slug),
  reviewCycleMonths: z.number().int().positive().optional(),
  /** Register review cycle for this document (R-8); defaults to the catalogue default. */
  registerReviewMonths: z.number().int().positive().optional(),
  extraSections: z.array(SectionSpec),
  /** Outline sections this document does not use (for example a split steps section, D-041). */
  omitSections: z.array(slug).optional(),
  proposed: z.boolean().optional(),
});
export type DocumentTypeSpec = z.infer<typeof DocumentTypeSpec>;

const Catalogue = z.object({
  note: z.string(),
  author: z.literal("readyline"),
  status: z.string(),
  defaults: z
    .object({
      reviewCycleMonths: z.number().int().positive(),
      registerReviewMonths: z.number().int().positive(),
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
  "notice",
  "signatures",
  "acknowledgement",
  "gaps",
]);

const byId = new Map(catalogue.items.map((i) => [i.id, i]));

export function documentTypeById(id: string): DocumentTypeSpec | undefined {
  return byId.get(id);
}

/** Outline sections followed by the document's own extra sections. */
export function sectionsFor(type: DocumentTypeSpec): SectionSpec[] {
  const outline = catalogue.outlines[type.outline];
  if (!outline)
    throw new Error(
      `document type ${type.id}: unknown outline ${type.outline}`,
    );
  // Document-specific sections sit before the fixed back matter so the notice stays last.
  const omitted = new Set(type.omitSections ?? []);
  const base = outline.filter((s) => !omitted.has(s.id));
  const anchored = type.extraSections.filter((s) => s.insertAfter);
  const trailing = type.extraSections.filter((s) => !s.insertAfter);
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

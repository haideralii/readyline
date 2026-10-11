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
  extraSections: z.array(SectionSpec),
  proposed: z.boolean().optional(),
});
export type DocumentTypeSpec = z.infer<typeof DocumentTypeSpec>;

const Catalogue = z.object({
  note: z.string(),
  author: z.literal("readyline"),
  status: z.string(),
  defaults: z
    .object({ reviewCycleMonths: z.number().int().positive() })
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
  const cut = outline.findIndex((s) => BACK_MATTER.has(s.id));
  const at = cut === -1 ? outline.length : cut;
  return [...outline.slice(0, at), ...type.extraSections, ...outline.slice(at)];
}

export function reviewCycleMonths(type: DocumentTypeSpec): number {
  return type.reviewCycleMonths ?? catalogue.defaults.reviewCycleMonths;
}

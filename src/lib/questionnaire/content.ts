/**
 * Readyline-authored content for the questionnaire (REQ-003, PO review item 5;
 * DECISIONS D-026): module and audit-type descriptions, the document-set
 * mapping and the group descriptions. Validated at load so a typo in a JSON
 * file fails the unit suite, never a page.
 */
import { z } from "zod";
import auditKindsJson from "../../../data/readyline-content/audit-kinds.json";
import auditTypesJson from "../../../data/readyline-content/audit-types.json";
import documentSetsJson from "../../../data/readyline-content/document-sets.json";
import modulesJson from "../../../data/readyline-content/modules.json";
import groupDescriptionsJson from "../../../data/registration-group-descriptions.json";
import groupCategoriesJson from "../../../data/readyline-content/group-categories.json";
import documentGroupsJson from "../../../data/readyline-content/document-groups.json";
import glossaryJson from "../../../data/readyline-content/glossary.json";
import startHereJson from "../../../data/readyline-content/start-here.json";

const reviewed = {
  note: z.string().min(1),
  author: z.literal("readyline"),
  status: z.enum(["draft", "reviewed"]),
};

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const code = z.string().regex(/^\d{4}$/);

export const ModulesContent = z.object({
  ...reviewed,
  items: z
    .array(z.object({ id: slug, poId: slug, description: z.string().min(20) }))
    .min(1),
});

export const AuditTypesContent = z.object({
  ...reviewed,
  items: z
    .array(
      z.object({
        id: z.enum(["verification", "certification"]),
        description: z.string().min(20),
      }),
    )
    .length(2),
});

const DocumentRule = z.object({
  id: slug,
  when: z
    .object({
      groupsAny: z.union([
        z.literal("personalCareGroups"),
        z.array(code).min(1),
      ]),
    })
    .optional(),
});

export const DocumentSetsContent = z.object({
  ...reviewed,
  personalCareGroups: z.array(code).min(1),
  always: z.array(slug).min(1),
  byModule: z.record(slug, z.array(DocumentRule)),
  registers: z
    .array(
      z.object({
        id: slug,
        title: z.string().min(1),
        /** Present only for registers that apply when one of these modules is in scope (PO batch 7). */
        when: z.object({ modulesAny: z.array(slug).min(1) }).optional(),
      }),
    )
    .min(1),
});

export const GroupDescriptionsContent = z.object({
  ...reviewed,
  items: z
    .array(
      z.object({
        code,
        name: z.string().min(1),
        description: z.string().min(20),
        /** Everyday search words (REQ-013 FR-3); Readyline text, never change the class. */
        synonyms: z.array(z.string().min(1)).optional(),
      }),
    )
    .length(38),
});

/** Everyday groupings of the classes for the supports step (REQ-013 FR-3). */
export const GroupCategoriesContent = z.object({
  note: z.string(),
  author: z.literal("readyline"),
  status: z.string(),
  question: z.string().min(1),
  hint: z.object({ text: z.string().min(1), selects: z.array(code).min(1) }),
  categories: z
    .array(
      z.object({
        id: slug,
        title: z.string().min(1),
        description: z.string().min(1),
        codes: z.array(code).min(1),
      }),
    )
    .min(1),
});

export const modulesContent = ModulesContent.parse(modulesJson);
export const auditTypesContent = AuditTypesContent.parse(auditTypesJson);

/**
 * REQ-025 FR-13, D-2219: the audit words with one plain meaning each, the
 * one source the pages read (decision 12 of the review). A meaning is a
 * clause without a full stop; `glossarySentence` capitalises it and adds one.
 * REQ-027 D-2713: `more` is the optional second field, at most two sentences
 * and 240 characters, shown only in the "What these words mean" disclosure
 * under the term, never inline, never in a bracket, never composed into
 * another file's sentence.
 */
export const GlossaryContent = z.object({
  ...reviewed,
  items: z
    .array(
      z.object({
        id: slug,
        term: z.string().min(3),
        meaning: z.string().min(10).max(160),
        more: z.string().min(10).max(240).optional(),
      }),
    )
    .min(1),
});
export const glossaryContent = GlossaryContent.parse(glossaryJson);
export type GlossaryId = (typeof glossaryContent.items)[number]["id"];

export function glossaryTerm(id: string): {
  term: string;
  meaning: string;
  more?: string;
} {
  const t = glossaryContent.items.find((x) => x.id === id);
  if (!t) throw new Error(`glossary: no term "${id}"`);
  return { term: t.term, meaning: t.meaning, more: t.more };
}

export function glossaryMeaning(id: string): string {
  return glossaryTerm(id).meaning;
}

/** The meaning as a sentence: "A second audit that most certification providers must have." */
export function glossarySentence(id: string): string {
  const m = glossaryMeaning(id);
  return `${m[0].toUpperCase()}${m.slice(1)}.`;
}

/** The one-term page's inline form (REQ-027 D-2715): `term (meaning)`, lower-case clause, no full stop. */
export function glossaryBracket(id: string): string {
  const t = glossaryTerm(id);
  return `${t.term} (${t.meaning})`;
}

/**
 * `{{glossary:<id>}}` in a content file becomes that term's bracket form
 * (REQ-027 D-2715, D-2724): plain text, `term (meaning)`, so a JSON file or
 * a guide reads from the glossary too and the sentence around the token
 * carries on. A token is for a one-term page alone; the lint holds that rule.
 */
export function resolveGlossaryTokens(text: string): string {
  return text.replace(/\{\{glossary:([a-z0-9-]+)\}\}/g, (_, id: string) =>
    glossaryBracket(id),
  );
}

/** REQ-026 FR-2: the Start here sheet's own words; the estimates are the PO's to edit. */
export const StartHereContent = z.object({
  ...reviewed,
  estimateLine: z.string().min(20),
  defaultMinutes: z.number().int().positive(),
  estimatesMinutes: z.record(slug, z.number().int().positive()),
  defaultFirstWhy: z.string().min(5),
  /** Six words or fewer each (FR-2.2); checked by the content test. */
  firstWhy: z.record(slug, z.string().min(5)),
  registerPurpose: z.record(slug, z.string().min(10)),
  registerDocuments: z.record(slug, z.array(slug)),
  next: z
    .array(
      z.object({
        text: z.string().min(5),
        href: z.string().regex(/^\/[a-z-]+(\/[a-z-]+)*$/),
      }),
    )
    .min(1),
});
export const startHereContent = StartHereContent.parse(startHereJson);

/** REQ-018 FR-11, AC-4: the five kinds of audit, in plain words, for the audit-day page's glossary. */
export const AuditKindsContent = z.object({
  ...reviewed,
  items: z
    .array(
      z.object({
        id: z.enum([
          "provisional",
          "first-with-participants",
          "mid-term",
          "renewal",
          "conditional",
        ]),
        name: z.string().min(5),
        description: z.string().min(40),
      }),
    )
    .length(5),
});
export const auditKindsContent = (() => {
  const parsed = AuditKindsContent.parse(auditKindsJson);
  return {
    ...parsed,
    items: parsed.items.map((k) => ({
      ...k,
      description: resolveGlossaryTokens(k.description),
    })),
  };
})();
export const documentSetsContent = DocumentSetsContent.parse(documentSetsJson);
export const groupDescriptionsContent = GroupDescriptionsContent.parse(
  groupDescriptionsJson,
);
export const groupCategoriesContent =
  GroupCategoriesContent.parse(groupCategoriesJson);

/** The four result-page headings for documents (REQ-013 FR-5). */
export const DocumentGroupsContent = z.object({
  note: z.string(),
  author: z.literal("readyline"),
  status: z.string(),
  groups: z
    .array(
      z.object({
        id: slug,
        title: z.string().min(1),
        documents: z.array(slug).min(1),
      }),
    )
    .length(4),
});
export const documentGroupsContent =
  DocumentGroupsContent.parse(documentGroupsJson);

export function documentGroupId(documentId: string): string {
  return (
    documentGroupsContent.groups.find((g) => g.documents.includes(documentId))
      ?.id ?? "other"
  );
}

export function moduleDescription(moduleId: string): string | undefined {
  return modulesContent.items.find((m) => m.id === moduleId)?.description;
}

export function auditTypeDescription(
  id: "verification" | "certification",
): string {
  return auditTypesContent.items.find((a) => a.id === id)!.description;
}

export function groupSynonyms(code: string): string[] {
  return (
    groupDescriptionsContent.items.find((g) => g.code === code)?.synonyms ?? []
  );
}

export function groupCategoryId(code: string): string | undefined {
  return groupCategoriesContent.categories.find((c) => c.codes.includes(code))
    ?.id;
}

export function groupDescription(code: string): string | undefined {
  return groupDescriptionsContent.items.find((g) => g.code === code)
    ?.description;
}

/** Turns a document id into a readable title: "risk-management-policy-and-register" -> "Risk management policy and register". */
export function documentTitle(id: string): string {
  const words = id
    .replace(/-/g, " ")
    .replace(/\bai\b/g, "AI")
    .replace(/\bsil\b/g, "SIL");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

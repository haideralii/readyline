/**
 * Readyline-authored content for the questionnaire (REQ-003, PO review item 5;
 * DECISIONS D-026): module and audit-type descriptions, the document-set
 * mapping and the group descriptions. Validated at load so a typo in a JSON
 * file fails the unit suite, never a page.
 */
import { z } from "zod";
import auditTypesJson from "../../../data/readyline-content/audit-types.json";
import documentSetsJson from "../../../data/readyline-content/document-sets.json";
import modulesJson from "../../../data/readyline-content/modules.json";
import groupDescriptionsJson from "../../../data/registration-group-descriptions.json";
import groupCategoriesJson from "../../../data/readyline-content/group-categories.json";
import documentGroupsJson from "../../../data/readyline-content/document-groups.json";

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

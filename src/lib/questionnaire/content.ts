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
      }),
    )
    .length(38),
});

export const modulesContent = ModulesContent.parse(modulesJson);
export const auditTypesContent = AuditTypesContent.parse(auditTypesJson);
export const documentSetsContent = DocumentSetsContent.parse(documentSetsJson);
export const groupDescriptionsContent = GroupDescriptionsContent.parse(
  groupDescriptionsJson,
);

export function moduleDescription(moduleId: string): string | undefined {
  return modulesContent.items.find((m) => m.id === moduleId)?.description;
}

export function auditTypeDescription(
  id: "verification" | "certification",
): string {
  return auditTypesContent.items.find((a) => a.id === id)!.description;
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

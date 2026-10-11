/**
 * The small shape of registration groups the browser needs for step 2:
 * code, Commission name and audit type from the dataset, plus the Readyline
 * description, search synonyms and everyday category (REQ-013 FR-3).
 * Computed on the server so standards.json stays there.
 */
import type { StandardsDataset } from "@/lib/standards/schema";
import {
  groupCategoriesContent,
  groupCategoryId,
  groupDescription,
  groupSynonyms,
} from "./content";

export type GroupOption = {
  code: string;
  name: string;
  auditType: "verification" | "certification";
  description: string;
  mandatoryFrom: string | null;
  synonyms: string[];
  categoryId: string;
};

export type GroupCategory = {
  id: string;
  title: string;
  description: string;
};

export function getGroupOptions(dataset: StandardsDataset): GroupOption[] {
  return dataset.registrationGroups
    .map((g) => ({
      code: g.code,
      name: g.name,
      auditType: g.auditType,
      description: groupDescription(g.code) ?? "",
      mandatoryFrom: g.mandatoryFrom,
      synonyms: groupSynonyms(g.code),
      categoryId: groupCategoryId(g.code) ?? "other",
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function getGroupCategories(): GroupCategory[] {
  return groupCategoriesContent.categories.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
  }));
}

export const GROUP_QUESTION = groupCategoriesContent.question;
export const GROUP_HINT = groupCategoriesContent.hint;

/** Case-insensitive match over code, name, description and synonyms. */
export function matchesGroupQuery(g: GroupOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    g.code.includes(q) ||
    g.name.toLowerCase().includes(q) ||
    g.description.toLowerCase().includes(q) ||
    g.synonyms.some((s) => s.toLowerCase().includes(q))
  );
}

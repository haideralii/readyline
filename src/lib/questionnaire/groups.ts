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
  /** Position within its category as the data lists it (REQ-013 R-1): most common first. */
  categoryIndex: number;
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
      categoryIndex: groupCategoryIndex(g.code),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** The order the data gives within a category; unknown codes go last. */
export function groupCategoryIndex(code: string): number {
  for (const c of groupCategoriesContent.categories) {
    const i = c.codes.indexOf(code);
    if (i >= 0) return i;
  }
  return Number.MAX_SAFE_INTEGER;
}

/** Options of one category in the data's order, not code order (R-1). */
export function groupsInCategory(
  options: readonly GroupOption[],
  categoryId: string,
): GroupOption[] {
  return options
    .filter((g) => g.categoryId === categoryId)
    .sort((a, b) => a.categoryIndex - b.categoryIndex);
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

/**
 * REQ-027 D-2730 (Haider's find on production's step 2): the "Not sure?"
 * hint keys on the business structure. A sole trader reads the sole-trader
 * sentence; every other structure, and a reader with no structure answer
 * yet, reads the general one. The button and the two classes it selects
 * are the same either way.
 */
export function groupHintText(structure: string | null | undefined): string {
  return structure === "sole-trader" ? GROUP_HINT.text : GROUP_HINT.textGeneral;
}

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

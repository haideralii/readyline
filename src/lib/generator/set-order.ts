/**
 * The audit order of a document set (REQ-016 S-7): the result page's four
 * headings in order (running the business first, environment last), then
 * anything the groups do not name (a retired type in an older set), then
 * the self-assessment. Pure, so the set page and the docx lint share it.
 */
import { documentGroupsContent } from "@/lib/questionnaire/content";

export const SELF_ASSESSMENT_TYPE_ID = "practice-standards-self-assessment";

export type OrderedGroup<T> = { title: string; documents: T[] };

export function orderDocuments<T extends { document_type_id: string }>(
  documents: readonly T[],
): OrderedGroup<T>[] {
  const byId = new Map(documents.map((d) => [d.document_type_id, d]));
  const placed = new Set<string>();
  const groups = documentGroupsContent.groups.map((g) => {
    const docs = g.documents
      .map((id) => byId.get(id))
      .filter((d): d is T => Boolean(d));
    for (const d of docs) placed.add(d.document_type_id);
    return { title: g.title, documents: docs };
  });
  const rest = documents.filter((d) => !placed.has(d.document_type_id));
  return [
    ...groups,
    {
      title: "Other",
      documents: rest.filter(
        (d) => d.document_type_id !== SELF_ASSESSMENT_TYPE_ID,
      ),
    },
    {
      title: "Self-assessment",
      documents: rest.filter(
        (d) => d.document_type_id === SELF_ASSESSMENT_TYPE_ID,
      ),
    },
  ].filter((g) => g.documents.length > 0);
}

/** A group title as a path segment (REQ-017 step 5): "Running the business" is "running-the-business". */
export function groupSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The flat audit order of type ids, for a lint over a whole set (S-7). */
export function auditOrder(typeIds: readonly string[]): string[] {
  return orderDocuments(typeIds.map((id) => ({ document_type_id: id })))
    .flatMap((g) => g.documents)
    .map((d) => d.document_type_id);
}

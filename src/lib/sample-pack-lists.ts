import { documentTypeById } from "@/lib/generator/catalogue";
import { loadReferenceCases } from "@/lib/generator/reference-cases";

/**
 * REQ-034 FR-5 (D-2951): what a pack holds, for the two cases a buyer
 * weighs first: the sole trader facing a verification audit and the
 * personal-care provider facing a certification audit. The titles are the
 * result's own document list (`deriveDocumentSet` over `document-sets.json`),
 * so the lists cannot go stale, and the count is the list's length.
 */
export type SamplePackList = {
  id: string;
  /** The case, in the buyer's words. */
  label: string;
  count: number;
  titles: readonly string[];
};

export const SAMPLE_PACK_CASES: ReadonlyArray<{ id: string; label: string }> = [
  {
    id: "verification-sole-trader",
    label: "A sole trader facing a verification audit",
  },
  {
    id: "certification-personal-care",
    label: "A provider delivering personal care, facing a certification audit",
  },
];

export const SAMPLE_PACK_HEADING = "What a pack holds";
export const SAMPLE_PACK_LEAD =
  "The documents in a pack follow your answers. These two lists show the two cases buyers ask about most.";

export function packCountLine(count: number): string {
  return `${count} documents`;
}

export function samplePackLists(): SamplePackList[] {
  const cases = loadReferenceCases();
  return SAMPLE_PACK_CASES.map(({ id, label }) => {
    const c = cases.find((x) => x.id === id);
    if (!c) throw new Error(`reference case missing: ${id}`);
    // The catalogue's titles (FR-5); the document set's name stands in for an id outside it.
    const titles = c.result.documents.map(
      (d) => documentTypeById(d.id)?.title ?? d.title,
    );
    return { id, label, count: titles.length, titles };
  });
}

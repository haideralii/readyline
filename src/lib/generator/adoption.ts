/**
 * Aligning a document's own control table with the document control
 * register when the provider adopts it (REQ-018 FR-13; retro review of
 * REQ-018 to 021, finding 3, PO decision 3 of 15 Oct 2026). The skeleton
 * prints the drafting day plus the review cycle as "Next review" and leaves
 * "Approval date" as a blank, so the Word file and the readiness summary's
 * first page (the register) could show different dates. At the adopt
 * re-render the register's adopted-on and next-review dates are written into
 * the control table, the review section's sentence and the model's
 * `reviewDueAt`, so the two agree. Pure and idempotent: the same dates applied
 * twice change nothing, so a later re-render adds no document version.
 */
import type { DocumentModel, ResolvedSection } from "./document-model";
import { formatDateAu } from "./fixed-text";
import type { Block } from "./section-schema";

export type Adoption = {
  /** The register's adopted-on date, YYYY-MM-DD. */
  adoptedOn: string;
  /** The register's next review date, YYYY-MM-DD. */
  nextReviewOn: string;
};

/** The control table's row labels the adoption writes (`fixed-text.ts`, "document-control"). */
export const APPROVAL_DATE_LABEL = "Approval date";
export const NEXT_REVIEW_LABEL = "Next review";

const NEXT_REVIEW_SENTENCE = /Next review: [^.]+\./;

/**
 * The adopted documents' dates from the document control register's rows,
 * by document type: a row without an adoption or a review date is skipped,
 * so a document not yet adopted keeps its drafted dates.
 */
export function adoptionsByType(
  rows: readonly {
    document_type_id: string;
    adopted_on: string | null;
    next_review_on: string | null;
  }[],
): Map<string, Adoption> {
  const out = new Map<string, Adoption>();
  for (const r of rows)
    if (r.adopted_on && r.next_review_on)
      out.set(r.document_type_id, {
        adoptedOn: r.adopted_on,
        nextReviewOn: r.next_review_on,
      });
  return out;
}

function controlBlock(block: Block, approved: string, next: string): Block {
  if (block.type !== "table") return block;
  return {
    ...block,
    rows: block.rows.map((r) =>
      r[0] === APPROVAL_DATE_LABEL
        ? [r[0], approved, ...r.slice(2)]
        : r[0] === NEXT_REVIEW_LABEL
          ? [r[0], next, ...r.slice(2)]
          : r,
    ),
  };
}

function reviewBlock(block: Block, next: string): Block {
  if (block.type !== "paragraph") return block;
  return {
    ...block,
    text: block.text.replace(NEXT_REVIEW_SENTENCE, `Next review: ${next}.`),
  };
}

/** The model with the register's adoption and next review dates in its control table and review section. */
export function applyAdoption(
  model: DocumentModel,
  adoption: Adoption,
): DocumentModel {
  const approved = formatDateAu(adoption.adoptedOn);
  const next = formatDateAu(adoption.nextReviewOn);
  const sections: ResolvedSection[] = model.sections.map((s) => {
    if (s.id === "document-control")
      return {
        ...s,
        blocks: s.blocks.map((b) => controlBlock(b, approved, next)),
      };
    if (s.id === "review")
      return { ...s, blocks: s.blocks.map((b) => reviewBlock(b, next)) };
    return s;
  });
  return { ...model, reviewDueAt: adoption.nextReviewOn, sections };
}

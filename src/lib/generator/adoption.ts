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
import { applyFacts, applyLiveFacts } from "./facts-fill";
import { formatDateAu } from "./fixed-text";
import type { Block } from "./section-schema";

export type Adoption = {
  /** The register's adopted-on date, YYYY-MM-DD. */
  adoptedOn: string;
  /** The register's next review date, YYYY-MM-DD. */
  nextReviewOn: string;
  /**
   * REQ-029 D-2855: the approver's name and role as the version's snapshot
   * holds them (`document_versions.approver_name`, `approver_role`); null
   * for a version adopted before the snapshot existed, whose text already
   * carries the values (FR-9), so nothing is filled.
   */
  approverName?: string | null;
  approverRole?: string | null;
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
  const dated = { ...model, reviewDueAt: adoption.nextReviewOn, sections };
  // REQ-029 D-2855: the four fixed blanks (the Approver row, "[date]", the
  // responsibilities "[role]", the change log's "[name]") fill from the
  // snapshot, through the same fill the facts use, so FR-7's participant
  // rule holds here too. A version without a snapshot keeps its brackets.
  const name = adoption.approverName?.trim();
  if (!name) return dated;
  const role = adoption.approverRole?.trim();
  return applyFacts(dated, {
    name,
    ...(role ? { role } : {}),
    date: approved,
  });
}

/**
 * REQ-029 FR-8 (D-2857): the Provider cell of the control table is written at
 * generation as "Trading name (ABN 12 345 678 901)"; only its ABN part is
 * rebuilt from the account at download. The trading name is never rebuilt
 * (a changed name is content and takes a new version). With no ABN on the
 * account the cell keeps the name alone.
 */
export const PROVIDER_LABEL = "Provider";
const ABN_PART = /\s*\(ABN [^)]*\)\s*$/;

export function applyProviderAbn(
  model: DocumentModel,
  abn: string | null,
): DocumentModel {
  const sections: ResolvedSection[] = model.sections.map((s) => {
    if (s.id !== "document-control") return s;
    return {
      ...s,
      blocks: s.blocks.map((b) =>
        b.type !== "table"
          ? b
          : {
              ...b,
              rows: b.rows.map((r) => {
                if (r[0] !== PROVIDER_LABEL || typeof r[1] !== "string")
                  return r;
                const name = r[1].replace(ABN_PART, "").trim();
                return [
                  r[0],
                  abn ? `${name} (ABN ${abn})` : name,
                  ...r.slice(2),
                ];
              }),
            },
      ),
    };
  });
  return { ...model, sections };
}

/**
 * REQ-029 FR-3: the two fills, one renderer. Every download and every page
 * renders the stored model through the live fill (contact and AI-appendix
 * answers), the adoption fill (the snapshot, when the version is adopted)
 * and the ABN rebuild; the stored model is never changed by it.
 */
export function fillForRead(
  model: DocumentModel,
  input: {
    facts: Readonly<Record<string, string>>;
    adoption: Adoption | null;
    abn: string | null;
  },
): DocumentModel {
  const live = applyLiveFacts(model, input.facts);
  const adopted = input.adoption ? applyAdoption(live, input.adoption) : live;
  return applyProviderAbn(adopted, input.abn);
}

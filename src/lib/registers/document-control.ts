/**
 * The document control register (REQ-018 FR-13, FR-14, AC-5; D-1906),
 * generated from the pack itself with no typing: one row per document in
 * the newest ready set with its title, version, adopted on, adopted by (a
 * role), next review date and whether the latest version was circulated
 * to workers (the Adopt step's tick, FR-14). Pure: the stored rows in, the
 * register out; the page and the readiness summary's first page both
 * render it.
 */
import { addMonths } from "./reminders";

export type DocumentControlInput = {
  documents: {
    document_type_id: string;
    title: string;
    version: number;
    created_at: string;
  }[];
  reviews: {
    document_type_id: string;
    adopted_on: string | null;
    review_cycle_months: number;
    last_reviewed_on: string | null;
    next_review_on: string | null;
  }[];
  circulations: {
    document_type_id: string;
    circulated_on: string;
    worker_refs: string;
  }[];
  /** The owner's role from the account facts (D-1704), or a plain default. */
  adoptedByRole: string | null;
};

export type DocumentControlRow = {
  document_type_id: string;
  title: string;
  version: string;
  adopted_on: string | null;
  adopted_by: string;
  next_review_on: string | null;
  /** The latest circulation at or after the document's current version, if any. */
  circulated: { on: string; workers: number } | null;
  /** The row's one-word state for the list and the audit-day page. */
  state: "adopted" | "not-adopted" | "review-due" | "overdue";
};

export const DEFAULT_REVIEW_MONTHS = 12;

export function documentControlRows(
  input: DocumentControlInput,
  today: string,
): DocumentControlRow[] {
  const reviewByType = new Map(
    input.reviews.map((r) => [r.document_type_id, r]),
  );
  return input.documents.map((d) => {
    const review = reviewByType.get(d.document_type_id);
    const adopted = review?.adopted_on ?? null;
    const nextReview =
      review?.next_review_on ??
      (adopted
        ? addMonths(
            review?.last_reviewed_on ?? adopted,
            review?.review_cycle_months ?? DEFAULT_REVIEW_MONTHS,
          )
        : null);
    // FR-14: the newest circulation of this document on or after the day the current version was drafted.
    const versionDay = d.created_at.slice(0, 10);
    const circulation = input.circulations
      .filter(
        (c) =>
          c.document_type_id === d.document_type_id &&
          c.circulated_on >= versionDay,
      )
      .sort((a, b) => (a.circulated_on < b.circulated_on ? 1 : -1))[0];
    const state: DocumentControlRow["state"] = !adopted
      ? "not-adopted"
      : nextReview && nextReview < today
        ? "overdue"
        : nextReview && nextReview <= addMonths(today, 1)
          ? "review-due"
          : "adopted";
    return {
      document_type_id: d.document_type_id,
      title: d.title,
      version: String(d.version),
      adopted_on: adopted,
      adopted_by: adopted ? (input.adoptedByRole ?? "Owner") : "",
      next_review_on: nextReview,
      circulated: circulation
        ? {
            on: circulation.circulated_on,
            workers: circulation.worker_refs.trim().split(/\s+/).length,
          }
        : null,
      state,
    };
  });
}

/** AC-5: every cell filled once the pack is adopted; the rows that are not say which cells are empty. */
export function documentControlGaps(rows: DocumentControlRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    if (!r.adopted_on) out.push(`${r.title}: not adopted`);
    else if (!r.next_review_on) out.push(`${r.title}: no review date`);
    else if (!r.circulated) out.push(`${r.title}: not circulated to workers`);
  }
  return out;
}

/** The sentence the audit-day page and the summary use. */
export function documentControlSentence(rows: DocumentControlRow[]): string {
  if (rows.length === 0) return "No documents yet.";
  const adopted = rows.filter((r) => r.adopted_on).length;
  const circulated = rows.filter((r) => r.circulated).length;
  const overdue = rows.filter((r) => r.state === "overdue").length;
  const parts = [
    `${adopted} of ${rows.length} adopted`,
    `${circulated} circulated to workers`,
  ];
  if (overdue)
    parts.push(`${overdue} review${overdue === 1 ? "" : "s"} overdue`);
  return `${parts.join(", ")}.`;
}

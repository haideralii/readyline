/**
 * The document control register (REQ-018 FR-13, FR-14, AC-5; D-1906),
 * generated from the pack itself with no typing: one row per document in
 * the newest ready set with its title, version, adopted on, adopted by (a
 * role), next review date and whether the latest version was circulated
 * to workers (the Adopt step's tick, FR-14). Pure: the stored rows in, the
 * register out; the page and the readiness summary's first page both
 * render it.
 */
import {
  changesForDocument,
  loadWatchChanges,
  type ReviewNeeded,
  type WatchChange,
} from "./living-policies";
import { addMonths } from "./reminders";

export type DocumentControlInput = {
  documents: {
    document_type_id: string;
    title: string;
    version: number;
    created_at: string;
    /** The stored version's id, so the page can re-generate a section (backlog 8). */
    version_id?: string;
    /** Section texts from the stored model, for the living-policies match (backlog 8). */
    sections?: { id: string; text: string }[];
  }[];
  /** The watch's applied changes (backlog 8); the ledger by default, a list in tests. */
  changes?: readonly WatchChange[];
  /** Changes the owner has checked per document (backlog 8). */
  changeReviews?: { document_type_id: string; change_id: string }[];
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
  /** The owner's name from the account facts; adoption needs it (retro finding 114, D-2244), so "by whom" names a person. */
  adoptedByName?: string | null;
};

/** "Jane Citizen, Director"; the name alone; the role alone; "Owner" when the facts hold neither (packs adopted before D-2244). */
export function adoptedBy(input: {
  adoptedByRole: string | null;
  adoptedByName?: string | null;
}): string {
  const name = input.adoptedByName?.trim() ?? "";
  const role = input.adoptedByRole?.trim() ?? "";
  if (name && role) return `${name}, ${role}`;
  return name || role || "Owner";
}

export type DocumentControlRow = {
  document_type_id: string;
  title: string;
  version: string;
  adopted_on: string | null;
  adopted_by: string;
  next_review_on: string | null;
  /** The latest circulation at or after the document's current version, if any. */
  circulated: { on: string; workers: number } | null;
  /** The row's one-word state for the list and the audit-day page; "review-needed" when a rule change applies (backlog 8). */
  state: "adopted" | "not-adopted" | "review-due" | "overdue" | "review-needed";
  /** The stored version's id when known. */
  version_id: string | null;
  /** Rule changes this adopted document still needs checked for (backlog 8). */
  reviewNeeded: ReviewNeeded[];
};

export const DEFAULT_REVIEW_MONTHS = 12;

export function documentControlRows(
  input: DocumentControlInput,
  today: string,
): DocumentControlRow[] {
  const reviewByType = new Map(
    input.reviews.map((r) => [r.document_type_id, r]),
  );
  const changes = input.changes ?? loadWatchChanges();
  const checked = new Map<string, Set<string>>();
  for (const r of input.changeReviews ?? []) {
    const set = checked.get(r.document_type_id) ?? new Set<string>();
    set.add(r.change_id);
    checked.set(r.document_type_id, set);
  }
  return input.documents.map((d) => {
    const review = reviewByType.get(d.document_type_id);
    const adopted = review?.adopted_on ?? null;
    // Backlog 8: an adopted document drafted before a rule change it does not carry needs a look.
    const reviewNeeded =
      adopted && d.sections
        ? changesForDocument(
            {
              typeId: d.document_type_id,
              createdAt: d.created_at,
              sections: d.sections,
            },
            changes,
            checked.get(d.document_type_id),
          )
        : [];
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
        : reviewNeeded.length > 0
          ? "review-needed"
          : nextReview && nextReview <= addMonths(today, 1)
            ? "review-due"
            : "adopted";
    return {
      document_type_id: d.document_type_id,
      title: d.title,
      version: String(d.version),
      adopted_on: adopted,
      adopted_by: adopted ? adoptedBy(input) : "",
      next_review_on: nextReview,
      circulated: circulation
        ? {
            on: circulation.circulated_on,
            workers: circulation.worker_refs.trim().split(/\s+/).length,
          }
        : null,
      state,
      version_id: d.version_id ?? null,
      reviewNeeded,
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
    else if (r.reviewNeeded.length > 0)
      out.push(`${r.title}: a rule changed since it was drafted`);
  }
  return out;
}

/** The sentence the audit-day page and the summary use. */
export function documentControlSentence(rows: DocumentControlRow[]): string {
  if (rows.length === 0) return "No documents yet.";
  const adopted = rows.filter((r) => r.adopted_on).length;
  const circulated = rows.filter((r) => r.circulated).length;
  const overdue = rows.filter((r) => r.state === "overdue").length;
  const needReview = rows.filter((r) => r.reviewNeeded.length > 0).length;
  const parts = [
    `${adopted} of ${rows.length} adopted`,
    `${circulated} circulated to workers`,
  ];
  if (overdue)
    parts.push(`${overdue} review${overdue === 1 ? "" : "s"} overdue`);
  if (needReview) parts.push(`${needReview} to check after a rule change`);
  return `${parts.join(", ")}.`;
}

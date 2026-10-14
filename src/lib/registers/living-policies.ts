/**
 * Living policies (standing backlog 8, D-551): when the NDIS watch applies
 * a rule change to fixed text, a brief or the standards data, every
 * adopted document drafted before the change and not yet carrying the new
 * sentence is marked "review needed" in the document control register,
 * with the old and the new sentence side by side and a one-section
 * re-generate. The ledger is `data/watch-changes.json`, appended by the
 * watch when it applies an item; the matching is pure and runs over the
 * stored document models, never over register text and never through the
 * model.
 */
import { z } from "zod";
import watchChangesJson from "../../../data/watch-changes.json";

export const WatchChange = z
  .object({
    id: z.string().regex(/^wc-\d{4}-\d{2}-\d{2}-\d{2}$/),
    /** The day the change entered the generator; documents drafted on or after it carry it. */
    appliedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    where: z.enum(["fixed-text", "brief", "standards"]),
    documentTypeIds: z.array(z.string().min(1)).min(1),
    /** The section the sentence lives in, or null when it may be anywhere in the document. */
    sectionId: z.string().min(1).nullable(),
    oldSentence: z.string().min(1).nullable(),
    newSentence: z.string().min(1),
    why: z.string().min(1),
    source: z.string().min(1),
    watchReport: z.string().min(1),
  })
  .strict();
export type WatchChange = z.infer<typeof WatchChange>;

const Ledger = z.object({
  $comment: z.string(),
  changes: z.array(WatchChange),
});

let cached: WatchChange[] | null = null;
export function loadWatchChanges(): WatchChange[] {
  if (!cached) cached = Ledger.parse(watchChangesJson).changes;
  return cached;
}

export type DocumentForReview = {
  typeId: string;
  /** The stored version's ISO creation time; the day decides whether it predates a change. */
  createdAt: string;
  /** Section id to its text, from the stored model (fixed and tailored alike). */
  sections: { id: string; text: string }[];
};

export type ReviewNeeded = {
  changeId: string;
  sectionId: string | null;
  where: WatchChange["where"];
  oldSentence: string | null;
  newSentence: string;
  why: string;
  source: string;
  appliedOn: string;
  /** "certain" when the old sentence is still in the text; "likely" when only the date says so. */
  certainty: "certain" | "likely";
};

function sameOrAfter(createdAt: string, appliedOn: string): boolean {
  return createdAt.slice(0, 10) >= appliedOn;
}

/** The changes a stored document still needs reviewed for: in scope, drafted before the change, not carrying the new sentence, not yet checked. */
export function changesForDocument(
  doc: DocumentForReview,
  changes: readonly WatchChange[],
  reviewedChangeIds: ReadonlySet<string> = new Set(),
): ReviewNeeded[] {
  const out: ReviewNeeded[] = [];
  for (const c of changes) {
    if (!c.documentTypeIds.includes(doc.typeId)) continue;
    if (reviewedChangeIds.has(c.id)) continue;
    if (sameOrAfter(doc.createdAt, c.appliedOn)) continue;
    const texts = c.sectionId
      ? doc.sections.filter((s) => s.id === c.sectionId).map((s) => s.text)
      : doc.sections.map((s) => s.text);
    // A scoped section that does not exist in this document (an outline difference) is not a finding.
    if (c.sectionId && texts.length === 0) continue;
    const joined = texts.join("\n");
    if (joined.includes(c.newSentence)) continue;
    out.push({
      changeId: c.id,
      sectionId: c.sectionId,
      where: c.where,
      oldSentence: c.oldSentence,
      newSentence: c.newSentence,
      why: c.why,
      source: c.source,
      appliedOn: c.appliedOn,
      certainty:
        c.oldSentence && joined.includes(c.oldSentence) ? "certain" : "likely",
    });
  }
  return out;
}

/** The one-line explanation of a change for the register and the document page. */
export function describeChange(r: ReviewNeeded): string {
  const where =
    r.where === "fixed-text"
      ? "the fixed text"
      : r.where === "brief"
        ? "what this section is asked to say"
        : "the standards it cites";
  return r.oldSentence
    ? `Since ${r.appliedOn}, ${where} replaces one sentence. ${r.why}`
    : `Since ${r.appliedOn}, ${where} includes a new sentence. ${r.why}`;
}

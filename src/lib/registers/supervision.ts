/**
 * Supervision rows (REQ-024 Session C, FR-11; D-2829, D-2833; finding 78):
 * the history behind the staff row's one date. Three kinds: a supervision
 * session, a probation review and a recorded conversation. A supervision or
 * a conversation carries a note of what was covered, never how the worker
 * performed and never a word about a participant; a probation review
 * carries an outcome code and no note (a performance note is out of scope
 * while the lawyer's finding 40(b) is open). Every kind sets
 * `staff_matrix.last_supervision_on` through the table's trigger (D-2829),
 * so the `supervision-due` reminder reads one date. Pure: the form, the
 * words and the derivations; nothing here reads the clock.
 */
import { z } from "zod";
import { strictObject, text } from "@/lib/validation";
import { AUDIT_DAY_REF_PATTERNS } from "./audit-day-types";
import { dateField, refField } from "./forms";
import { formatLongDay } from "./state-facts";
import { NDIS_NUMBER_SHAPE, REF_PATTERNS } from "./types";

export const SUPERVISION_KINDS = [
  "supervision",
  "probation-review",
  "conversation",
] as const;
export type SupervisionKind = (typeof SUPERVISION_KINDS)[number];

export const SUPERVISION_KIND_LABELS: Record<SupervisionKind, string> = {
  supervision: "Supervision session",
  "probation-review": "Probation review",
  conversation: "Recorded conversation",
};

export const PROBATION_OUTCOMES = ["continued", "extended", "ended"] as const;
export type ProbationOutcome = (typeof PROBATION_OUTCOMES)[number];

export const PROBATION_OUTCOME_LABELS: Record<ProbationOutcome, string> = {
  continued: "Probation continued",
  extended: "Probation extended",
  ended: "Probation ended",
};

/** The note's cap, the same as the table's CHECK. */
export const SUPERVISION_NOTE_MAX = 500;

/** D-2833: the lawyer role's helper under the note; the participant warning sits beside it. */
export const SUPERVISION_NOTE_HELP =
  "What was covered and what was agreed, not how the worker performed. No health information and nothing about a complaint; a complaint goes in its register.";

/** The line above the history (D-2829): every kind counts for the reminder, and the kind is shown. */
export const SUPERVISION_INTRO =
  "Every entry here, whatever its kind, is the supervision contact your reminder counts from; the history shows which kind each was.";

export const SUPERVISION_FUTURE_MESSAGE =
  "The date cannot be after today; record a session once it has happened.";
export const PROBATION_NEEDS_OUTCOME = "Choose how the probation review ended";
export const PROBATION_NO_NOTE =
  "A probation review records its outcome and no note";
export const OUTCOME_ONLY_FOR_REVIEW =
  "An outcome belongs to a probation review alone";

const note = text(SUPERVISION_NOTE_MAX).refine(
  (v) => !NDIS_NUMBER_SHAPE.test(v),
  "This looks like an NDIS participant number. Use a reference code instead.",
);

/**
 * One entry as the owner's form sends it (FR-11). The server adds the
 * account and checks the date against the Sydney day; the kind decides
 * which of note and outcome may be set.
 */
export const SupervisionEntryForm = strictObject({
  workerRef: refField(REF_PATTERNS.worker, "W-003"),
  kind: z.enum(SUPERVISION_KINDS, { error: "Choose the kind of entry" }),
  heldOn: dateField("day it was held"),
  byRef: refField(AUDIT_DAY_REF_PATTERNS.staff, "KP-1 or W-002"),
  note: note.default(""),
  outcome: z
    .union([z.literal(""), z.enum(PROBATION_OUTCOMES)])
    .default("")
    .transform((v) => (v === "" ? null : v)),
}).superRefine((v, ctx) => {
  if (v.kind === "probation-review") {
    if (!v.outcome)
      ctx.addIssue({
        code: "custom",
        path: ["outcome"],
        message: PROBATION_NEEDS_OUTCOME,
      });
    if (v.note !== "")
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: PROBATION_NO_NOTE,
      });
  } else if (v.outcome) {
    ctx.addIssue({
      code: "custom",
      path: ["outcome"],
      message: OUTCOME_ONLY_FOR_REVIEW,
    });
  }
});
export type SupervisionEntryValues = z.input<typeof SupervisionEntryForm>;
export type SupervisionEntryParsed = z.output<typeof SupervisionEntryForm>;

/** The day cannot be after today (both ISO days; a lexical compare is a date compare). */
export function heldOnAfterToday(heldOn: string, today: string): boolean {
  return heldOn > today;
}

export type SupervisionEntryLike = {
  kind: SupervisionKind | string;
  held_on: string;
  by_ref: string;
  note: string;
  outcome: ProbationOutcome | string | null;
};

/** FR-11: the latest `held_on` of any kind, the date the row and the reminder carry (D-2829); null with no entry. */
export function latestHeldOn(
  entries: readonly Pick<SupervisionEntryLike, "held_on">[],
): string | null {
  let last: string | null = null;
  for (const e of entries)
    if (last === null || e.held_on > last) last = e.held_on;
  return last;
}

/** The history's order: newest first, then by kind for two on one day. */
export function sortEntries<T extends SupervisionEntryLike>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (a, b) =>
      b.held_on.localeCompare(a.held_on) || a.kind.localeCompare(b.kind),
  );
}

export function kindLabel(kind: string): string {
  return SUPERVISION_KIND_LABELS[kind as SupervisionKind] ?? kind;
}

export function outcomeLabel(outcome: string | null): string {
  return outcome
    ? (PROBATION_OUTCOME_LABELS[outcome as ProbationOutcome] ?? outcome)
    : "";
}

/** One history line: the kind, the day in words and the supervisor's code; the outcome for a review. */
export function supervisionEntryLine(e: SupervisionEntryLike): string {
  const head = `${kindLabel(e.kind)} on ${formatLongDay(e.held_on)} with ${e.by_ref}`;
  return e.kind === "probation-review" && e.outcome
    ? `${head}: ${outcomeLabel(e.outcome).toLowerCase()}`
    : head;
}

/** The trail's note (words and a date, never a uuid or the note's text): "supervision on 2026-10-18 by KP-1". */
export function supervisionTrailNote(
  e: Pick<SupervisionEntryLike, "kind" | "held_on" | "by_ref">,
): string {
  return `${e.kind} on ${e.held_on} by ${e.by_ref}`;
}

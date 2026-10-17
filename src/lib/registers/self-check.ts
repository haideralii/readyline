/**
 * The quarterly self-check, "Check my systems" (REQ-020 FR-9): one
 * question in plain words per record on the audit-day list, answered yes
 * or no with an optional note; every "no" becomes an improvement row with
 * the source `self-check` and a due date 30 days out. Pure rules: the
 * questions, when a walk is due, and the rows a walk's answers produce.
 * The questions are a Dev draft for the PO (D-2236).
 */
import { AUDIT_DAY_RECORDS } from "./names";
import { formatLongDate } from "./status";

export const SELF_CHECK_MONTHS = 3;
export const SELF_CHECK_FINDING_DAYS = 30;

/** The question for each record on the audit-day list, under 30 words each (D-2219); the PO's words, 15 Oct 2026. */
export const SELF_CHECK_QUESTIONS: Record<string, string> = {
  "document-control":
    "Is every policy in the document control register adopted, dated and not past its review date?",
  decisions:
    "Is every decision you made this quarter written down, with the date and who made it?",
  "corporate-risks":
    "Does every corporate risk have what you do about it and a review date that is not past?",
  "participant-risks":
    "Does every participant you support have a risk row that is up to date?",
  "conflicts-of-interest":
    "Have you asked about conflicts this quarter and recorded any, with a review date?",
  delegations:
    "Does the delegations register say who acts for you when you are away, and is it still right?",
  hazards:
    "Is every hazard you know of in the hazard register, with what you did and a review date?",
  // REQ-023 FR-10 (Session D): a Dev-2 draft for the PO, as D-2236's questions were.
  "commission-changes":
    "Is every change you told the Commission about this quarter in the changes register, with the date you told them?",
  insurances:
    "Is every insurance certificate current, and is each expiry date in the register?",
  improvements:
    "Did every incident, complaint and piece of feedback this quarter get an improvement row?",
  "staff-matrix":
    "Does every worker have their screening, training, supervision and appraisal dates in the matrix?",
  onboarding:
    "Does every worker and participant who started this quarter have a signed onboarding checklist?",
  incidents:
    "Is every incident this quarter in the register, with what you did next, and were the reportable ones notified in time?",
  complaints:
    "Is every complaint this quarter in the register, acknowledged and resolved, with the dates?",
};

export type SelfCheckAnswer = { answer: "yes" | "no"; note: string };
export type SelfCheckAnswers = Record<string, SelfCheckAnswer>;

/** The record ids the walk asks about: the audit-day list, in its order. */
export function selfCheckRecordIds(): string[] {
  return AUDIT_DAY_RECORDS.map((r) => r.id);
}

/* ---------- REQ-023 Session C (FR-8; D-2309, D-2342): the rehearsal ---------- */

export const SELF_CHECK_MODES = ["walk", "rehearsal"] as const;
export type SelfCheckMode = (typeof SELF_CHECK_MODES)[number];

/** The mid-term variant's opening question (s 13B(5); finding 46), a pseudo-record ahead of the list. */
export const CORRECTIVE_ACTION_ID = "corrective-action-plan";
export const CORRECTIVE_ACTION_QUESTION =
  "Do you have the corrective action plan from your last audit and the Commissioner's notice, if any?";
export const CORRECTIVE_ACTION_NAME =
  "Your last audit's corrective action plan and the Commissioner's notice";

/**
 * The mid-term variant leads with the governance and operational management
 * records (the mid-term audit assesses the Part 3 standards, s 13B(5)): the
 * records the standards name first, in the list's order, then the rest.
 */
export const GOVERNANCE_FIRST_IDS: readonly string[] = [
  "document-control",
  "decisions",
  "corporate-risks",
  "conflicts-of-interest",
  "delegations",
  "insurances",
  "staff-matrix",
];

export type RehearsalVariant = "renewal" | "mid-term";

/** The records a rehearsal walks, in the variant's order; the mid-term variant opens with the corrective-action question. */
export function rehearsalRecordIds(variant: RehearsalVariant): string[] {
  const ids = selfCheckRecordIds();
  if (variant === "renewal") return ids;
  const first = GOVERNANCE_FIRST_IDS.filter((id) => ids.includes(id));
  return [
    CORRECTIVE_ACTION_ID,
    ...first,
    ...ids.filter((id) => !first.includes(id)),
  ];
}

/** A rehearsal asks the walk's question with "this quarter" read as "in this period" (FR-8). */
export function rehearsalQuestion(id: string): string {
  if (id === CORRECTIVE_ACTION_ID) return CORRECTIVE_ACTION_QUESTION;
  return (SELF_CHECK_QUESTIONS[id] ?? "").replace(
    /this quarter/g,
    "in this period",
  );
}

/** The question for a record in either mode. */
export function questionFor(id: string, mode: SelfCheckMode): string {
  return mode === "rehearsal"
    ? rehearsalQuestion(id)
    : (SELF_CHECK_QUESTIONS[id] ?? "");
}

/** The sheet's heading, the owner's own words (D-2309): "Our own working note, 20 September 2028". */
export function rehearsalHeading(walkedOn: string): string {
  return `Our own working note, ${formatLongDate(walkedOn)}`;
}

/** The pack's file name for the rehearsal sheet (FR-8; D-2207: CSV, no PDF path). */
export function rehearsalFileName(walkedOn: string): string {
  return `rehearsal-${walkedOn}.csv`;
}

export const REHEARSAL_SHEET_COLUMNS = [
  "record",
  "question",
  "answer",
  "note",
] as const;

/** The sheet: one row per question, what is missing first ("no" rows), then the rest; codes, never names. */
export function rehearsalSheetRows(
  answers: SelfCheckAnswers,
  variant: RehearsalVariant,
): Record<string, string>[] {
  const names = new Map(AUDIT_DAY_RECORDS.map((r) => [r.id, r.name]));
  names.set(CORRECTIVE_ACTION_ID, CORRECTIVE_ACTION_NAME);
  const rows = rehearsalRecordIds(variant)
    .filter((id) => answers[id])
    .map((id) => ({
      record: names.get(id) ?? id,
      question: rehearsalQuestion(id),
      answer: answers[id].answer,
      note: answers[id].note,
    }));
  return [
    ...rows.filter((r) => r.answer === "no"),
    ...rows.filter((r) => r.answer !== "no"),
  ];
}

/** The rehearsal's closing line: what is missing, where the sheet is, and where it is not (D-2309). */
export function rehearsalSummary(missing: number, walkedOn: string): string {
  const gaps =
    missing === 0
      ? "Nothing missing."
      : `${missing} ${missing === 1 ? "thing is" : "things are"} missing.`;
  return `${gaps} Your working note is saved as ${rehearsalFileName(walkedOn)} in your own audit pack; it is not in an auditor link's pack unless you tick that when you create the link on the account page. Nothing was written to your improvement register.`;
}

export function addMonthsIso(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** When the next walk is due: three months after the last, or today when there has never been one. */
export function nextSelfCheckOn(
  lastWalkedOn: string | null,
  today: string,
): string {
  return lastWalkedOn ? addMonthsIso(lastWalkedOn, SELF_CHECK_MONTHS) : today;
}

/** The audit-day page's offer: due, or not yet, in one line; always available on demand. */
export function selfCheckOffer(input: {
  lastWalkedOn: string | null;
  lastFindings: number;
  openFindings: number;
  today: string;
}): { due: boolean; line: string } {
  const next = nextSelfCheckOn(input.lastWalkedOn, input.today);
  if (!input.lastWalkedOn)
    return {
      due: true,
      line: "You have not checked your systems yet. It takes about ten minutes.",
    };
  const findings =
    input.openFindings === 0
      ? "nothing open from it"
      : `${input.openFindings} ${input.openFindings === 1 ? "finding" : "findings"} still open`;
  return next <= input.today
    ? {
        due: true,
        line: `Last checked ${input.lastWalkedOn}, ${findings}. The next check is due.`,
      }
    : {
        due: false,
        line: `Last checked ${input.lastWalkedOn}, ${findings}. Next due ${next}.`,
      };
}

export type FindingRow = {
  source_kind: "self-check";
  source_ref: string;
  learned: string;
  changed: string;
  owner_role: string;
  due_on: string;
};

/** The improvement rows a walk's "no" answers produce (FR-9). */
export function findingsFrom(
  answers: SelfCheckAnswers,
  walkedOn: string,
): FindingRow[] {
  return selfCheckRecordIds()
    .filter((id) => answers[id]?.answer === "no")
    .map((id) => {
      const name = AUDIT_DAY_RECORDS.find((r) => r.id === id)?.name ?? id;
      const note = answers[id].note.trim();
      return {
        source_kind: "self-check",
        source_ref: `Check ${walkedOn}`,
        learned:
          `${name}: the self-check answer was no.${note ? ` ${note}` : ""}`.slice(
            0,
            500,
          ),
        changed: "To decide: what we change so the answer is yes next quarter.",
        owner_role: "Owner",
        due_on: addDaysIso(walkedOn, SELF_CHECK_FINDING_DAYS),
      };
    });
}

/** The walk's closing line. */
export function walkSummary(findings: number, walkedOn: string): string {
  const next = nextSelfCheckOn(walkedOn, walkedOn);
  return findings === 0
    ? `No findings. The next check is due ${next}.`
    : `${findings} ${findings === 1 ? "finding is" : "findings are"} in your improvement register, due in ${SELF_CHECK_FINDING_DAYS} days. The next check is due ${next}.`;
}

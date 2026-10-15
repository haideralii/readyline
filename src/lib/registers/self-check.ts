/**
 * The quarterly self-check, "Check my systems" (REQ-020 FR-9): one
 * question in plain words per record on the audit-day list, answered yes
 * or no with an optional note; every "no" becomes an improvement row with
 * the source `self-check` and a due date 30 days out. Pure rules: the
 * questions, when a walk is due, and the rows a walk's answers produce.
 * The questions are a Dev draft for the PO (D-2236).
 */
import { AUDIT_DAY_RECORDS } from "./names";

export const SELF_CHECK_MONTHS = 3;
export const SELF_CHECK_FINDING_DAYS = 30;

/** The question for each record id; the hazard register joins the twelve (FR-7). */
export const SELF_CHECK_QUESTIONS: Record<string, string> = {
  "document-control":
    "Is every policy in the document control register adopted, dated and inside its review date?",
  decisions:
    "Is every decision you made this quarter written down, with the date and who made it?",
  "corporate-risks":
    "Does every corporate risk have what you do about it and a review date that is not past?",
  "participant-risks":
    "Does every participant you support have a risk row that is current?",
  "conflicts-of-interest":
    "Have you asked about conflicts this quarter and recorded any, with a review date?",
  delegations:
    "Does the delegations register say who acts for you when you are away, and is it still right?",
  hazards:
    "Is every hazard you know of in the hazard register, with what you did and a review date?",
  insurances:
    "Is every insurance certificate current, and is each expiry date in the register?",
  improvements:
    "Did every incident, complaint and piece of feedback this quarter lead to an improvement row?",
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

/** The record ids the walk asks about, in the audit-day order, the hazard register after the delegations. */
export function selfCheckRecordIds(): string[] {
  const ids = AUDIT_DAY_RECORDS.map((r) => r.id);
  const at = ids.indexOf("delegations");
  return [...ids.slice(0, at + 1), "hazards", ...ids.slice(at + 1)];
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
      const record = AUDIT_DAY_RECORDS.find((r) => r.id === id);
      const name = record?.name ?? "Hazard register";
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

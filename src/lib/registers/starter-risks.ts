/**
 * Starter rows for the corporate risk register (REQ-018 FR-1; D-1903): one
 * plain-words row per risk area, drawn from the questionnaire answers so a
 * sole trader never faces an empty table. Every row is marked `starter`
 * and the page says "check this and change it". Pure: answers and result
 * in, rows out; the copy lint runs over every sentence in the unit test.
 */
import { STATE_NAMES, STRUCTURE_LABELS } from "@/lib/generator/facts";
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import { addMonths } from "./reminders";
import { RISK_AREAS, type Likelihood, type RiskArea } from "./audit-day-types";

export type StarterRisk = {
  area: RiskArea;
  what_could_happen: string;
  likelihood: Likelihood;
  controls: string;
  owner_role: string;
  review_on: string;
  starter: true;
};

/** Six months from the day the register is first opened, so the first review is before the mid-term audit's preparation window. */
export const STARTER_REVIEW_MONTHS = 6;

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function starterCorporateRisks(
  answers: QuestionnaireAnswers,
  result: QuestionnaireResult,
  today: string,
): StarterRisk[] {
  const states = list(answers.business.states.map((s) => STATE_NAMES[s] ?? s));
  const structure = STRUCTURE_LABELS[answers.business.structure];
  const sole = answers.workforce.workerCount === 1;
  const owner =
    answers.business.structure === "sole-trader" ? "Owner" : "Director";
  const workers = sole
    ? "I am the only worker"
    : `we have ${answers.workforce.workerCount} workers`;
  const certification = result.pathway === "certification";
  const restrictive = answers.practices.restrictivePractices !== "no";
  const review_on = addMonths(today, STARTER_REVIEW_MONTHS);
  const rows: Record<
    RiskArea,
    Omit<StarterRisk, "area" | "review_on" | "starter">
  > = {
    "emergency-and-disaster": {
      what_could_happen: `A fire, flood, storm or power cut in ${states} stops a visit or a whole day of supports.`,
      likelihood: "medium",
      controls:
        "Our emergency and disaster management plan says who we call and how supports continue. We run a drill every six months and note it in the record of decisions.",
      owner_role: owner,
    },
    "participant-related": {
      what_could_happen:
        "A participant is harmed during a support, or a change in their needs is missed because the support plan is out of date.",
      likelihood: certification ? "medium" : "low",
      controls:
        "Each participant has a row in the participant risk register with a review date. Incidents go in the incident register the same day, and reportable ones reach the Commission in time.",
      owner_role: owner,
    },
    compliance: {
      what_could_happen: `We miss a reportable incident deadline, a complaint sits unanswered, or a worker's screening clearance lapses${restrictive ? ", or a restrictive practice is used without authorisation" : ""}.`,
      likelihood: "medium",
      controls:
        "The registers send reminders before each date. The owner checks the registers page each week and the policy review dates each quarter.",
      owner_role: owner,
    },
    "people-and-staffing": {
      what_could_happen: sole
        ? "I am sick or away and nobody can deliver the supports or answer a participant."
        : `A worker leaves or is away at short notice and ${workers}, so a shift cannot be covered.`,
      likelihood: sole ? "high" : "medium",
      controls: sole
        ? "The continuity of supports plan names who covers me and how participants are told. The delegations register says who may act for me."
        : "The delegations register names a backup for each key role. The staff matrix shows who is trained and screened for each role, so cover is found quickly.",
      owner_role: owner,
    },
    "organisational-sustainability": {
      what_could_happen: `A ${structure} with ${sole ? "one worker" : `${answers.workforce.workerCount} workers`} loses a main participant or a funding stream and cannot meet its costs.`,
      likelihood: "medium",
      controls:
        "We review income and costs each quarter, keep three months of costs in reserve where we can, and tell participants early if a support must end.",
      owner_role: owner,
    },
    governance: {
      what_could_happen:
        "Decisions are made without a record, or a policy is changed and workers are not told.",
      likelihood: "medium",
      controls:
        "Every decision goes in the record of decisions. The document control register shows each policy's version and who was told. Policies are reviewed every 12 months.",
      owner_role: owner,
    },
    finance: {
      what_could_happen:
        "A claim is made for a support that was not delivered, or claim records cannot be found when asked for.",
      likelihood: "low",
      controls:
        "Claims match the support notes and the service agreement. We keep claim and payment records for seven years. One person approves payments and a backup is named in the delegations register.",
      owner_role: owner,
    },
    "legislation-change": {
      what_could_happen: `The Practice Standards, the Rules or a ${states} law changes and our policies no longer match${certification ? "; the mid-term audit finds the gap" : ""}.`,
      likelihood: "medium",
      controls:
        "We read the Commission's provider updates each month and review the affected policy within 30 days of a change. The policy review register tracks each review.",
      owner_role: owner,
    },
    "data-and-privacy": {
      what_could_happen:
        "Participant records are lost, seen by the wrong person, or typed into an AI tool or a public website.",
      likelihood: "medium",
      controls:
        "Records live in one place with a password and a backup. Nobody puts participant details into an AI tool. A privacy mistake goes in the incident register the same day.",
      owner_role: owner,
    },
  };
  return RISK_AREAS.map((area) => ({
    area,
    ...rows[area],
    review_on,
    starter: true,
  }));
}

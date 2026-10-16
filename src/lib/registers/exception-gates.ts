/**
 * The s 14 exception's gates (REQ-024 FR-4; D-2403, D-2412, D-2426 as
 * amended, D-2439; findings 35, 45, 70, 71, 119, 133, 137, 149, 151, 162,
 * 167, 187, 190 and 208): a pure function over the worker's rows, the
 * account's cleared workers, the procedure's adopted version and the
 * participant risk register, with the request's Sydney `today` (D-2242).
 * It says whether the option is offered and, when it is not, why, one line
 * per gate in FR-4's order; when it is, the four lines the owner reads with
 * their date fields. The state facts come through an adapter so the tests
 * run over a fixture in place of `data/state-reference.json` (D-2404).
 *
 * The product never offers "start without a check" (D-2403), never names
 * an escape from the s 14A bar (D-2426), and never says a worker is ready
 * (D-2411).
 */
import {
  CHECK_YOUR_UNIT,
  formatLongDay,
  part4FactsFor,
  screeningFactsFor,
  type Part4Facts,
  type ScreeningFacts,
} from "./state-facts";
import { daysBetween } from "./status";
import { TYPE_THE_STATES_FIRST } from "./worker-state";

export type StateFactsAdapter = {
  screening: (code: string, today: string) => ScreeningFacts | null;
  part4: (code: string, today: string) => Part4Facts;
};

/** The file-backed adapter the product uses. */
export const FILE_FACTS: StateFactsAdapter = {
  screening: screeningFactsFor,
  part4: part4FactsFor,
};

/** Another worker's `ndis-worker-screening` row, as the candidate supervisor. */
export type SupervisorCandidate = {
  worker_ref: string;
  issued_on: string | null;
  expires_on: string | null;
  verified_in_database_on: string | null;
  decision_code: string | null;
};

export type ExceptionGateInput = {
  workerRef: string;
  /** The states this worker works in (FR-1). */
  states: readonly string[];
  /** The owner's own row: s 14(2)(a) and s 15(3)(aa)(ii) word the lines (findings 35 and 137). */
  ownRow: boolean;
  /** The worker's pending `ndis-worker-screening` row: the state it was submitted in and the number (finding 109). */
  application: {
    state: string | null;
    application_number: string | null;
  } | null;
  /** The account's other `ndis-worker-screening` rows, candidates to supervise (gate i). */
  candidates: readonly SupervisorCandidate[];
  /** The s 15(2)(a) and (b) tick (gate iv). */
  declarationTicked: boolean;
  /** The newest version of the procedure with `adopted_on` set that carries the Division 3 section (FR-4a). */
  plan: { versionNumber: number; adoptedOn: string } | null;
  /** The participant risk register's row count and last-reviewed date (FR-4a, finding 158). */
  registerRowCount: number;
  registerDate: string | null;
  today: string;
  facts?: StateFactsAdapter;
};

export type ExceptionLines = {
  confirmed: string;
  supervised: string;
  plan: string;
  states: string;
};

export type ExceptionGate = {
  offered: boolean;
  /** Why the option is absent, one line per gate in FR-4's order; empty when offered. */
  reasons: string[];
  /** The codes of the cleared workers who may supervise (gate i), empty when none. */
  supervisors: string[];
  /** The four lines of FR-4 with `<date>` where the owner types a date; present whether or not the option is offered, so the screen can show what it would record. */
  lines: ExceptionLines;
};

export const SUPERVISOR_LINE =
  "Readyline can only record this exception with a cleared supervisor who is in your account";
export const SUPERVISOR_SOURCE =
  "Worker Screening Rules s 14(1)(a)(ii): \"appropriately supervised by a person with a clearance\" (the product's limit, not the Rule's)";
export const OWN_ROW_SUPERVISOR_LINE =
  "(Worker Screening Rules s 14(2)(a) needs a person with a clearance to supervise you)";
export const DECLARATION_LINE =
  "this person has told us in writing that they have not been excluded on an earlier application and have not had a clearance revoked (Worker Screening Rules s 15(2)(a) and (b)); we keep that declaration in the HR file";
export const DECLARATION_ASK =
  "The written declaration is the worker's own and is kept with the s 18(4) copies; a later exclusion the database shows is the unit's record, not a contradiction of yours.";
export const RECORD_APPLICATION_FIRST =
  "record the application first: the unit's written notice, the application number and the state it was submitted in";
export const PLAN_MISSING_LINE =
  "the worker screening and recruitment procedure has no adopted version that carries the Division 3 risk management plan yet; update the procedure and adopt it first";
export const REGISTER_EMPTY_LINE =
  "the participant risk register has no rows; the plan is complete only with them (Worker Screening Rules s 12(2)(a))";

const isExpired = (expiresOn: string | null, today: string) =>
  expiresOn !== null && daysBetween(expiresOn, today) > 0;

/** Gate (i), finding 151: issued, verified in the database, undecided and unexpired at `today`, and not the worker's own row. */
export function clearedSupervisors(
  candidates: readonly SupervisorCandidate[],
  workerRef: string,
  today: string,
): string[] {
  return [
    ...new Set(
      candidates
        .filter(
          (c) =>
            c.worker_ref !== workerRef &&
            c.issued_on !== null &&
            Boolean(c.verified_in_database_on) &&
            !c.decision_code &&
            !isExpired(c.expires_on, today),
        )
        .map((c) => c.worker_ref),
    ),
  ].sort();
}

/** "New South Wales: the text" becomes "the text"; the line's own prefix is composed here. */
function wording(facts: ScreeningFacts, line: string): string {
  const prefix = `${facts.name}: `;
  return line.startsWith(prefix) ? line.slice(prefix.length) : line;
}

function stateName(facts: ScreeningFacts | null, code: string): string {
  return facts?.name ?? code;
}

export function exceptionGate(input: ExceptionGateInput): ExceptionGate {
  const facts = input.facts ?? FILE_FACTS;
  const reasons: string[] = [];
  const today = input.today;

  // The pending application row comes first: its state is gate (ii)'s input.
  if (!input.application) reasons.push(RECORD_APPLICATION_FIRST);

  // (i) a cleared supervisor in the account.
  const supervisors = clearedSupervisors(
    input.candidates,
    input.workerRef,
    today,
  );
  if (supervisors.length === 0)
    reasons.push(
      input.ownRow
        ? `${SUPERVISOR_LINE} ${OWN_ROW_SUPERVISOR_LINE}`
        : SUPERVISOR_LINE,
    );

  // (ii) the application state under s 14A, with the Part 4 line per state served and no escape.
  const appState = input.application?.state ?? null;
  const appFacts = appState ? facts.screening(appState, today) : null;
  let appliedLine = "";
  if (appState) {
    const name = stateName(appFacts, appState);
    if (!appFacts || appFacts.applicationProhibitsPending === null) {
      appliedLine = `applied in ${name}: ${CHECK_YOUR_UNIT}`;
      reasons.push(appliedLine);
    } else if (appFacts.applicationProhibitsPending) {
      const part4 = input.states.map((code) => {
        const f = facts.screening(code, today);
        return `${stateName(f, code)}: ${facts.part4(code, today).line}`;
      });
      appliedLine = `applied in ${name}: ${wording(appFacts, appFacts.prohibitsLine)}`;
      reasons.push([appliedLine, ...part4].join("; "));
    } else {
      appliedLine = `applied in ${name}: ${wording(appFacts, appFacts.prohibitsLine)}`;
    }
  }

  // (iii) every state served under s 14(1)(a)(iv).
  const workLines: string[] = [];
  if (input.states.length === 0) reasons.push(TYPE_THE_STATES_FIRST);
  for (const code of input.states) {
    const f = facts.screening(code, today);
    const name = stateName(f, code);
    if (!f || f.pendingWorkAllowed === null) {
      const line = `${name}: ${CHECK_YOUR_UNIT}`;
      workLines.push(line);
      reasons.push(line);
    } else {
      const line = `${name}: ${wording(f, f.pendingLine)}`;
      workLines.push(line);
      if (!f.pendingWorkAllowed) reasons.push(line);
    }
  }

  // (iv) the declaration tick.
  if (!input.declarationTicked) reasons.push(DECLARATION_LINE);

  // FR-4a: the adopted version that carries the plan, over a register with rows.
  if (!input.plan) reasons.push(PLAN_MISSING_LINE);
  if (input.registerRowCount === 0) reasons.push(REGISTER_EMPTY_LINE);

  const number = input.application?.application_number ?? "<number>";
  const confirmed = input.ownRow
    ? `we confirmed to the unit that the applicant is the provider (s 15(3)(aa)(ii)) in the NDIS Worker Screening Database on <date>; the unit's written notice seen on <date>; application number ${number} recorded in Readyline on <date>`
    : `we confirmed this application to the unit in the NDIS Worker Screening Database (s 15(3)(aa) and (4)) on <date>; the unit's written notice seen on <date>; application number ${number} recorded in Readyline on <date>`;
  const supervised = "supervised by <worker code> (holds a current clearance)";
  const plan = input.plan
    ? `our Division 3 risk management plan, version ${input.plan.versionNumber} adopted ${formatLongDay(input.plan.adoptedOn)}, with the participant risk register current to ${input.registerDate ? formatLongDay(input.registerDate) : "<date>"}`
    : "our Division 3 risk management plan, version <n> adopted <date>, with the participant risk register current to <date>";
  const states = `${appliedLine || `applied in <state>: ${CHECK_YOUR_UNIT}`}; works in ${input.states.length ? input.states.join(", ") : "<states>"}: ${workLines.join("; ") || CHECK_YOUR_UNIT}`;

  return {
    offered: reasons.length === 0,
    reasons,
    supervisors,
    lines: { confirmed, supervised, plan, states },
  };
}

/** The `exception-started` event's note (D-2428, D-2434; findings 174 and 185): the version and the dates in words, never a uuid. */
export function exceptionStartedNote(input: {
  versionNumber: number;
  adoptedOn: string;
  registerDate: string;
}): string {
  return `version ${input.versionNumber}, adopted ${formatLongDay(input.adoptedOn)}; register current to ${formatLongDay(input.registerDate)}`;
}

export const END_CODES = [
  "clearance-issued",
  "excluded",
  "interim-bar",
  "supervision-stopped",
  "plan-stopped",
  "withdrawn",
  "closed",
  "supervisor-clearance-expired",
] as const;
export type EndCode = (typeof END_CODES)[number];

export const END_CODE_LABELS: Record<EndCode, string> = {
  "clearance-issued": "the clearance was issued (s 15(1))",
  excluded: "the unit made an exclusion (s 15(1))",
  "interim-bar": "the unit imposed an interim bar (s 15(2)(e))",
  "supervision-stopped": "supervision stopped (s 15(2)(f))",
  "plan-stopped":
    "the risk management plan stopped being implemented (s 15(2)(g))",
  withdrawn: "the application was withdrawn (s 15(2)(c))",
  closed: "the application was closed (s 15(2)(d))",
  "supervisor-clearance-expired":
    "the supervisor's own clearance expired or was suspended (s 15(2)(f))",
};

/** The `exception-ended` event's note: the code's words and the date in words (finding 174). */
export function exceptionEndedNote(code: EndCode, endedOn: string): string {
  return `${END_CODE_LABELS[code]} on ${formatLongDay(endedOn)}`;
}

export const PART4_CODES = ["s14-1b", "s14-2b"] as const;
export const GATED_CODES = ["s14-1a", "s14-2a"] as const;
export const EXCEPTION_CODES = [
  "s14-1a",
  "s14-1b",
  "s14-1c",
  "s14-2a",
  "s14-2b",
] as const;
export type ExceptionCode = (typeof EXCEPTION_CODES)[number];

/** The last day a Part 4 row may start, for every state (D-2439 as amended; the database CHECK's one date). */
export const PART4_LAST_START = "2026-01-31";
export const PART4_AFTER_MESSAGE =
  "no Part 4 arrangement applies after 31 January 2026";
export const PART4_VIC_HELP =
  "Victoria's s 25(5)(d)(iii) has no end date in the Rules' text and whether anyone can still meet it is unverified; Readyline does not record a Part 4 arrangement started after 31 January 2026; ask your lawyer.";

import { describe, expect, it } from "vitest";
import {
  DECLARATION_LINE,
  OWN_ROW_SUPERVISOR_LINE,
  PLAN_MISSING_LINE,
  RECORD_APPLICATION_FIRST,
  REGISTER_EMPTY_LINE,
  SUPERVISOR_LINE,
  clearedSupervisors,
  exceptionEndedNote,
  exceptionGate,
  exceptionStartedNote,
  FILE_FACTS,
  type ExceptionGateInput,
  type StateFactsAdapter,
} from "./exception-gates";
import { CHECK_PART_4, CHECK_YOUR_UNIT } from "./state-facts";
import type { Part4Facts, ScreeningFacts } from "./state-facts";
import { TYPE_THE_STATES_FIRST } from "./worker-state";

/**
 * REQ-024 AC-2's exception cases (today 2026-11-02 fixed, finding 59) over a
 * fixture in place of the state file (D-2404): NSW read as allowing pending
 * work on both tests, VIC and QLD as prohibiting, SA with no live read.
 */
const TODAY = "2026-11-02";

function screening(
  code: string,
  name: string,
  allowed: boolean | null,
  prohibits: boolean | null,
  pendingText: string,
  prohibitsText: string,
): ScreeningFacts {
  return {
    code,
    name,
    pendingWorkAllowed: allowed,
    pendingLine: `${name}: ${pendingText}`,
    applicationProhibitsPending: prohibits,
    prohibitsLine: `${name}: ${prohibitsText}`,
    combinedScheme: "separate",
    combinedLine: "",
    childrenTermYears: 5,
    sources: [],
  };
}

const FIX: Record<string, ScreeningFacts> = {
  NSW: screening(
    "NSW",
    "New South Wales",
    true,
    false,
    "the unit allows a worker to start once the employer has verified the application.",
    "the unit does not prohibit work while a verified application is pending.",
  ),
  VIC: screening(
    "VIC",
    "Victoria",
    false,
    true,
    "no clearance, no start.",
    "no clearance, no start (Worker Screening Act 2020 (Vic)).",
  ),
  QLD: screening(
    "QLD",
    "Queensland",
    false,
    true,
    "a worker can't start work until a clearance has been issued.",
    "a worker can't start work until a clearance has been issued.",
  ),
  SA: screening(
    "SA",
    "South Australia",
    null,
    null,
    `Whether you may start this worker before the clearance arrives depends on your state's law; ${CHECK_YOUR_UNIT}.`,
    `Whether you may start this worker before the clearance arrives depends on your state's law; ${CHECK_YOUR_UNIT}.`,
  ),
};

const PART4: Record<string, Part4Facts> = {
  NSW: {
    live: true,
    section: "23(7)",
    endedOn: "2026-01-31",
    readAt: "2026-10-15",
    line: "no acceptable state check applies after 31 January 2026 (Rules s 23(7), as the Rules read on 15 October 2026); every Part 4 arrangement has ended by its own date, s 29B at the end of 1 February 2024 (s 29B(10))",
  },
  VIC: {
    live: true,
    section: "25(3)",
    endedOn: "2021-01-31",
    readAt: "2026-10-15",
    line: "no acceptable state check applies after 31 January 2021 (Rules s 25(3), as the Rules read on 15 October 2026); every Part 4 arrangement has ended by its own date, s 29B at the end of 1 February 2024 (s 29B(10))",
  },
};

const facts: StateFactsAdapter = {
  screening: (code) => FIX[code] ?? null,
  part4: (code) => PART4[code] ?? { live: false, line: CHECK_PART_4 },
};
const stale: StateFactsAdapter = {
  screening: facts.screening,
  part4: () => ({ live: false, line: CHECK_PART_4 }),
};

const verifiedSupervisor = {
  worker_ref: "W-2",
  issued_on: "2025-03-01",
  expires_on: "2030-03-01",
  verified_in_database_on: "2025-03-02",
  decision_code: null,
};

function base(over: Partial<ExceptionGateInput> = {}): ExceptionGateInput {
  return {
    workerRef: "W-1",
    states: ["NSW"],
    ownRow: false,
    application: { state: "NSW", application_number: "A-55512" },
    candidates: [verifiedSupervisor],
    declarationTicked: true,
    plan: { versionNumber: 3, adoptedOn: "2026-10-20" },
    registerRowCount: 1,
    registerDate: "2026-10-28",
    today: TODAY,
    facts,
    ...over,
  };
}

describe("the s 14 exception's gates (FR-4, AC-2)", () => {
  it("offers the option with the four lines when every gate passes, the third naming the version and its adoption date", () => {
    const g = exceptionGate(base());
    expect(g.offered).toBe(true);
    expect(g.reasons).toEqual([]);
    expect(g.supervisors).toEqual(["W-2"]);
    expect(g.lines.confirmed).toBe(
      "we confirmed this application to the unit in the NDIS Worker Screening Database (s 15(3)(aa) and (4)) on <date>; the unit's written notice seen on <date>; application number A-55512 recorded in Readyline on <date>",
    );
    expect(g.lines.supervised).toBe(
      "supervised by <worker code> (holds a current clearance)",
    );
    expect(g.lines.plan).toBe(
      "our Division 3 risk management plan, version 3 adopted 20 October 2026, with the participant risk register current to 28 October 2026",
    );
    expect(g.lines.states).toBe(
      "applied in New South Wales: the unit does not prohibit work while a verified application is pending.; works in NSW: New South Wales: the unit allows a worker to start once the employer has verified the application.",
    );
  });

  it("is absent with the supervisor line when the second worker's row lacks the database check (findings 151 and 167)", () => {
    const g = exceptionGate(
      base({
        candidates: [{ ...verifiedSupervisor, verified_in_database_on: null }],
      }),
    );
    expect(g.offered).toBe(false);
    expect(g.supervisors).toEqual([]);
    expect(g.reasons).toEqual([SUPERVISOR_LINE]);
  });

  it("is absent with the supervisor line when no second cleared worker exists (finding 119), and the own-row variant names s 14(2)(a) (finding 35)", () => {
    expect(exceptionGate(base({ candidates: [] })).reasons).toEqual([
      SUPERVISOR_LINE,
    ]);
    const own = exceptionGate(base({ candidates: [], ownRow: true }));
    expect(own.reasons).toEqual([
      `${SUPERVISOR_LINE} ${OWN_ROW_SUPERVISOR_LINE}`,
    ]);
    expect(own.lines.confirmed).toContain(
      "we confirmed to the unit that the applicant is the provider (s 15(3)(aa)(ii))",
    );
  });

  it("counts as supervisor only an issued, verified, undecided and unexpired row that is not the worker's own", () => {
    expect(
      clearedSupervisors(
        [
          verifiedSupervisor,
          { ...verifiedSupervisor, worker_ref: "W-1" },
          { ...verifiedSupervisor, worker_ref: "W-3", issued_on: null },
          {
            ...verifiedSupervisor,
            worker_ref: "W-4",
            decision_code: "suspended",
          },
          {
            ...verifiedSupervisor,
            worker_ref: "W-5",
            expires_on: "2026-11-01",
          },
          {
            ...verifiedSupervisor,
            worker_ref: "W-6",
            expires_on: "2026-11-02",
          },
        ],
        "W-1",
        TODAY,
      ),
    ).toEqual(["W-2", "W-6"]);
  });

  it("is absent with the s 15(2)(a) and (b) line when the declaration is unticked (findings 70 and 133)", () => {
    expect(exceptionGate(base({ declarationTicked: false })).reasons).toEqual([
      DECLARATION_LINE,
    ]);
  });

  it("is absent with FR-4a's reason when the register is empty or no adopted version carries the section (D-2421, D-2427)", () => {
    expect(exceptionGate(base({ registerRowCount: 0 })).reasons).toEqual([
      REGISTER_EMPTY_LINE,
    ]);
    expect(exceptionGate(base({ plan: null })).reasons).toEqual([
      PLAN_MISSING_LINE,
    ]);
    expect(exceptionGate(base({ plan: null })).lines.plan).toBe(
      "our Division 3 risk management plan, version <n> adopted <date>, with the participant risk register current to <date>",
    );
  });

  it("is absent with VIC's wording and the Part 4 line for NSW when the application is in VIC and the work in NSW (finding 208)", () => {
    const g = exceptionGate(
      base({ application: { state: "VIC", application_number: "V-1" } }),
    );
    expect(g.offered).toBe(false);
    expect(g.reasons).toEqual([
      "applied in Victoria: no clearance, no start (Worker Screening Act 2020 (Vic)).; New South Wales: no acceptable state check applies after 31 January 2026 (Rules s 23(7), as the Rules read on 15 October 2026); every Part 4 arrangement has ended by its own date, s 29B at the end of 1 February 2024 (s 29B(10))",
    ]);
  });

  it("names 31 January 2021 (Rules s 25(3)) when the application is in QLD and the work in VIC, and VIC's s 14(1)(a)(iv) wording too", () => {
    const g = exceptionGate(
      base({
        application: { state: "QLD", application_number: "Q-1" },
        states: ["VIC"],
      }),
    );
    expect(g.offered).toBe(false);
    expect(g.reasons[0]).toContain(
      "applied in Queensland: a worker can't start work until a clearance has been issued.; Victoria: no acceptable state check applies after 31 January 2021 (Rules s 25(3)",
    );
    expect(g.reasons[1]).toBe("Victoria: no clearance, no start.");
  });

  it("reads 'check the Rules' Part 4 and your unit' in place of the date and section when the national block's read is stale (finding 187)", () => {
    const g = exceptionGate(
      base({
        application: { state: "VIC", application_number: "V-1" },
        facts: stale,
      }),
    );
    expect(g.reasons).toEqual([
      `applied in Victoria: no clearance, no start (Worker Screening Act 2020 (Vic)).; New South Wales: ${CHECK_PART_4}`,
    ]);
  });

  it("is absent with VIC's s 14(1)(a)(iv) wording when the application is in NSW and the work in VIC (the cross-state case, finding 45)", () => {
    const g = exceptionGate(base({ states: ["NSW", "VIC"] }));
    expect(g.offered).toBe(false);
    expect(g.reasons).toEqual(["Victoria: no clearance, no start."]);
  });

  it("is absent with 'check your state's unit' for a state with no live read, as the application state or a work state (finding 59)", () => {
    expect(
      exceptionGate(
        base({ application: { state: "SA", application_number: "S-1" } }),
      ).reasons,
    ).toEqual([`applied in South Australia: ${CHECK_YOUR_UNIT}`]);
    expect(exceptionGate(base({ states: ["SA"] })).reasons).toEqual([
      `South Australia: ${CHECK_YOUR_UNIT}`,
    ]);
    expect(exceptionGate(base({ states: ["TAS"] })).reasons).toEqual([
      `TAS: ${CHECK_YOUR_UNIT}`,
    ]);
  });

  it("asks for the application first and for the states first, in FR-4's order with the other gates", () => {
    const g = exceptionGate(
      base({
        application: null,
        states: [],
        candidates: [],
        declarationTicked: false,
        plan: null,
        registerRowCount: 0,
      }),
    );
    expect(g.reasons).toEqual([
      RECORD_APPLICATION_FIRST,
      SUPERVISOR_LINE,
      TYPE_THE_STATES_FIRST,
      DECLARATION_LINE,
      PLAN_MISSING_LINE,
      REGISTER_EMPTY_LINE,
    ]);
    expect(g.lines.confirmed).toContain("application number <number>");
  });

  it("writes the two events' notes in words, never a uuid (findings 174 and 185)", () => {
    expect(
      exceptionStartedNote({
        versionNumber: 3,
        adoptedOn: "2026-11-02",
        registerDate: "2026-10-28",
      }),
    ).toBe(
      "version 3, adopted 2 November 2026; register current to 28 October 2026",
    );
    expect(exceptionEndedNote("supervision-stopped", "2026-11-05")).toBe(
      "supervision stopped (s 15(2)(f)) on 5 November 2026",
    );
    expect(exceptionEndedNote("clearance-issued", "2026-11-05")).toBe(
      "the clearance was issued (s 15(1)) on 5 November 2026",
    );
  });

  it("over the real state file (PO 04:58, #84): NSW's verified reads offer the option for an application and work in NSW; VIC's prohibit; WA allows", () => {
    const real = (over: Partial<ExceptionGateInput>) =>
      exceptionGate(base({ facts: FILE_FACTS, ...over }));
    const nsw = real({});
    expect(nsw.offered).toBe(true);
    expect(nsw.lines.states).toContain("applied in New South Wales:");
    expect(nsw.lines.states).toContain("works in NSW: New South Wales:");
    const wa = real({
      application: { state: "WA", application_number: "WA-1" },
      states: ["WA"],
    });
    expect(wa.offered).toBe(true);
    const vic = real({
      application: { state: "VIC", application_number: "V-1" },
    });
    expect(vic.offered).toBe(false);
    expect(vic.reasons[0]).toContain("applied in Victoria:");
    expect(vic.reasons[0]).toContain(
      "New South Wales: no acceptable state check applies after 31 January 2026 (Rules s 23(7), as the Rules read on 15 October 2026)",
    );
  });
});

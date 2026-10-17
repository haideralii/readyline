import { describe, expect, it } from "vitest";
import type { WorkerState } from "./worker-state";
import {
  currentStates,
  derivedPeopleStatus,
  workerStatesLine,
} from "./worker-states-line";

/** REQ-024 Session C (FR-10; D-2411, D-2831): the one sentence and the two derived statuses. */
const TODAY = "2026-10-18";

function state(
  key: WorkerState["key"],
  extra: Partial<WorkerState> = {},
): WorkerState {
  return {
    key,
    label: key,
    next: null,
    outstanding: key === "outstanding" ? ["w1-clearance"] : [],
    expiring: [],
    roleAssessmentToRecord: false,
    statesMissing: false,
    exceptionRunning: false,
    supervisorClearanceEndedOn: null,
    ...extra,
  };
}

describe("the worker states line (D-2411)", () => {
  it("reads the REQ's example", () => {
    const states = [
      state("all-recorded"),
      state("all-recorded"),
      state("all-recorded"),
      state("outstanding", { exceptionRunning: true }),
      state("check-expiring", {
        expiring: [{ clearance_kind: "first-aid", expires_on: "2026-11-07" }],
      }),
    ];
    expect(workerStatesLine(states, TODAY)).toBe(
      "3 workers with every item recorded, 1 with items outstanding (clearance pending, supervised), 1 check expiring in 20 days",
    );
  });

  it("drops a clause at zero, counts the supervised among the outstanding, says today and expired, and uses the singular", () => {
    expect(workerStatesLine([state("all-recorded")], TODAY)).toBe(
      "1 worker with every item recorded",
    );
    expect(
      workerStatesLine(
        [
          state("outstanding"),
          state("outstanding", { exceptionRunning: true }),
        ],
        TODAY,
      ),
    ).toBe(
      "2 workers with items outstanding (1 clearance pending, supervised)",
    );
    expect(
      workerStatesLine(
        [
          state("check-expiring", {
            expiring: [
              { clearance_kind: "wwcc", expires_on: TODAY },
              { clearance_kind: "first-aid", expires_on: "2026-10-01" },
            ],
          }),
        ],
        TODAY,
      ),
    ).toBe("1 check expiring today, 1 check expired");
  });

  it("an ended worker counts for nothing and no current worker gives no line", () => {
    expect(workerStatesLine([state("ended")], TODAY)).toBeNull();
    expect(workerStatesLine([], TODAY)).toBeNull();
    expect(currentStates([state("ended"), state("outstanding")])).toHaveLength(
      1,
    );
  });
});

describe("the derived checklist statuses (FR-10, D-2831)", () => {
  const clear = (s: WorkerState) => s.key === "all-recorded";
  it("have when every current worker is clear, in progress when some are, nothing when none are or none exist", () => {
    expect(
      derivedPeopleStatus([state("all-recorded"), state("ended")], clear),
    ).toBe("have");
    expect(
      derivedPeopleStatus([state("all-recorded"), state("outstanding")], clear),
    ).toBe("in-progress");
    expect(derivedPeopleStatus([state("outstanding")], clear)).toBeNull();
    expect(derivedPeopleStatus([], clear)).toBeNull();
  });
  it("a scope filter leaves the out-of-scope workers aside", () => {
    expect(
      derivedPeopleStatus(
        [state("all-recorded"), state("outstanding", { statesMissing: true })],
        clear,
        (s) => !s.statesMissing,
      ),
    ).toBe("have");
  });
});

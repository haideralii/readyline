import { describe, expect, it } from "vitest";
import {
  workerOnboardingItems,
  type WorkerItemContext,
} from "./onboarding-items";
import {
  clearanceRecorded,
  deriveWorkerState,
  FROM_THE_DATES_LINE,
  ROLE_ASSESSMENT_TO_RECORD,
  TYPE_THE_STATES_FIRST,
  type ClearanceInput,
  type ItemStateInput,
} from "./worker-state";

/**
 * REQ-024 FR-3, FR-4 (D-2411; findings 50, 59, 81, 151; AC-2's A1 cases):
 * the derived state over the worker's rows with a fixed Sydney `today`; the
 * words never say "ready"; W-1 is recorded only with the database check
 * dated on the clearance row; the next thing to do is the first outstanding
 * item's ask.
 */
const TODAY = "2026-11-02";
const ctx: WorkerItemContext = {
  role: "support-worker",
  states: ["NSW"],
  worksWithChildren: false,
  mayUseRestrictivePractice: false,
  ownerRow: false,
  riskAssessed: true,
  moduleIds: ["core"],
  today: TODAY,
};
const items = workerOnboardingItems(ctx);
const worker = {
  worker_ref: "W-001",
  states: ["NSW"],
  risk_assessed: true,
  ended_on: null,
  role_assessed_on: "2026-10-01",
};
const allDone = (): ItemStateInput[] =>
  items.map((i) => ({
    item_id: i.id,
    done_on: "2026-10-20",
    confirmed_on: "2026-10-21",
  }));
const cleared: ClearanceInput = {
  clearance_kind: "ndis-worker-screening",
  issued_on: "2026-09-01",
  expires_on: "2031-09-01",
  clearance_number: "NWS 123",
  verified_in_database_on: "2026-10-21",
} as ClearanceInput;

describe("the derived worker state (REQ-024 FR-3, FR-4)", () => {
  it("every before-first-shift item done and confirmed, the clearance verified: all recorded, nothing next", () => {
    const s = deriveWorkerState({
      worker,
      items,
      states: allDone(),
      clearances: [cleared],
      today: TODAY,
    });
    expect(s.key).toBe("all-recorded");
    expect(s.label).toBe("All before-first-shift items recorded");
    expect(s.next).toBeNull();
    expect(s.outstanding).toEqual([]);
    expect(s.label).not.toMatch(/ready/i);
    expect(FROM_THE_DATES_LINE).toMatch(/Commission's database/);
  });

  it("W-1 confirmed on the item but not dated in the database: outstanding, the database check is next (finding 151)", () => {
    const s = deriveWorkerState({
      worker,
      items,
      states: allDone(),
      clearances: [{ ...cleared, verified_in_database_on: null }],
      today: TODAY,
    });
    expect(s.key).toBe("outstanding");
    expect(s.outstanding).toEqual(["w1-clearance"]);
    expect(s.next).toMatch(/NDIS Worker Screening Database/);
    expect(
      clearanceRecorded([{ ...cleared, verified_in_database_on: null }], TODAY),
    ).toBe(false);
  });

  it("a shared item needs both dates; an owner's item needs the confirmation alone", () => {
    const states = allDone().map((s) =>
      s.item_id === "w6-policies" ? { ...s, done_on: null } : s,
    );
    const s = deriveWorkerState({
      worker,
      items,
      states,
      clearances: [cleared],
      today: TODAY,
    });
    expect(s.outstanding).toEqual(["w6-policies"]);
    expect(s.next).toBe(
      "Show me this worker's signed acknowledgement of the mandatory policies.",
    );
    const ownerOnly = allDone().map((s) =>
      s.item_id === "emergency-plan-shown" ? { ...s, done_on: null } : s,
    );
    expect(
      deriveWorkerState({
        worker,
        items,
        states: ownerOnly,
        clearances: [cleared],
        today: TODAY,
      }).outstanding,
    ).toEqual([]);
  });

  it("no states typed: the next thing is to type them (finding 81)", () => {
    const s = deriveWorkerState({
      worker: { ...worker, states: [] },
      items: workerOnboardingItems({ ...ctx, states: [] }),
      states: [],
      clearances: [],
      today: TODAY,
    });
    expect(s.key).toBe("outstanding");
    expect(s.statesMissing).toBe(true);
    expect(s.next).toBe(TYPE_THE_STATES_FIRST);
  });

  it("an expired, decided or pending clearance row never records W-1; an expiring check flags the state once everything is recorded", () => {
    expect(
      clearanceRecorded([{ ...cleared, expires_on: "2026-11-01" }], TODAY),
    ).toBe(false);
    expect(
      clearanceRecorded([{ ...cleared, decision_code: "suspended" }], TODAY),
    ).toBe(false);
    expect(
      clearanceRecorded(
        [{ ...cleared, issued_on: null, application_number: "APP 1" }],
        TODAY,
      ),
    ).toBe(false);
    const s = deriveWorkerState({
      worker,
      items,
      states: allDone(),
      clearances: [
        cleared,
        {
          clearance_kind: "first-aid",
          issued_on: "2023-12-01",
          expires_on: "2026-12-01",
        },
      ],
      today: TODAY,
    });
    expect(s.key).toBe("check-expiring");
    expect(s.expiring).toEqual([
      { clearance_kind: "first-aid", expires_on: "2026-12-01" },
    ]);
    expect(s.next).toMatch(/first aid.*2026-12-01/);
  });

  it("an ended worker reads ended whatever else is outstanding (FR-12)", () => {
    const s = deriveWorkerState({
      worker: { ...worker, ended_on: "2026-10-31" },
      items,
      states: [],
      clearances: [],
      today: TODAY,
    });
    expect(s.key).toBe("ended");
    expect(s.next).toBeNull();
    // Not yet ended: still outstanding.
    expect(
      deriveWorkerState({
        worker: { ...worker, ended_on: "2026-11-03" },
        items,
        states: [],
        clearances: [],
        today: TODAY,
      }).key,
    ).toBe("outstanding");
  });

  it("a risk assessed worker whose role has no assessed date shows 'role assessment to record' (D-2416, finding 44)", () => {
    const s = deriveWorkerState({
      worker: { ...worker, role_assessed_on: null },
      items,
      states: allDone(),
      clearances: [cleared],
      today: TODAY,
    });
    expect(s.roleAssessmentToRecord).toBe(true);
    expect(s.next).toBe(ROLE_ASSESSMENT_TO_RECORD);
  });
});

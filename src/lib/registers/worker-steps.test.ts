import { describe, expect, it } from "vitest";
import {
  ACKNOWLEDGEMENT_DOCUMENTS,
  acknowledgementsComplete,
  acknowledgementsOutstanding,
  itemStepState,
  w1StepState,
  workerStepState,
  latestAdopted,
  STEP_WORDS,
} from "./worker-steps";
import { MANDATORY_POLICIES } from "./onboarding-items";

describe("the worker's view of an item (REQ-024 FR-7, FR-8; D-2438, D-2444)", () => {
  const none = { done_on: null, confirmed_on: null, recorded_by_owner: false };

  it("an owner's item is the manager's to record until confirmed", () => {
    expect(itemStepState("owner", undefined)).toBe("manager-records");
    expect(itemStepState("owner", none)).toBe("manager-records");
    expect(
      itemStepState("owner", { ...none, confirmed_on: "2026-11-02" }),
    ).toBe("confirmed");
  });

  it("the worker's own date waits for the owner; the owner's confirmation closes it", () => {
    expect(itemStepState("worker", undefined)).toBe("to-do");
    expect(itemStepState("both", none)).toBe("to-do");
    expect(itemStepState("both", { ...none, done_on: "2026-11-01" })).toBe(
      "waiting",
    );
    expect(
      itemStepState("worker", {
        done_on: "2026-11-01",
        confirmed_on: "2026-11-02",
        recorded_by_owner: false,
      }),
    ).toBe("confirmed");
  });

  it("a date the owner recorded for the worker reads 'recorded by your manager' whatever else is set (finding 224)", () => {
    expect(
      itemStepState("both", {
        done_on: "2026-11-01",
        confirmed_on: "2026-11-01",
        recorded_by_owner: true,
      }),
    ).toBe("recorded-by-manager");
    expect(STEP_WORDS["recorded-by-manager"]).toBe("Recorded by your manager");
    expect(STEP_WORDS.waiting).toBe("Waiting for your manager to confirm");
  });
});

describe("W-1 on the worker's home (D-2834)", () => {
  const none = { done_on: null, confirmed_on: null, recorded_by_owner: false };
  it("is to do with no row or no check number, waiting once the number is typed, confirmed once the owner confirms", () => {
    expect(w1StepState(null, undefined)).toBe("to-do");
    expect(w1StepState({ clearance_number: "" }, none)).toBe("to-do");
    expect(w1StepState({ clearance_number: "WC 1" }, none)).toBe("waiting");
    expect(
      w1StepState(
        { clearance_number: "WC 1" },
        { ...none, confirmed_on: "2026-11-02" },
      ),
    ).toBe("confirmed");
    expect(
      w1StepState(
        { clearance_number: "" },
        { ...none, recorded_by_owner: true },
      ),
    ).toBe("recorded-by-manager");
  });
  it("workerStepState routes W-1 by its row and every other item by its columns", () => {
    expect(
      workerStepState({ id: "w1-clearance", who: "owner" }, undefined, null),
    ).toBe("to-do");
    expect(
      workerStepState(
        { id: "w10-other-checks", who: "owner" },
        undefined,
        null,
      ),
    ).toBe("manager-records");
  });
});

describe("the acknowledgement documents (REQ-024 FR-7, W-3, W-6)", () => {
  it("W-6 names the five policies of MANDATORY_POLICIES and W-3 the Code alone", () => {
    expect(ACKNOWLEDGEMENT_DOCUMENTS["w6-policies"]).toHaveLength(5);
    expect(ACKNOWLEDGEMENT_DOCUMENTS["w3-code-of-conduct"]).toEqual([
      "code-of-conduct-acknowledgement",
    ]);
    for (const word of [
      "Code of Conduct",
      "incident",
      "complaints",
      "privacy",
      "safeguarding",
    ])
      expect(MANDATORY_POLICIES).toContain(word);
  });

  it("the latest adopted version per type is the one to acknowledge; a new version reopens the item", () => {
    const adopted = latestAdopted([
      {
        id: "a",
        document_type_id: "safeguarding-policy",
        version: 1,
        adopted_on: "2026-10-01",
      },
      {
        id: "b",
        document_type_id: "safeguarding-policy",
        version: 2,
        adopted_on: "2026-10-20",
      },
      {
        id: "c",
        document_type_id: "code-of-conduct-acknowledgement",
        version: 1,
        adopted_on: "2026-10-01",
      },
    ]);
    expect(adopted.get("safeguarding-policy")?.version).toBe(2);
    const acks = [
      {
        document_type_id: "code-of-conduct-acknowledgement",
        version: 1,
        acknowledged_on: "2026-11-01",
      },
      {
        document_type_id: "safeguarding-policy",
        version: 1,
        acknowledged_on: "2026-11-01",
      },
    ];
    expect(acknowledgementsComplete("w3-code-of-conduct", adopted, acks)).toBe(
      true,
    );
    expect(acknowledgementsComplete("w6-policies", adopted, acks)).toBe(false);
    const out = acknowledgementsOutstanding("w6-policies", adopted, acks);
    expect(out.toAcknowledge.map((d) => d.document_type_id)).toEqual([
      "safeguarding-policy",
    ]);
    expect(out.notAdopted).toEqual([
      "incident-management-policy-and-register",
      "complaints-management-policy-and-register",
      "privacy-and-information-management-policy",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type { WorkerState } from "@/lib/registers/worker-state";
import type { ShownChecklist, ShownItem } from "./state";
import {
  applyWorkerStates,
  ORIENTATION_ITEM_ID,
  SCREENING_ITEM_ID,
  type WorkerStateWithRow,
} from "./worker-states";

/** REQ-024 Session C (FR-10; D-2831): the two people items read the staff list while rows exist. */
const TODAY = "2026-10-18";

function item(id: string, status: ShownItem["status"]): ShownItem {
  return {
    id,
    group: id.startsWith("people:") ? "people" : "business",
    title: id,
    ask: id,
    why: "",
    sourceRef: { title: "", url: "" },
    unverified: false,
    initialStatus: "need",
    status,
    note: "",
    stored: false,
    doneOn: null,
  } as unknown as ShownItem;
}

function shown(): ShownChecklist {
  const items = [
    item(SCREENING_ITEM_ID, "need"),
    item(ORIENTATION_ITEM_ID, "need"),
    item("business:abn", "have"),
  ];
  return {
    items,
    groups: [
      {
        id: "people",
        title: "People",
        items: items.slice(0, 2),
        ready: 0,
        open: true,
      },
      {
        id: "business",
        title: "Business",
        items: items.slice(2),
        ready: 1,
        open: false,
      },
    ],
    ready: 1,
    total: 3,
  } as unknown as ShownChecklist;
}

function state(
  key: WorkerState["key"],
  extra: Partial<WorkerStateWithRow> = {},
): WorkerStateWithRow {
  return {
    key,
    label: key,
    next: null,
    outstanding: [],
    expiring: [],
    roleAssessmentToRecord: false,
    statesMissing: false,
    exceptionRunning: false,
    supervisorClearanceEndedOn: null,
    riskAssessed: true,
    ...extra,
  };
}

describe("applyWorkerStates", () => {
  it("leaves the checklist as it was with no current worker (D-2831)", () => {
    const s = shown();
    expect(applyWorkerStates(s, [], TODAY)).toBe(s);
    expect(applyWorkerStates(s, [state("ended")], TODAY)).toBe(s);
  });

  it("marks both items have when every current worker is clear, with the line under each", () => {
    const out = applyWorkerStates(shown(), [state("all-recorded")], TODAY);
    const screening = out.items.find((i) => i.id === SCREENING_ITEM_ID)!;
    expect(screening.status).toBe("have");
    expect(screening.derived).toBe(
      "From your staff list: 1 worker with every item recorded.",
    );
    expect(out.items.find((i) => i.id === ORIENTATION_ITEM_ID)!.status).toBe(
      "have",
    );
    expect(out.ready).toBe(3);
    expect(out.groups[0].ready).toBe(2);
    expect(
      out.items.find((i) => i.id === "business:abn")!.derived,
    ).toBeUndefined();
  });

  it("in progress when some are clear; the screening item reads risk-assessed workers alone; orientation reads W-4", () => {
    const out = applyWorkerStates(
      shown(),
      [
        state("all-recorded"),
        state("outstanding", { outstanding: ["w1-clearance"] }),
        state("outstanding", {
          riskAssessed: false,
          outstanding: ["w4-orientation-module"],
        }),
      ],
      TODAY,
    );
    expect(out.items.find((i) => i.id === SCREENING_ITEM_ID)!.status).toBe(
      "in-progress",
    );
    expect(out.items.find((i) => i.id === ORIENTATION_ITEM_ID)!.status).toBe(
      "in-progress",
    );
  });

  it("keeps the stored status when no current worker is clear", () => {
    const s = shown();
    s.items[0].status = "in-progress";
    const out = applyWorkerStates(
      s,
      [
        state("outstanding", {
          outstanding: ["w1-clearance", "w4-orientation-module"],
        }),
      ],
      TODAY,
    );
    expect(out.items[0].status).toBe("in-progress");
    expect(out.items[0].derived).toMatch(/^From your staff list: /);
    expect(out.items[1].status).toBe("need");
  });
});

import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  beforeFirstShiftItems,
  FIXED_WORKER_ITEM_IDS,
  LEGACY_WORKER_ITEM_IDS,
  onboardingItemsFor,
  PARTICIPANT_ONBOARDING_ITEMS,
  sourceLine,
  TRAINING_BY_MODULE,
  TYPE_THE_STATES_LINE,
  UNKNOWN_WORKER_CONTEXT,
  WORKER_ITEM_ID_MAP,
  WORKER_ITEM_IDS,
  WORKER_ROLES,
  workerOnboardingItems,
  type WorkerItemContext,
} from "./onboarding-items";

/**
 * REQ-024 FR-2 (D-2402; findings 68, 81, 189; AC-1): the worker's list is
 * derived from the role, states and flags and the account's modules, with a
 * fixed `today`; the ids are the W form; the REQ-018 id map is fixed; every
 * W-7 key is in the standards dataset.
 */
const TODAY = "2026-11-02";
const base: WorkerItemContext = {
  role: "support-worker",
  states: ["NSW"],
  worksWithChildren: false,
  mayUseRestrictivePractice: false,
  ownerRow: false,
  riskAssessed: true,
  moduleIds: ["core"],
  today: TODAY,
};
const ids = (ctx: WorkerItemContext) =>
  workerOnboardingItems(ctx).map((i) => i.id);

describe("the derived worker onboarding list (REQ-024 FR-2)", () => {
  it("AC-1: a certification support worker in NSW gets W-1 to W-7 with first aid and CPR from the core module, each with an ask and a source", () => {
    const items = workerOnboardingItems({ ...base, worksWithChildren: true });
    const got = items.map((i) => i.id);
    expect(got).toEqual([
      "identity-and-agreement",
      "w1-clearance",
      "w1-application-recorded",
      "w2-children-check",
      "w3-code-of-conduct",
      "w4-orientation-module",
      "w5-induction",
      "w6-policies",
      "participant-plans-read",
      "emergency-plan-shown",
      "w7-medication",
      "w7-first-aid",
      "w7-cpr",
      "w7-manual-handling",
      "w8-supervision",
      "w10-other-checks",
    ]);
    for (const i of items) {
      expect(i.ask.length, i.id).toBeGreaterThan(10);
      expect(i.source.title.length, i.id).toBeGreaterThan(10);
      expect(["owner", "worker", "both"], i.id).toContain(i.who);
      expect(WORKER_ITEM_IDS, i.id).toContain(i.id);
      expect(i.id).toMatch(/^[a-z0-9-]{1,60}$/);
    }
    // The three "your call" items say so (FR-5, finding 91).
    expect(items.filter((i) => i.yourCall).map((i) => i.id)).toEqual([
      "w7-first-aid",
      "w7-cpr",
      "w7-manual-handling",
    ]);
    expect(items.find((i) => i.id === "w7-first-aid")!.text).toContain(
      "Readyline's suggestion",
    );
  });

  it("a worker with no states is told to type the states first (finding 81)", () => {
    const w1 = workerOnboardingItems({ ...base, states: [] }).find(
      (i) => i.id === "w1-clearance",
    )!;
    expect(w1.stateLines).toEqual([TYPE_THE_STATES_LINE]);
    const typed = workerOnboardingItems(base).find(
      (i) => i.id === "w1-clearance",
    )!;
    expect(typed.stateLines).toHaveLength(1);
    expect(typed.stateLines![0]).toMatch(/^New South Wales:/);
    // The instruction itself stays short; the state facts are their own lines under it (the lint caps a paragraph).
    expect(typed.text).not.toMatch(/New South Wales/);
  });

  it("AC-1: the owner adding themselves to a verification-only account omits W-5 and W-8 and keeps W-1, W-3, W-4 and W-6", () => {
    const got = ids({
      ...base,
      ownerRow: true,
      role: "key-personnel",
      moduleIds: ["verification"],
    });
    expect(got).not.toContain("w5-induction");
    expect(got).not.toContain("w8-supervision");
    for (const id of [
      "w1-clearance",
      "w3-code-of-conduct",
      "w4-orientation-module",
      "w6-policies",
    ])
      expect(got).toContain(id);
    // No core module: no W-7 items at all.
    expect(got.filter((i) => i.startsWith("w7-"))).toEqual([]);
  });

  it("the flags add their items: children's check, restrictive practice; a role that is not risk assessed has no W-1", () => {
    expect(ids({ ...base, worksWithChildren: true })).toContain(
      "w2-children-check",
    );
    expect(ids(base)).not.toContain("w2-children-check");
    expect(ids({ ...base, mayUseRestrictivePractice: true })).toContain(
      "w9-restrictive-practice",
    );
    const admin = ids({ ...base, role: "admin", riskAssessed: false });
    expect(admin).not.toContain("w1-clearance");
    expect(admin).not.toContain("w1-application-recorded");
  });

  it("W-2 branches on the state's scheme: Tasmania one registration, Queensland one application, NSW separate", () => {
    const text = (code: string) =>
      workerOnboardingItems({
        ...base,
        states: [code],
        worksWithChildren: true,
      })
        .find((i) => i.id === "w2-children-check")!
        .stateLines!.join(" ");
    expect(text("TAS")).toMatch(
      /one Registration to Work with Vulnerable People/,
    );
    expect(text("QLD")).toMatch(/one combined application/);
    expect(text("NSW")).toMatch(/two separate checks/);
    expect(text("NT")).toMatch(/Northern Territory 2 years/);
  });

  it("W-7 follows the modules: medication from the core standard, high intensity from hidpa, behaviour support from sbs or ibsp, once each", () => {
    const hid = ids({ ...base, moduleIds: ["core", "hidpa"] });
    expect(hid).toContain("w7-high-intensity");
    const both = ids({ ...base, moduleIds: ["core", "sbs", "ibsp"] });
    expect(both.filter((i) => i === "w7-pbs")).toHaveLength(1);
    expect(ids({ ...base, moduleIds: ["verification"] })).not.toContain(
      "w7-medication",
    );
  });

  it("every W-7 key is a module or a standard in the dataset (Dev answer 2)", () => {
    const ds = getStandardsDataset();
    const moduleIds = new Set(ds.modules.map((m) => m.id));
    const standardIds = new Set(ds.standards.map((s) => s.id));
    for (const t of TRAINING_BY_MODULE)
      expect(moduleIds.has(t.key) || standardIds.has(t.key), t.key).toBe(true);
  });

  it("the before-first-shift set is W-1, W-2 where it applies, W-3, W-4, W-5, W-6 and the three fixed items (FR-4)", () => {
    const set = beforeFirstShiftItems(
      workerOnboardingItems({ ...base, worksWithChildren: true }),
    ).map((i) => i.id);
    expect(set).toEqual([
      "identity-and-agreement",
      "w1-clearance",
      "w2-children-check",
      "w3-code-of-conduct",
      "w4-orientation-module",
      "w5-induction",
      "w6-policies",
      "participant-plans-read",
      "emergency-plan-shown",
    ]);
  });

  it("the REQ-018 id map is fixed and the three fixed ids keep their own (finding 68)", () => {
    expect(WORKER_ITEM_ID_MAP).toEqual({
      "screening-clearance-seen": "w1-clearance",
      "other-checks-recorded": "w10-other-checks",
      "orientation-module": "w4-orientation-module",
      "policies-walked-through": "w6-policies",
      "supervision-booked": "w8-supervision",
    });
    for (const old of LEGACY_WORKER_ITEM_IDS)
      expect(
        (FIXED_WORKER_ITEM_IDS as readonly string[]).includes(old) ||
          old in WORKER_ITEM_ID_MAP,
        old,
      ).toBe(true);
    for (const v of Object.values(WORKER_ITEM_ID_MAP))
      expect(WORKER_ITEM_IDS).toContain(v);
  });

  it("the participant list is unchanged and the worker list needs a context; the unknown-worker context is risk assessed with no states", () => {
    expect(onboardingItemsFor("participant")).toBe(
      PARTICIPANT_ONBOARDING_ITEMS,
    );
    const unknown = onboardingItemsFor("worker").map((i) => i.id);
    expect(unknown).toContain("w1-clearance");
    expect(UNKNOWN_WORKER_CONTEXT.states).toEqual([]);
    expect(WORKER_ROLES).toHaveLength(6);
    expect(sourceLine({ title: "A", status: "unverified" })).toBe(
      "UNVERIFIED: A.",
    );
    expect(
      sourceLine({ title: "B", url: "https://x.test", status: "verified" }),
    ).toBe("B (https://x.test).");
  });
});

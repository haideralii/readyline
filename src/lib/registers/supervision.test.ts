import { describe, expect, it } from "vitest";
import {
  heldOnAfterToday,
  latestHeldOn,
  OUTCOME_ONLY_FOR_REVIEW,
  PROBATION_NEEDS_OUTCOME,
  PROBATION_NO_NOTE,
  sortEntries,
  SupervisionEntryForm,
  supervisionEntryLine,
  supervisionTrailNote,
} from "./supervision";

/** REQ-024 Session C (FR-11; D-2829, D-2833; finding 78): the form's shape per kind and the words. */
const base = {
  workerRef: "W-003",
  kind: "supervision",
  heldOn: "2026-10-10",
  byRef: "KP-1",
  note: "Covered the incident procedure and the roster.",
  outcome: "",
};

function issues(values: Record<string, unknown>) {
  const r = SupervisionEntryForm.safeParse(values);
  return r.success
    ? []
    : r.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`);
}

describe("the supervision entry form", () => {
  it("accepts a supervision with a note and no outcome, upper-casing the codes", () => {
    const r = SupervisionEntryForm.safeParse({
      ...base,
      workerRef: "w-003",
      byRef: "kp-1",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.workerRef).toBe("W-003");
      expect(r.data.byRef).toBe("KP-1");
      expect(r.data.outcome).toBeNull();
    }
  });

  it("a probation review needs an outcome and carries no note (finding 78)", () => {
    expect(
      issues({ ...base, kind: "probation-review", note: "", outcome: "" }),
    ).toEqual([`outcome: ${PROBATION_NEEDS_OUTCOME}`]);
    expect(
      issues({ ...base, kind: "probation-review", outcome: "continued" }),
    ).toEqual([`note: ${PROBATION_NO_NOTE}`]);
    const ok = SupervisionEntryForm.safeParse({
      ...base,
      kind: "probation-review",
      note: "",
      outcome: "extended",
    });
    expect(ok.success).toBe(true);
  });

  it("an outcome on a supervision or a conversation is refused", () => {
    expect(issues({ ...base, outcome: "continued" })).toEqual([
      `outcome: ${OUTCOME_ONLY_FOR_REVIEW}`,
    ]);
    expect(issues({ ...base, kind: "conversation", outcome: "ended" })).toEqual(
      [`outcome: ${OUTCOME_ONLY_FOR_REVIEW}`],
    );
  });

  it("the supervisor is a KP- or W- code, the worker a W- code, and a name is refused", () => {
    expect(issues({ ...base, byRef: "Jane Smith" })[0]).toMatch(/^byRef: /);
    expect(issues({ ...base, byRef: "P-014" })[0]).toMatch(/^byRef: /);
    expect(issues({ ...base, workerRef: "KP-1" })[0]).toMatch(/^workerRef: /);
    expect(issues({ ...base, byRef: "W-002" })).toEqual([]);
  });

  it("the note is capped at 500 characters and refuses an NDIS number shape", () => {
    expect(issues({ ...base, note: "x".repeat(501) })[0]).toMatch(
      /^note: Use 500 characters/,
    );
    expect(issues({ ...base, note: "Talked about 430123456" })[0]).toMatch(
      /^note: This looks like an NDIS participant number/,
    );
  });

  it("an unknown kind and an extra field are refused", () => {
    expect(issues({ ...base, kind: "chat" })[0]).toMatch(/^kind: /);
    expect(issues({ ...base, extra: 1 }).length).toBeGreaterThan(0);
  });
});

describe("the derivations and words", () => {
  const entries = [
    {
      kind: "supervision",
      held_on: "2026-09-01",
      by_ref: "KP-1",
      note: "a",
      outcome: null,
    },
    {
      kind: "probation-review",
      held_on: "2026-10-05",
      by_ref: "W-002",
      note: "",
      outcome: "continued",
    },
    {
      kind: "conversation",
      held_on: "2026-10-05",
      by_ref: "KP-1",
      note: "b",
      outcome: null,
    },
  ];

  it("the latest held day of any kind is the row's date (AC-9, D-2829)", () => {
    expect(latestHeldOn(entries)).toBe("2026-10-05");
    expect(latestHeldOn([])).toBeNull();
  });

  it("the history is newest first, two on one day by kind", () => {
    expect(sortEntries(entries).map((e) => `${e.held_on} ${e.kind}`)).toEqual([
      "2026-10-05 conversation",
      "2026-10-05 probation-review",
      "2026-09-01 supervision",
    ]);
  });

  it("the day cannot be after today", () => {
    expect(heldOnAfterToday("2026-10-19", "2026-10-18")).toBe(true);
    expect(heldOnAfterToday("2026-10-18", "2026-10-18")).toBe(false);
  });

  it("the lines name the kind, the day, the code and a review's outcome, and the trail note carries no note text", () => {
    expect(supervisionEntryLine(entries[0])).toBe(
      "Supervision session on 1 September 2026 with KP-1",
    );
    expect(supervisionEntryLine(entries[1])).toBe(
      "Probation review on 5 October 2026 with W-002: probation continued",
    );
    expect(supervisionTrailNote(entries[2])).toBe(
      "conversation on 2026-10-05 by KP-1",
    );
  });
});

import { describe, expect, it } from "vitest";
import { registersLine } from "./overview";

const empty = {
  incidents: { total: 0, open: 0, overdueNotification: 0 },
  complaints: { total: 0, unresolved: 0 },
  workerChecks: { total: 0, expiring: 0, expired: 0 },
  policyReviews: { total: 0, dueSoon: 0, overdue: 0, notAdopted: 0 },
};

describe("registers line on the account page (REQ-009 batch 28 item 4)", () => {
  it("says nothing is there yet", () => {
    expect(registersLine(empty)).toEqual({
      current: 0,
      dueSoon: 0,
      overdue: 0,
      sentence: "No register entries yet.",
    });
  });

  it("counts current, due soon and overdue across the four registers and says them in words", () => {
    const r = registersLine({
      incidents: { total: 3, open: 1, overdueNotification: 1 },
      complaints: { total: 2, unresolved: 2 },
      workerChecks: { total: 4, expiring: 1, expired: 1 },
      policyReviews: { total: 10, dueSoon: 2, overdue: 0, notAdopted: 3 },
    });
    expect(r.overdue).toBe(2);
    expect(r.dueSoon).toBe(5);
    expect(r.current).toBe(12);
    expect(r.sentence).toBe(
      "1 incident overdue to notify the Commission, 1 worker check expired, 1 worker check expiring soon, 2 policy reviews due soon, 2 complaints unresolved.",
    );
  });

  it("all current", () => {
    expect(
      registersLine({
        ...empty,
        workerChecks: { total: 2, expiring: 0, expired: 0 },
      }).sentence,
    ).toBe("2 entries, all current.");
  });
});

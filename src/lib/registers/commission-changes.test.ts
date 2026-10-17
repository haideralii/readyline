import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHANGE_TYPES,
  CHANGE_TYPE_IDS,
  NOTIFICATION_TYPE_IDS,
  S13_TYPE_IDS,
  VARIATION_TYPE_IDS,
  changeState,
  notifyBy,
  tellingTheCommissionRows,
} from "./commission-changes";

/**
 * REQ-023 Session D, FR-10 and AC-6 (D-2306 as amended, D-2311): the one
 * constant behind the register's list and the governance policy's table, the
 * migration's CHECK list, and the states as the view computes them.
 */
const MIGRATION = "supabase/migrations/20261017120000_commission_changes.sql";

describe("the change types (FR-10)", () => {
  it("name every type once, with its kind and rule", () => {
    expect(new Set(CHANGE_TYPE_IDS).size).toBe(CHANGE_TYPES.length);
    expect(VARIATION_TYPE_IDS).toEqual(["supports-registered"]);
    expect(NOTIFICATION_TYPE_IDS).toContain("key-personnel-change");
    expect(NOTIFICATION_TYPE_IDS).toContain("key-personnel-suitability");
    expect(NOTIFICATION_TYPE_IDS).toContain("change-of-ownership");
    expect(S13_TYPE_IDS).toEqual([
      "contact-details",
      "area",
      "locations",
      "participant-numbers",
      "worker-numbers",
    ]);
    for (const t of CHANGE_TYPES) {
      expect(t.label, t.id).toMatch(/\(Rules s 13|\(NDIS Act s 73M\)/);
      expect(t.helper.length, t.id).toBeGreaterThan(40);
    }
  });

  it("mirror the migration's CHECK list and its s 13 list exactly", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const check = /change_type in \(([\s\S]*?)\)\),/.exec(sql);
    expect(check).not.toBeNull();
    const inSql = [...check![1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    // The same set; a CHECK list's order carries no meaning.
    expect([...inSql].sort()).toEqual([...CHANGE_TYPE_IDS].sort());
    // The view names the s 13 types twice (notify_by and state); both lists are the constant's.
    const s13Lists = [...sql.matchAll(/c\.change_type in \(([^)]*)\)/g)].map(
      (m) => [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]),
    );
    expect(s13Lists).toHaveLength(2);
    for (const list of s13Lists) expect(list).toEqual(S13_TYPE_IDS);
  });

  it("build the governance policy's table, the 15 October 2026 words byte for byte", () => {
    expect(tellingTheCommissionRows()).toEqual([
      [
        "A change to our contact details (Rules s 13)",
        "As soon as practicable after we know it will happen, or after it happens, whichever is earlier",
      ],
      [
        "A change in our scale: the area or the locations we work from, or a significant rise or fall in the number of participants or workers (Rules s 13)",
        "As soon as practicable after we know it will happen, or after it happens, whichever is earlier",
      ],
      [
        "An event that significantly affects our ability to meet a condition of registration, or a change that adversely affects a participant's access to our supports (Rules s 13A)",
        "When we become aware it will occur, or when it occurs, whichever is earlier",
      ],
      [
        "An adverse change in our financial capacity, or a significant change in our organisation or governance, including a change of ownership (Rules s 13A)",
        "For a change of ownership: when we become aware it will occur, or when a necessary step toward it occurs, whichever is earlier; otherwise as the row above",
      ],
      [
        "An event about the suitability of the business or of our key personnel of the kind the Commission would weigh for an applicant (Rules s 13A)",
        "When we become aware it will occur, or when it occurs, whichever is earlier",
      ],
    ]);
    // Every notification type sits in one of the five rows; the variation in none.
    for (const t of CHANGE_TYPES)
      expect(t.policyRow === null, t.id).toBe(t.kind === "variation");
  });
});

describe("the states (AC-6; D-2306 as amended, D-2311)", () => {
  const today = "2027-06-15";
  const base = {
    kind: "notification" as const,
    aware_on: null,
    notified_on: null,
    approved_form: null,
    applied_on: null,
    decided_on: null,
  };

  it("a s 13A notification's notify-by is the earlier of the day known and the day it happened, and it is overdue once that day has passed", () => {
    const row = {
      ...base,
      change_type: "key-personnel-change",
      aware_on: "2027-06-05",
      happened_on: "2027-06-14",
    };
    expect(notifyBy(row)).toBe("2027-06-05");
    expect(changeState(row, today)).toBe("overdue");
    expect(
      changeState({ ...row, aware_on: null, happened_on: "2027-06-15" }, today),
    ).toBe("to notify");
    expect(notifyBy({ ...row, aware_on: "2027-06-20" })).toBe("2027-06-14");
  });

  it("a s 13 notification has no notify-by and is to notify, never overdue", () => {
    const row = {
      ...base,
      change_type: "contact-details",
      happened_on: "2027-06-05",
    };
    expect(notifyBy(row)).toBeNull();
    expect(changeState(row, today)).toBe("to notify");
  });

  it("a notified row is notified only with the approved form, else told, form not confirmed", () => {
    const row = {
      ...base,
      change_type: "contact-details",
      happened_on: "2027-06-05",
      notified_on: "2027-06-06",
    };
    expect(changeState({ ...row, approved_form: "yes" }, today)).toBe(
      "notified",
    );
    expect(changeState({ ...row, approved_form: "unsure" }, today)).toBe(
      "told, form not confirmed",
    );
    expect(changeState({ ...row, approved_form: "no" }, today)).toBe(
      "told, form not confirmed",
    );
  });

  it("a change of ownership's notify-by is the earlier of awareness and the first necessary step", () => {
    expect(
      notifyBy({
        ...base,
        change_type: "change-of-ownership",
        aware_on: "2027-05-01",
        happened_on: "2027-06-01",
      }),
    ).toBe("2027-05-01");
  });

  it("a variation is to apply, applied, decided, with no notify-by", () => {
    const row = {
      ...base,
      kind: "variation" as const,
      change_type: "supports-registered",
      happened_on: "2027-07-01",
    };
    expect(notifyBy(row)).toBeNull();
    expect(changeState(row, today)).toBe("to apply");
    expect(changeState({ ...row, applied_on: "2027-06-01" }, today)).toBe(
      "applied",
    );
    expect(
      changeState(
        { ...row, applied_on: "2027-06-01", decided_on: "2027-06-10" },
        today,
      ),
    ).toBe("decided");
  });
});

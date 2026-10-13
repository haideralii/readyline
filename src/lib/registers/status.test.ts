import { describe, expect, it } from "vitest";
import {
  HARM_SEVERITIES,
  addBusinessDays,
  addDays,
  clearanceStatus,
  daysBetween,
  incidentNotificationStatus,
  incidentNotifyBy,
  parseIsoDate,
  registerStatus,
  reviewStatus,
} from "./status";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORIES_24H,
  INCIDENT_CATEGORIES_5BD,
  INCIDENT_SEVERITIES,
  NDIS_NUMBER_SHAPE,
  REF_PATTERNS,
} from "./types";

// 2026-10-13 is a Tuesday; 2026-10-09 a Friday; 2026-10-10 a Saturday.
const TODAY = "2026-10-13";

describe("registerStatus (REQ-009 AC-2)", () => {
  describe("clearance: 89 / 90 / 91 days", () => {
    it.each([
      [89, "expiring"],
      [90, "expiring"],
      [91, "valid"],
      [0, "expiring"],
      [-1, "expired"],
      [400, "valid"],
    ])("%i days away is %s", (days, status) => {
      expect(clearanceStatus(addDays(TODAY, days), TODAY)).toBe(status);
    });
    it("no expiry (the orientation module) is always valid", () => {
      expect(clearanceStatus(null, TODAY)).toBe("valid");
    });
  });

  describe("policy review: 59 / 60 / 61 days", () => {
    it.each([
      [59, "due-soon"],
      [60, "due-soon"],
      [61, "current"],
      [0, "due-soon"],
      [-1, "overdue"],
    ])("%i days away is %s", (days, status) => {
      expect(reviewStatus(addDays(TODAY, days), TODAY)).toBe(status);
    });
    it("no review date means not adopted yet", () => {
      expect(reviewStatus(null, TODAY)).toBe("not-adopted");
    });
  });

  describe("business days over a weekend", () => {
    it("Friday plus 5 business days is the next Friday", () => {
      expect(addBusinessDays("2026-10-09", 5)).toBe("2026-10-16");
    });
    it("Friday plus 1 business day is Monday", () => {
      expect(addBusinessDays("2026-10-09", 1)).toBe("2026-10-12");
    });
    it("a Saturday start counts from Monday", () => {
      expect(addBusinessDays("2026-10-10", 1)).toBe("2026-10-12");
      expect(addBusinessDays("2026-10-11", 5)).toBe("2026-10-16");
    });
    it("zero days is the same date, and a mid-week run never touches a weekend", () => {
      expect(addBusinessDays("2026-10-13", 0)).toBe("2026-10-13");
      expect(addBusinessDays("2026-10-13", 3)).toBe("2026-10-16");
    });
    it("crosses a month and a year end", () => {
      expect(addBusinessDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(addBusinessDays("2026-10-30", 1)).toBe("2026-11-02");
    });
    it("rejects a negative or fractional count", () => {
      expect(() => addBusinessDays(TODAY, -1)).toThrow();
      expect(() => addBusinessDays(TODAY, 1.5)).toThrow();
    });
  });

  describe("notify_by by category (AC-1 rule, same as the database)", () => {
    it("the five 24-hour kinds are due the next day, even over a weekend, at any severity", () => {
      for (const c of INCIDENT_CATEGORIES_24H)
        for (const s of INCIDENT_SEVERITIES)
          expect(incidentNotifyBy("2026-10-09", c, true, s)).toBe("2026-10-10");
    });
    it("a low-severity unauthorised restrictive practice is due in 5 business days", () => {
      for (const c of INCIDENT_CATEGORIES_5BD)
        expect(incidentNotifyBy("2026-10-09", c, true, "low")).toBe(
          "2026-10-16",
        );
    });
    it("an unauthorised restrictive practice that caused harm (medium or high) is due the next day (D-902)", () => {
      expect(HARM_SEVERITIES).toEqual(["medium", "high"]);
      for (const c of INCIDENT_CATEGORIES_5BD)
        for (const s of HARM_SEVERITIES)
          expect(incidentNotifyBy("2026-10-09", c, true, s)).toBe("2026-10-10");
    });
    it("the other categories and an incident not flagged reportable have no date", () => {
      for (const c of INCIDENT_CATEGORIES)
        for (const s of INCIDENT_SEVERITIES) {
          expect(incidentNotifyBy("2026-10-09", c, false, s)).toBeNull();
          if (
            !INCIDENT_CATEGORIES_24H.includes(c) &&
            !INCIDENT_CATEGORIES_5BD.includes(c)
          )
            expect(incidentNotifyBy("2026-10-09", c, true, s)).toBeNull();
        }
    });
    it("every category is in exactly one window or none", () => {
      for (const c of INCIDENT_CATEGORIES_24H)
        expect(INCIDENT_CATEGORIES_5BD).not.toContain(c);
      expect(INCIDENT_CATEGORIES_24H).toHaveLength(5);
      expect(INCIDENT_CATEGORIES_5BD).toEqual([
        "restrictive-practice-unauthorised",
      ]);
    });
  });

  describe("incident notification status", () => {
    it("due until notify_by, overdue after it, notified once a date is entered", () => {
      const base = { reportable: true, reportable_notified_on: null };
      expect(
        incidentNotificationStatus({ ...base, notify_by: TODAY }, TODAY),
      ).toBe("notification-due");
      expect(
        incidentNotificationStatus(
          { ...base, notify_by: addDays(TODAY, -1) },
          TODAY,
        ),
      ).toBe("overdue-notification");
      expect(
        incidentNotificationStatus(
          {
            ...base,
            notify_by: addDays(TODAY, -1),
            reportable_notified_on: TODAY,
          },
          TODAY,
        ),
      ).toBe("notified");
      expect(
        incidentNotificationStatus(
          { reportable: false, notify_by: null, reportable_notified_on: null },
          TODAY,
        ),
      ).toBe("not-reportable");
    });
  });

  it("the umbrella object exposes the four rules", () => {
    expect(registerStatus.clearance).toBe(clearanceStatus);
    expect(registerStatus.review).toBe(reviewStatus);
    expect(registerStatus.incident).toBe(incidentNotificationStatus);
    expect(registerStatus.notifyBy).toBe(incidentNotifyBy);
  });

  describe("date helpers", () => {
    it("parse, add and diff on calendar days in UTC", () => {
      expect(daysBetween("2026-10-01", "2026-10-13")).toBe(12);
      expect(daysBetween("2026-10-13", "2026-10-01")).toBe(-12);
      expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
      expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
      expect(parseIsoDate("1970-01-01")).toBe(0);
    });
    it("rejects impossible or non-ISO dates", () => {
      expect(() => parseIsoDate("2026-02-30")).toThrow();
      expect(() => parseIsoDate("13/10/2026")).toThrow();
      expect(() => parseIsoDate("2026-10-13T00:00:00Z")).toThrow();
    });
  });

  describe("patterns shared with the database CHECKs (SR-1)", () => {
    it("accepts reference codes and rejects names and numbers", () => {
      expect(REF_PATTERNS.participant.test("P-014")).toBe(true);
      expect(REF_PATTERNS.participant.test("PT1")).toBe(true);
      expect(REF_PATTERNS.participant.test("Jane Citizen")).toBe(false);
      expect(REF_PATTERNS.worker.test("W-003")).toBe(true);
      expect(REF_PATTERNS.worker.test("P-003")).toBe(false);
      expect(REF_PATTERNS.complaintFrom.test("FAM-2")).toBe(true);
      expect(REF_PATTERNS.complaintFrom.test("X-2")).toBe(false);
      expect(REF_PATTERNS.incidentReference.test("INC-0001")).toBe(true);
      expect(REF_PATTERNS.complaintReference.test("CMP-12345")).toBe(true);
    });
    it("spots an NDIS-number shape inside prose and ignores other numbers", () => {
      expect(NDIS_NUMBER_SHAPE.test("participant 430123456 fell")).toBe(true);
      expect(NDIS_NUMBER_SHAPE.test("430123456")).toBe(true);
      expect(NDIS_NUMBER_SHAPE.test("ref 1430123456")).toBe(false);
      expect(NDIS_NUMBER_SHAPE.test("called 0412345678")).toBe(false);
      expect(NDIS_NUMBER_SHAPE.test("INC-0043 at 4:30")).toBe(false);
    });
  });
});

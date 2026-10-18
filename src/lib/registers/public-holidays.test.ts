// @vitest-environment node
/**
 * REQ-032 FR-1, FR-2, FR-3 (TypeScript side), FR-5, FR-6, SR-2: the table's
 * shape and counts, the known dates, one state-only day per state, the
 * every-state rule, the count with the bracket's words, the fallback past
 * the table, the loader's refusals, and the year-runs-out check (D-2918).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FIRST_HOLIDAY_YEAR,
  HOLIDAY_ROWS,
  HOLIDAY_TABLE_DUE_FROM,
  JURISDICTIONS,
  LAST_HOLIDAY_YEAR,
  PUBLIC_HOLIDAYS,
  PUBLIC_HOLIDAY_SOURCE,
  addBusinessDaysDetailed,
  businessDaysBracket,
  holidayStates,
  holidayTableRunsOut,
  parseHolidayYear,
  publicHolidayIn,
} from "./public-holidays";
import { addBusinessDays } from "./status";
import { sydneyDay } from "@/lib/metrics/counters";

const count = (year: number, j: string) =>
  HOLIDAY_ROWS.filter(
    (r) => r.date.startsWith(`${year}-`) && r.jurisdiction === j,
  ).length;
const name = (date: string, j: string) =>
  HOLIDAY_ROWS.find((r) => r.date === date && r.jurisdiction === j)?.name ??
  null;

describe("the public holiday table (FR-1)", () => {
  it("covers 2026 and 2027 with the row counts typed from the eight pages on 18 October 2026", () => {
    expect(PUBLIC_HOLIDAYS.map((f) => f.year)).toEqual([2026, 2027]);
    expect([FIRST_HOLIDAY_YEAR, LAST_HOLIDAY_YEAR]).toEqual([2026, 2027]);
    expect(
      Object.fromEntries(JURISDICTIONS.map((j) => [j, count(2026, j)])),
    ).toEqual({
      NSW: 13,
      VIC: 14,
      QLD: 12,
      SA: 13,
      WA: 13,
      TAS: 9,
      ACT: 15,
      NT: 13,
    });
    expect(
      Object.fromEntries(JURISDICTIONS.map((j) => [j, count(2027, j)])),
    ).toEqual({
      NSW: 14,
      VIC: 14,
      QLD: 13,
      SA: 14,
      WA: 14,
      TAS: 10,
      ACT: 16,
      NT: 14,
    });
  });

  it("holds the national days in every jurisdiction and one state-only day per state", () => {
    for (const j of JURISDICTIONS) {
      expect(name("2026-01-01", j), j).toBe("New Year's Day");
      expect(name("2026-01-26", j), j).toBe("Australia Day");
      expect(name("2026-04-03", j), j).toBe("Good Friday");
      expect(name("2026-12-25", j), j).toBe("Christmas Day");
      expect(name("2027-03-26", j), j).toBe("Good Friday");
      expect(name("2027-12-27", j), j).toBe("Christmas Day additional day");
    }
    const only = (date: string, j: string, n: string) => {
      expect(name(date, j)).toBe(n);
      for (const other of JURISDICTIONS)
        if (other !== j)
          expect(name(date, other), `${date} ${other}`).not.toBe(n);
    };
    // NSW shares every one of its days with another state (Labour Day with SA and ACT); VIC has none that day.
    expect(name("2026-10-05", "NSW")).toBe("Labour Day");
    expect(name("2026-10-05", "VIC")).toBeNull();
    only("2026-11-03", "VIC", "Melbourne Cup Day");
    only("2026-05-04", "QLD", "Labour Day");
    only("2026-03-09", "SA", "Adelaide Cup Day");
    only("2026-06-01", "WA", "Western Australia Day");
    only("2026-03-09", "TAS", "Eight Hours Day");
    only("2026-03-09", "ACT", "Canberra Day");
    only("2026-08-03", "NT", "Picnic Day");
    // Anzac Day 2027 falls on a Sunday: QLD and NT observe the Monday; NSW, WA and ACT add a day; VIC, SA and TAS do not.
    expect(name("2027-04-26", "QLD")).toBe("Anzac Day");
    expect(name("2027-04-26", "NSW")).toBe("Anzac Day additional day");
    expect(name("2027-04-26", "VIC")).toBeNull();
    // Tasmania observes the Monday alone when Boxing Day falls on a Saturday.
    expect(name("2026-12-26", "TAS")).toBeNull();
    expect(name("2026-12-28", "TAS")).toBe("Boxing Day additional day");
  });

  it("names its sources: the eight pages with read dates, the retired dataset, the definition, and the UNVERIFIED rows", () => {
    const s = PUBLIC_HOLIDAY_SOURCE;
    expect(Object.keys(s.jurisdictions).sort()).toEqual(
      [...JURISDICTIONS].sort(),
    );
    for (const j of JURISDICTIONS) {
      const src = s.jurisdictions[j];
      expect(src.url).toMatch(/^https:\/\/[a-z.]+gov\.au\//);
      expect(src.readAt).toBe("2026-10-18");
      expect(src.years).toEqual([2026, 2027]);
    }
    expect(s.definition.text).toBe(
      "business day means a day that is not a Saturday, a Sunday or a public holiday in the place concerned.",
    );
    expect(s.retiredDataset.coverage).toBe("2019-01-01 to 2025-12-31");
    expect(s.unverified.map((u) => u.jurisdiction)).toEqual(["VIC", "QLD"]);
    // The fixture files on disk are the ones loaded.
    for (const year of [2026, 2027])
      expect(
        parseHolidayYear(
          JSON.parse(readFileSync(`data/public-holidays/${year}.json`, "utf8")),
        ).holidays.length,
      ).toBe(HOLIDAY_ROWS.filter((r) => r.date.startsWith(`${year}-`)).length);
  });

  it("SR-2: refuses a row outside the closed list, a date outside the year, a repeated row and a date that is not a day", () => {
    const ok = {
      year: 2026,
      holidays: [
        { date: "2026-01-01", jurisdiction: "NSW", name: "New Year's Day" },
      ],
    };
    expect(() => parseHolidayYear(ok)).not.toThrow();
    expect(() =>
      parseHolidayYear({
        ...ok,
        holidays: [{ ...ok.holidays[0], jurisdiction: "NZ" }],
      }),
    ).toThrow();
    expect(() =>
      parseHolidayYear({
        ...ok,
        holidays: [{ ...ok.holidays[0], date: "2027-01-01" }],
      }),
    ).toThrow(/not in 2026/);
    expect(() =>
      parseHolidayYear({
        ...ok,
        holidays: [{ ...ok.holidays[0], date: "2026-02-30" }],
      }),
    ).toThrow(/calendar date/);
    expect(() =>
      parseHolidayYear({ ...ok, holidays: [ok.holidays[0], ok.holidays[0]] }),
    ).toThrow(/repeated/);
    expect(() =>
      parseHolidayYear({ ...ok, holidays: [{ ...ok.holidays[0], extra: 1 }] }),
    ).toThrow();
  });
});

describe("the place concerned (FR-2)", () => {
  it("counts a day only when it is a holiday in every state named; no state means no holiday", () => {
    expect(publicHolidayIn("2026-11-03", ["VIC"])).toBe("Melbourne Cup Day");
    expect(publicHolidayIn("2026-11-03", ["NSW", "VIC"])).toBeNull();
    expect(publicHolidayIn("2026-04-03", ["NSW", "VIC", "WA"])).toBe(
      "Good Friday",
    );
    // Named as the first state in the table's order names it, whatever order the account lists them.
    expect(publicHolidayIn("2026-12-26", ["SA", "NSW"])).toBe("Boxing Day");
    expect(publicHolidayIn("2026-12-26", ["SA"])).toBe("Proclamation Day");
    expect(publicHolidayIn("2026-04-03", [])).toBeNull();
    expect(publicHolidayIn("2028-04-14", ["NSW"])).toBeNull();
    expect(holidayStates(["nsw", "Vic", "Overseas", "NSW"])).toEqual([
      "NSW",
      "VIC",
    ]);
  });
});

describe("the count with the bracket's words (FR-3, FR-5, FR-6; AC-1's dates)", () => {
  it("NSW: Thursday 2 April 2026 plus five business days is Monday 13 April, Good Friday and Easter Monday not counting", () => {
    const r = addBusinessDaysDetailed("2026-04-02", 5, ["NSW"]);
    expect(r.date).toBe("2026-04-13");
    expect(r.skipped.map((s) => s.name)).toEqual([
      "Good Friday",
      "Easter Monday",
    ]);
    expect(businessDaysBracket(r)).toBe(
      "(Good Friday and Easter Monday do not count)",
    );
    expect(addBusinessDays("2026-04-02", 5, ["NSW"])).toBe("2026-04-13");
    // Both days are national, so {NSW, WA} reads the same.
    expect(addBusinessDaysDetailed("2026-04-02", 5, ["NSW", "WA"]).date).toBe(
      "2026-04-13",
    );
  });

  it("{NSW, VIC}: Friday 30 October 2026 plus five is Friday 6 November; VIC alone skips Melbourne Cup Day to Monday 9 November", () => {
    const both = addBusinessDaysDetailed("2026-10-30", 5, ["NSW", "VIC"]);
    expect(both.date).toBe("2026-11-06");
    expect(businessDaysBracket(both)).toBeNull();
    const vic = addBusinessDaysDetailed("2026-10-30", 5, ["VIC"]);
    expect(vic.date).toBe("2026-11-09");
    expect(businessDaysBracket(vic)).toBe("(Melbourne Cup Day does not count)");
  });

  it("the two-argument form is weekends only, as before, and equals the three-argument form with no state", () => {
    expect(addBusinessDays("2026-04-02", 5)).toBe("2026-04-09");
    expect(addBusinessDays("2026-04-02", 5, [])).toBe("2026-04-09");
    expect(addBusinessDaysDetailed("2026-10-09", 5).date).toBe("2026-10-16");
    expect(addBusinessDays("2026-10-13", 0, ["NSW"])).toBe("2026-10-13");
    expect(() => addBusinessDaysDetailed("2026-10-13", -1, ["NSW"])).toThrow();
  });

  it("FR-6: past the table's last year the count is weekends only and the bracket says so", () => {
    const r = addBusinessDaysDetailed("2028-04-13", 5, ["NSW"]);
    expect(r.date).toBe("2028-04-20");
    expect(r.beyondTable).toBe(true);
    expect(businessDaysBracket(r)).toBe(
      "(public holidays after 2027 are not yet counted)",
    );
    // A count that ends inside the table carries no such line.
    expect(addBusinessDaysDetailed("2027-12-20", 2, ["NSW"]).beyondTable).toBe(
      false,
    );
  });

  it("D-2918: the next year's table is due from 1 October of the last year, and today is before it", () => {
    expect(HOLIDAY_TABLE_DUE_FROM).toBe("2027-10-01");
    expect(holidayTableRunsOut("2027-10-01")).toBe(true);
    expect(holidayTableRunsOut("2027-09-30")).toBe(false);
    // Fails from 1 October 2027 until 2028's file is added (FR-6).
    expect(holidayTableRunsOut(sydneyDay())).toBe(false);
  });
});

// @vitest-environment node
/**
 * REQ-012 FR-4d (AC-11; D-2910, D-2906): a source past its cadence is
 * flagged, with a fixed date per kind; a third-party price older than 30
 * days is flagged; a legislation compilation is never flagged by age.
 */
import { describe, expect, it } from "vitest";
import {
  cadenceDays,
  cadenceReport,
  daysBetween,
  flagSource,
  flagSources,
} from "./source-cadence-lib.mjs";

const TODAY = "2026-10-19";

describe("the read cadence (REQ-012 FR-4d)", () => {
  it("names each kind's cadence as D-2910 and D-2906 set them", () => {
    expect(cadenceDays("commission-reform")).toBe(30);
    expect(cadenceDays("commission-apply")).toBe(30);
    expect(cadenceDays("practice-standards")).toBe(90);
    expect(cadenceDays("legislation")).toBeNull();
    expect(cadenceDays("third-party-price")).toBe(30);
    expect(() => cadenceDays("blog")).toThrow(/unknown source kind/);
  });

  it("counts whole days between ISO days", () => {
    expect(daysBetween("2026-09-19", TODAY)).toBe(30);
    expect(daysBetween("2026-07-21", TODAY)).toBe(90);
  });

  it("flags a Commission reform page read 31 days ago and passes one read 30 days ago", () => {
    expect(
      flagSource(
        { id: "reform", kind: "commission-reform", readOn: "2026-09-18" },
        TODAY,
      ).stale,
    ).toBe(true);
    expect(
      flagSource(
        { id: "reform", kind: "commission-reform", readOn: "2026-09-19" },
        TODAY,
      ).stale,
    ).toBe(false);
  });

  it("flags a Practice Standards page at 91 days and not at 90", () => {
    expect(
      flagSource(
        { id: "ps", kind: "practice-standards", readOn: "2026-07-20" },
        TODAY,
      ).stale,
    ).toBe(true);
    expect(
      flagSource(
        { id: "ps", kind: "practice-standards", readOn: "2026-07-21" },
        TODAY,
      ).stale,
    ).toBe(false);
  });

  it("flags a third-party price older than 30 days (D-2906)", () => {
    expect(
      flagSource(
        {
          id: "providerplus-cost",
          kind: "third-party-price",
          readOn: "2026-09-01",
        },
        TODAY,
      ).stale,
    ).toBe(true);
    expect(
      flagSource(
        {
          id: "providerplus-cost",
          kind: "third-party-price",
          readOn: "2026-10-13",
        },
        TODAY,
      ).stale,
    ).toBe(false);
  });

  it("never flags a legislation compilation by age, and flags a source with no read date", () => {
    const leg = flagSource(
      { id: "act", kind: "legislation", readOn: "2026-01-01" },
      TODAY,
    );
    expect(leg.stale).toBe(false);
    expect(leg.note).toMatch(/watch-changes/);
    expect(
      flagSource({ id: "x", kind: "commission-page", readOn: null }, TODAY),
    ).toMatchObject({ stale: true, note: "no read date" });
  });

  it("the report puts the stale sources first and counts them", () => {
    const lines = cadenceReport(
      flagSources(
        [
          { id: "ok", kind: "practice-standards", readOn: "2026-10-01" },
          { id: "old", kind: "third-party-price", readOn: "2026-08-01" },
        ],
        TODAY,
      ),
    );
    expect(lines[0]).toMatch(/^RE-FETCH old \[third-party-price\]/);
    expect(lines.at(-1)).toBe(
      "cadence: 1 of 2 source(s) past their read cadence",
    );
  });
});

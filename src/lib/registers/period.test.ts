import { describe, expect, it } from "vitest";
import {
  ALL_PERIOD,
  PERIOD_COLUMNS,
  inPeriod,
  isIsoDate,
  parsePeriodParams,
  parsePeriodSearch,
  periodContextFrom,
  periodFileSuffix,
  periodFilter,
  periodFromParams,
  periodGuarded,
  periodLabel,
  periodQuery,
  periodShownLine,
  resolvePeriod,
  type Period,
} from "./period";

/**
 * REQ-023 Session B, FR-5 and SR-3 (AC-9): the closed list, the two ISO
 * dates, `from` not after `to`, at most ten years; the defaults per surface;
 * the labels, file suffixes and query strings the pages and exports share.
 */
const ctx = { periodStart: "2026-03-01", lastAuditOn: "2027-03-01" };

describe("parsePeriodParams (FR-5, SR-3)", () => {
  it("names no period when the query carries none", () => {
    expect(parsePeriodParams({})).toEqual({ ok: true, selection: null });
    expect(parsePeriodParams({ saved: "1" })).toEqual({
      ok: true,
      selection: null,
    });
  });

  it("accepts each kind of the closed list", () => {
    for (const kind of ["all", "period", "since-last-audit"] as const)
      expect(parsePeriodParams({ period: kind })).toEqual({
        ok: true,
        selection: { kind },
      });
    expect(
      parsePeriodParams({
        period: "custom",
        from: "2027-01-01",
        to: "2027-06-30",
      }),
    ).toEqual({
      ok: true,
      selection: { kind: "custom", from: "2027-01-01", to: "2027-06-30" },
    });
  });

  it("refuses the three invalid cases of AC-9: eleven years, from after to, a non-date", () => {
    expect(
      parsePeriodParams({
        period: "custom",
        from: "2020-01-01",
        to: "2031-01-01",
      }),
    ).toEqual({ ok: false, reason: "span" });
    expect(
      parsePeriodParams({
        period: "custom",
        from: "2027-06-30",
        to: "2027-01-01",
      }),
    ).toEqual({ ok: false, reason: "order" });
    expect(
      parsePeriodParams({
        period: "custom",
        from: "yesterday",
        to: "2027-01-01",
      }),
    ).toEqual({ ok: false, reason: "dates" });
    // A date that does not exist is not a date.
    expect(
      parsePeriodParams({
        period: "custom",
        from: "2027-02-30",
        to: "2027-03-01",
      }),
    ).toEqual({ ok: false, reason: "dates" });
  });

  it("allows exactly ten years and refuses one day more", () => {
    expect(
      parsePeriodParams({
        period: "custom",
        from: "2020-01-01",
        to: "2030-01-01",
      }).ok,
    ).toBe(true);
    expect(
      parsePeriodParams({
        period: "custom",
        from: "2020-01-01",
        to: "2030-01-02",
      }),
    ).toEqual({ ok: false, reason: "span" });
  });

  it("refuses an unknown kind, dates beside a named kind, dates with no kind, a missing date and a repeated parameter", () => {
    expect(parsePeriodParams({ period: "bogus" })).toEqual({
      ok: false,
      reason: "kind",
    });
    expect(parsePeriodParams({ period: "all", from: "2027-01-01" })).toEqual({
      ok: false,
      reason: "extra",
    });
    expect(parsePeriodParams({ from: "2027-01-01", to: "2027-02-01" })).toEqual(
      { ok: false, reason: "extra" },
    );
    expect(parsePeriodParams({ period: "custom", from: "2027-01-01" })).toEqual(
      { ok: false, reason: "dates" },
    );
    expect(parsePeriodParams({ period: ["all", "period"] })).toEqual({
      ok: false,
      reason: "repeat",
    });
  });

  it("reads a URL's search parameters the same way", () => {
    expect(
      parsePeriodSearch(new URLSearchParams("period=since-last-audit")),
    ).toEqual({ ok: true, selection: { kind: "since-last-audit" } });
    expect(
      parsePeriodSearch(new URLSearchParams("period=all&period=period")),
    ).toEqual({ ok: false, reason: "repeat" });
    expect(parsePeriodSearch(new URLSearchParams("saved=1"))).toEqual({
      ok: true,
      selection: null,
    });
  });

  it("knows a real calendar day", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2027-13-01")).toBe(false);
    expect(isIsoDate("27-01-01")).toBe(false);
    expect(isIsoDate(20270101)).toBe(false);
  });
});

describe("resolvePeriod: the defaults per surface and the dates the account has (FR-5, D-2305)", () => {
  it("defaults to all on a register page and to the registration period on the pack and the auditor page", () => {
    expect(resolvePeriod(null, ctx, "all")).toEqual({
      period: ALL_PERIOD,
      unavailable: null,
    });
    expect(resolvePeriod(null, ctx, "period")).toEqual({
      period: { kind: "period", from: "2026-03-01", to: null },
      unavailable: null,
    });
  });

  it("falls back to all, quietly, when the pack's default has no period to read", () => {
    expect(
      resolvePeriod(null, { periodStart: null, lastAuditOn: null }, "period"),
    ).toEqual({ period: ALL_PERIOD, unavailable: null });
  });

  it("resolves the named kinds against the context", () => {
    expect(
      resolvePeriod({ kind: "since-last-audit" }, ctx, "all").period,
    ).toEqual({ kind: "since-last-audit", from: "2027-03-01", to: null });
    expect(resolvePeriod({ kind: "period" }, ctx, "all").period).toEqual({
      kind: "period",
      from: "2026-03-01",
      to: null,
    });
    expect(
      resolvePeriod(
        { kind: "custom", from: "2027-01-01", to: "2027-06-30" },
        ctx,
        "all",
      ).period,
    ).toEqual({ kind: "custom", from: "2027-01-01", to: "2027-06-30" });
  });

  it("says which date is missing when the URL asks for one the account has not entered, and shows all", () => {
    expect(
      resolvePeriod(
        { kind: "since-last-audit" },
        { periodStart: "2026-03-01", lastAuditOn: null },
        "all",
      ),
    ).toEqual({ period: ALL_PERIOD, unavailable: "since-last-audit" });
    expect(
      resolvePeriod(
        { kind: "period" },
        { periodStart: null, lastAuditOn: null },
        "period",
      ),
    ).toEqual({ period: ALL_PERIOD, unavailable: "period" });
  });

  it("parses and resolves in one call, refusing the malformed query", () => {
    expect(
      periodFromParams({ period: "since-last-audit" }, ctx, "all"),
    ).toEqual({
      ok: true,
      period: { kind: "since-last-audit", from: "2027-03-01", to: null },
      unavailable: null,
    });
    expect(periodFromParams({ period: "x" }, ctx, "all")).toEqual({
      ok: false,
      reason: "kind",
    });
  });

  it("builds the context from the current period row, or none", () => {
    expect(
      periodContextFrom({
        period_starts_on: "2026-03-01",
        last_audit_on: null,
      }),
    ).toEqual({ periodStart: "2026-03-01", lastAuditOn: null });
    expect(periodContextFrom(null)).toEqual({
      periodStart: null,
      lastAuditOn: null,
    });
  });
});

describe("inPeriod and periodFilter: inclusive bounds, a dateless row stays (D-2340 A)", () => {
  const since: Period = {
    kind: "since-last-audit",
    from: "2027-03-01",
    to: null,
  };
  const range: Period = {
    kind: "custom",
    from: "2027-01-01",
    to: "2027-06-30",
  };

  it("keeps the rows on and after the date for an open-ended period", () => {
    expect(inPeriod("2027-02-28", since)).toBe(false);
    expect(inPeriod("2027-03-01", since)).toBe(true);
    expect(inPeriod("2027-03-01T10:00:00Z", since)).toBe(true);
    expect(inPeriod("2029-01-01", since)).toBe(true);
  });

  it("keeps the rows between the two dates, both included, for a range", () => {
    expect(inPeriod("2026-12-31", range)).toBe(false);
    expect(inPeriod("2027-01-01", range)).toBe(true);
    expect(inPeriod("2027-06-30", range)).toBe(true);
    expect(inPeriod("2027-07-01", range)).toBe(false);
  });

  it("keeps a row with no date in every view, and every row under all", () => {
    expect(inPeriod(null, range)).toBe(true);
    expect(inPeriod(undefined, since)).toBe(true);
    expect(inPeriod("1999-01-01", ALL_PERIOD)).toBe(true);
  });

  it("writes the PostgREST filter for the register's date column, or none for all", () => {
    expect(periodFilter(PERIOD_COLUMNS.incidents, since)).toBe(
      "occurred_on.is.null,occurred_on.gte.2027-03-01",
    );
    expect(periodFilter(PERIOD_COLUMNS.policy_reviews, range)).toBe(
      "last_reviewed_on.is.null,and(last_reviewed_on.gte.2027-01-01,last_reviewed_on.lte.2027-06-30)",
    );
    expect(periodFilter("received_on", ALL_PERIOD)).toBeNull();
    expect(() =>
      periodFilter("occurred_on", {
        kind: "custom",
        from: "2027-01-01)",
        to: "2027-06-30",
      }),
    ).toThrow();
  });
});

describe("the words, the file suffix and the query string (FR-5)", () => {
  const period: Period = { kind: "period", from: "2026-03-01", to: null };
  const since: Period = {
    kind: "since-last-audit",
    from: "2027-03-01",
    to: null,
  };
  const range: Period = {
    kind: "custom",
    from: "2027-01-01",
    to: "2027-06-30",
  };

  it("labels each kind in long dates", () => {
    expect(periodLabel(ALL_PERIOD)).toBe("All entries");
    expect(periodLabel(period)).toBe(
      "This registration period (from 1 March 2026)",
    );
    expect(periodLabel(since)).toBe("Since the last audit (from 1 March 2027)");
    expect(periodLabel(range)).toBe("1 January 2027 to 30 June 2027");
    expect(periodShownLine(since)).toBe(
      "Period shown: Since the last audit (from 1 March 2027).",
    );
  });

  it("names the period in a file name after the date stamp, nothing for all", () => {
    expect(periodFileSuffix(ALL_PERIOD)).toBe("");
    expect(periodFileSuffix(period)).toBe("-this-period-from-2026-03-01");
    expect(periodFileSuffix(since)).toBe("-since-audit-2027-03-01");
    expect(periodFileSuffix(range)).toBe("-2027-01-01-to-2027-06-30");
  });

  it("carries the period on a link, explicitly for all only where the default is not all", () => {
    expect(periodQuery(ALL_PERIOD)).toBe("");
    expect(periodQuery(ALL_PERIOD, { explicitAll: true })).toBe("?period=all");
    expect(periodQuery(since)).toBe("?period=since-last-audit");
    expect(periodQuery(range)).toBe(
      "?period=custom&from=2027-01-01&to=2027-06-30",
    );
  });

  it("guards the three surfaces' paths and nothing else", () => {
    expect(periodGuarded("/registers")).toBe(true);
    expect(periodGuarded("/registers/incidents/export.zip")).toBe(true);
    expect(periodGuarded("/path/audit-day/what-changed")).toBe(true);
    expect(periodGuarded("/auditor/abc")).toBe(true);
    expect(periodGuarded("/registersx")).toBe(false);
    expect(periodGuarded("/account")).toBe(false);
  });
});

// @vitest-environment node
/**
 * REQ-032 FR-5, FR-6, D-2920: the bracket on a notify-by date names the
 * holidays that moved it; the 24-hour kinds, a harmful restrictive
 * practice, a date no holiday moved and an account with no state carry
 * none; past the table it says holidays are not yet counted.
 */
import { describe, expect, it } from "vitest";
import { formatLongDate } from "./status";
import {
  notifyByBracket,
  notifyByWords,
  notifyClockFrom,
  type NotifyByRow,
} from "./notify-by-line";

const rp = (over: Partial<NotifyByRow> = {}): NotifyByRow => ({
  occurred_on: "2026-04-02",
  aware_on: null,
  category: "restrictive-practice-unauthorised",
  severity: "low",
  reportable: true,
  notify_by: "2026-04-13",
  ...over,
});

describe("the notify-by bracket (REQ-032 FR-5)", () => {
  it("names the holidays that moved a five-business-day date, for the account's states", () => {
    expect(notifyByBracket(rp(), ["NSW"])).toBe(
      "(Good Friday and Easter Monday do not count)",
    );
    expect(notifyByWords(rp(), ["NSW"], formatLongDate)).toBe(
      "13 April 2026 (Good Friday and Easter Monday do not count)",
    );
    expect(notifyByWords(rp(), ["NSW"])).toBe(
      "2026-04-13 (Good Friday and Easter Monday do not count)",
    );
  });

  it("carries no bracket when nothing moved the date, for a 24-hour kind, a harmful practice, or an account with no state", () => {
    expect(
      notifyByBracket(
        rp({ occurred_on: "2026-10-30", notify_by: "2026-11-06" }),
        ["NSW"],
      ),
    ).toBeNull();
    expect(
      notifyByBracket(rp({ category: "death", notify_by: "2026-04-03" }), [
        "NSW",
      ]),
    ).toBeNull();
    expect(
      notifyByBracket(rp({ severity: "high", notify_by: "2026-04-03" }), [
        "NSW",
      ]),
    ).toBeNull();
    expect(notifyByBracket(rp(), [])).toBeNull();
    expect(
      notifyByBracket(rp({ reportable: false, notify_by: null }), ["NSW"]),
    ).toBeNull();
    expect(notifyByWords(rp({ notify_by: null }), ["NSW"])).toBe("");
  });

  it("runs the clock from the later of the event and the day the provider became aware", () => {
    expect(
      notifyClockFrom({ occurred_on: "2026-04-01", aware_on: "2026-04-02" }),
    ).toBe("2026-04-02");
    expect(
      notifyClockFrom({ occurred_on: "2026-04-02", aware_on: "2026-04-01" }),
    ).toBe("2026-04-02");
    expect(notifyClockFrom({ occurred_on: "2026-04-02" })).toBe("2026-04-02");
    // VIC alone on the Melbourne Cup week: the aware day moves the clock, the bracket follows.
    expect(
      notifyByBracket(
        rp({
          occurred_on: "2026-10-29",
          aware_on: "2026-10-30",
          notify_by: "2026-11-09",
        }),
        ["VIC"],
      ),
    ).toBe("(Melbourne Cup Day does not count)");
  });

  it("FR-6: past the table's last year the bracket says holidays are not yet counted", () => {
    expect(
      notifyByBracket(
        rp({ occurred_on: "2028-04-13", notify_by: "2028-04-20" }),
        ["NSW"],
      ),
    ).toBe("(public holidays after 2027 are not yet counted)");
  });
});

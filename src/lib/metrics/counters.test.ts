import { describe, expect, it } from "vitest";
import {
  COUNTER_EVENTS,
  sumCounters,
  sydneyDay,
  windowStart,
} from "./counters";

describe("first-party counters (batch 45 item 12, D-2002)", () => {
  it("sums per event over the rows and shows zero for an event with no rows", () => {
    const sums = sumCounters([
      { event: "start-view", count: 3 },
      { event: "start-view", count: 4 },
      { event: "buy-click", count: 1 },
      { event: "not-an-event", count: 99 },
    ]);
    expect(sums).toEqual({
      "start-view": 7,
      "result-shown": 0,
      "buy-click": 1,
      "subscribe-click": 0,
      "finish-completed": 0,
    });
    expect(Object.keys(sums)).toEqual([...COUNTER_EVENTS]);
  });

  it("the 30-day window ends today and starts 29 days before it", () => {
    expect(windowStart("2026-10-14")).toBe("2026-09-15");
    expect(windowStart("2026-03-01", 2)).toBe("2026-02-28");
  });

  it("the day is Sydney's, not the server's", () => {
    // 23:30 UTC on 14 October is 10:30 on 15 October in Sydney (AEDT).
    expect(sydneyDay(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-15");
    expect(sydneyDay(new Date("2026-10-14T12:00:00Z"))).toBe("2026-10-14");
  });
});

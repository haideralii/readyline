import { describe, expect, it } from "vitest";
import { MAX_PURGE_AGE_DAYS, judgePurgeAge } from "./data-promises-lib.mjs";

/**
 * REQ-030 FR-5, AC-9 (D-2869): the newest purge run at 3 days is a failure
 * naming the age; at 1 day it passes; no row and an unreadable time fail.
 */
describe("judgePurgeAge", () => {
  const now = new Date("2026-10-18T03:00:00Z");

  it("AC-9: three days old fails naming the age; one day old passes", () => {
    const three = judgePurgeAge("2026-10-15 03:00:00.000000+00", now);
    expect(three.ok).toBe(false);
    expect(three.line).toMatch(/^FAIL the newest purge run is 3 days old/);
    const one = judgePurgeAge("2026-10-17T03:00:00Z", now);
    expect(one.ok).toBe(true);
    expect(one.line).toBe("ok   the newest purge run is 1 days old");
  });

  it("the promise is two days", () => {
    expect(MAX_PURGE_AGE_DAYS).toBe(2);
    expect(judgePurgeAge("2026-10-16T03:00:01Z", now).ok).toBe(true);
    expect(judgePurgeAge("2026-10-16T02:59:59Z", now).ok).toBe(false);
  });

  it("no row and an unreadable time fail with a plain line", () => {
    expect(judgePurgeAge("", now).line).toMatch(/^FAIL no jobs.purge.ran row/);
    expect(judgePurgeAge("   ", now).ok).toBe(false);
    expect(judgePurgeAge("not a time", now).line).toMatch(/could not be read/);
  });
});

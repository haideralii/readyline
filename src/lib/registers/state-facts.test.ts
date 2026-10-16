import { describe, expect, it } from "vitest";
import {
  CHECK_PART_4,
  CHECK_YOUR_UNIT,
  formatLongDay,
  isStale,
  part4EndFor,
  part4FactsFor,
  screeningFactsFor,
  STATE_FILE,
} from "./state-facts";

/**
 * REQ-024 FR-2a (D-2404 as amended, D-2426 as amended): the onboarding
 * read of the state file at a fixed `today`: a verified, fresh read shows
 * the unit's words; a missing, unverified or stale read falls back to the
 * national wording; the national block's Part 4 line names the section, the
 * end date and the day the Rules were read, or its own fallback when stale.
 */
const TODAY = "2026-11-02";

describe("state facts for worker onboarding (REQ-024 FR-2a)", () => {
  it("isStale: no date, a bad date, or more than six months before today", () => {
    expect(isStale(undefined, TODAY)).toBe(true);
    expect(isStale("", TODAY)).toBe(true);
    expect(isStale("yesterday", TODAY)).toBe(true);
    expect(isStale("2026-10-16", TODAY)).toBe(false);
    expect(isStale("2026-05-03", TODAY)).toBe(false);
    expect(isStale("2026-05-02", TODAY)).toBe(true);
  });

  it("a verified fresh read gives the unit's words; Victoria prohibits, WA allows", () => {
    const vic = screeningFactsFor("VIC", TODAY)!;
    expect(vic.applicationProhibitsPending).toBe(true);
    expect(vic.pendingWorkAllowed).toBe(false);
    expect(vic.pendingLine).toMatch(/^Victoria: .*no clearance, no start/i);
    const wa = screeningFactsFor("WA", TODAY)!;
    expect(wa.pendingWorkAllowed).toBe(true);
    expect(wa.applicationProhibitsPending).toBe(false);
    expect(wa.sources.length).toBeGreaterThan(0);
  });

  it("an unverified read ships no state line: the national wording and 'check your state's unit' (D-2404)", () => {
    for (const code of ["SA", "TAS", "ACT"]) {
      const f = screeningFactsFor(code, TODAY)!;
      expect(f.pendingWorkAllowed, code).toBeNull();
      expect(f.applicationProhibitsPending, code).toBeNull();
      expect(f.pendingLine, code).toContain(CHECK_YOUR_UNIT);
    }
  });

  it("a read older than six months at request time falls back, whatever its status (finding 59)", () => {
    const later = "2027-06-01";
    const vic = screeningFactsFor("VIC", later)!;
    expect(vic.applicationProhibitsPending).toBeNull();
    expect(vic.pendingLine).toContain(CHECK_YOUR_UNIT);
    expect(vic.combinedScheme).toBeNull();
    expect(vic.childrenTermYears).toBeNull();
  });

  it("the combined scheme and the children's term per state (W-2)", () => {
    expect(screeningFactsFor("TAS", TODAY)!.combinedScheme).toBe(
      "one-registration",
    );
    expect(screeningFactsFor("QLD", TODAY)!.combinedScheme).toBe(
      "one-application",
    );
    expect(screeningFactsFor("NSW", TODAY)!.combinedScheme).toBe("separate");
    expect(screeningFactsFor("NT", TODAY)!.childrenTermYears).toBe(2);
    expect(screeningFactsFor("WA", TODAY)!.childrenTermYears).toBe(3);
    expect(screeningFactsFor("XX", TODAY)).toBeNull();
  });

  it("the national Part 4 line names the section, the end date and the day the Rules were read (finding 208)", () => {
    const nsw = part4FactsFor("NSW", TODAY);
    expect(nsw.live).toBe(true);
    expect(nsw.line).toBe(
      "no acceptable state check applies after 31 January 2026 (Rules s 23(7), as the Rules read on 15 October 2026); every Part 4 arrangement has ended by its own date, s 29B at the end of 1 February 2024 (s 29B(10))",
    );
    const vic = part4FactsFor("VIC", TODAY);
    expect(vic.line).toContain("after 31 January 2021 (Rules s 25(3)");
    // Stale at request time: the block's own fallback (finding 187).
    const stale = part4FactsFor("NSW", "2027-06-01");
    expect(stale.live).toBe(false);
    expect(stale.line).toBe(CHECK_PART_4);
    expect(part4FactsFor("XX", TODAY).line).toBe(CHECK_PART_4);
  });

  it("the per-state latest day for the (1)(b) help text, absent where unverified", () => {
    expect(part4EndFor("TAS")).toBe("2024-01-31");
    expect(part4EndFor("QLD")).toBeNull();
    expect(part4EndFor("VIC")).toBeNull();
    expect(formatLongDay("2024-02-01")).toBe("1 February 2024");
    expect(formatLongDay("soon")).toBe("soon");
    expect(STATE_FILE.readAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

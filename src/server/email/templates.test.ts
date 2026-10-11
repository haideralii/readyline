import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import {
  accountDeletedEmail,
  accountPurgedEmail,
  formatDateAu,
} from "./templates";

describe("account emails (REQ-004 FR-6)", () => {
  const deleted = accountDeletedEmail({
    to: "owner@example.test",
    tradingName: "Sunrise Supports",
    deletedAt: new Date("2026-10-11T03:00:00Z"),
    purgeAfter: new Date("2026-11-10T03:00:00Z"),
  });
  const purged = accountPurgedEmail({
    to: "owner@example.test",
    tradingName: "Sunrise Supports",
    purgedAt: new Date("2026-11-11T03:00:00Z"),
  });

  it("names the business and both dates in Australian format", () => {
    expect(deleted.text).toContain("Sunrise Supports");
    expect(deleted.text).toContain("11 October 2026");
    expect(deleted.text).toContain("10 November 2026");
    expect(purged.text).toContain("11 November 2026");
  });

  it("carries the general-information line and no prohibited claim", () => {
    for (const m of [deleted, purged]) {
      expect(m.text).toMatch(/not legal advice/);
      expect(findProhibitedClaims(`${m.subject}\n${m.text}`)).toEqual([]);
    }
  });

  it("formats dates in the Sydney time zone", () => {
    expect(formatDateAu(new Date("2026-12-31T14:30:00Z"))).toBe(
      "1 January 2027",
    );
  });
});

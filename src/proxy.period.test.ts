import { describe, expect, it } from "vitest";
import { periodQueryRefused } from "./proxy";

/**
 * REQ-023 FR-5, SR-3 (AC-9): the proxy answers 400 for a malformed period on
 * the register pages, the audit-day pages and the auditor link, and leaves
 * every other path and every well-formed query alone.
 */
describe("periodQueryRefused (REQ-023 Session B, AC-9)", () => {
  it("refuses the three invalid cases on a guarded path", () => {
    expect(
      periodQueryRefused(
        "/registers/incidents",
        new URLSearchParams("period=custom&from=2020-01-01&to=2031-01-01"),
      ),
    ).toBe(true);
    expect(
      periodQueryRefused(
        "/auditor/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
        new URLSearchParams("period=custom&from=2027-06-30&to=2027-01-01"),
      ),
    ).toBe(true);
    expect(
      periodQueryRefused(
        "/path/audit-day/what-changed",
        new URLSearchParams("period=custom&from=soon&to=2027-01-01"),
      ),
    ).toBe(true);
    expect(
      periodQueryRefused("/registers", new URLSearchParams("period=bogus")),
    ).toBe(true);
  });

  it("lets a well-formed period, a query with no period, and an unguarded path through", () => {
    expect(
      periodQueryRefused(
        "/registers/incidents",
        new URLSearchParams("period=since-last-audit"),
      ),
    ).toBe(false);
    expect(
      periodQueryRefused(
        "/registers/incidents/export.zip",
        new URLSearchParams("period=custom&from=2027-01-01&to=2027-06-30"),
      ),
    ).toBe(false);
    expect(
      periodQueryRefused(
        "/registers/incidents/abc",
        new URLSearchParams("saved=1"),
      ),
    ).toBe(false);
    expect(
      periodQueryRefused("/account", new URLSearchParams("period=bogus")),
    ).toBe(false);
  });
});

// @vitest-environment node
/** The launch check's pure helpers (REQ-022 FR-2). */
import { describe, expect, it } from "vitest";
import {
  daysSinceUpdated,
  parseAudCents,
  redirectsToBase,
  textOfTestId,
} from "./launch-check-lib.mjs";

describe("launch-check helpers", () => {
  it("reads an AUD amount to cents, with or without thousands and cents", () => {
    expect(parseAudCents("AUD 399")).toBe(39900);
    expect(parseAudCents("AUD 1,249.50")).toBe(124950);
    expect(parseAudCents("from AUD 39 a month")).toBe(3900);
    expect(parseAudCents("free")).toBeNull();
    expect(parseAudCents(null)).toBeNull();
  });

  it("takes the text of a test id out of rendered HTML, tags stripped", () => {
    const html =
      '<p data-testid="legal-updated" class="x">Last updated <time>12 October 2026</time></p>';
    expect(textOfTestId(html, "legal-updated")).toBe(
      "Last updated 12 October 2026",
    );
    expect(textOfTestId(html, "missing")).toBeNull();
  });

  it("turns a Last updated line into days before now", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    expect(daysSinceUpdated("Last updated 12 October 2026", now)).toBe(3);
    expect(
      daysSinceUpdated("Last updated 1 January 2026", now),
    ).toBeGreaterThan(90);
    expect(daysSinceUpdated("no date", now)).toBeNull();
    expect(daysSinceUpdated("Last updated 12 Smarch 2026", now)).toBeNull();
  });

  it("accepts only a permanent redirect to the same path on the base", () => {
    const base = "https://readyline.example";
    expect(
      redirectsToBase(
        301,
        "https://readyline.example/pricing",
        base,
        "/pricing",
      ),
    ).toBe(true);
    expect(redirectsToBase(308, "/pricing", base, "/pricing")).toBe(true);
    expect(
      redirectsToBase(
        302,
        "https://readyline.example/pricing",
        base,
        "/pricing",
      ),
    ).toBe(false);
    expect(
      redirectsToBase(301, "https://other.example/pricing", base, "/pricing"),
    ).toBe(false);
    expect(redirectsToBase(301, null, base, "/")).toBe(false);
    expect(redirectsToBase(200, null, base, "/")).toBe(false);
  });
});

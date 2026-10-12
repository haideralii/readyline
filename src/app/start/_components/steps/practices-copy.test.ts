import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { EXAMPLES, HELPER } from "./practices-copy";

describe("restrictive practices copy (REQ-013 FR-4, R-4)", () => {
  it("covers all five regulated practices across the three helper questions", () => {
    const covered = new Set(HELPER.flatMap((h) => h.covers));
    expect([...covered].sort()).toEqual(
      [
        "chemical",
        "environmental",
        "mechanical",
        "physical",
        "seclusion",
      ].sort(),
    );
  });

  it("asks about seclusion in plain words in question 1 and its example", () => {
    expect(HELPER[0].legend).toMatch(/alone in a room they cannot leave/);
    expect(HELPER[0].help).toMatch(/shutting someone in their room/);
    expect(EXAMPLES[0]).toMatch(/shutting someone in their room/);
  });

  it("contains no prohibited claim and no jargon in the questions", () => {
    const text = [
      ...EXAMPLES,
      ...HELPER.flatMap((h) => [h.legend, h.help]),
    ].join("\n");
    expect(findProhibitedClaims(text)).toEqual([]);
    expect(text).not.toMatch(/seclusion|restraint|environmental/i);
  });
});

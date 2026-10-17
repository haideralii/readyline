import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import { GROUP_HINT, groupHintText } from "./groups";

/**
 * REQ-027 D-2730 (Haider's find on production's step 2): the "Not sure?"
 * hint keys on the business structure; a sole trader reads the sole-trader
 * sentence, a company (and every other structure) the general one, and a
 * reader with no structure answer the general one too. Both strings pass
 * the copy lint and the claims lint, and the button's classes are the same.
 */
describe("the supports step's hint by business structure (D-2730)", () => {
  it("a sole trader reads the sole-trader sentence", () => {
    expect(groupHintText("sole-trader")).toBe(GROUP_HINT.text);
    expect(groupHintText("sole-trader")).toMatch(
      /^Not sure\? Most sole-trader support workers choose/,
    );
  });

  it("a company, a partnership and an incorporated association read the general sentence", () => {
    for (const s of ["company", "partnership", "incorporated-association"])
      expect(groupHintText(s), s).toBe(GROUP_HINT.textGeneral);
    expect(groupHintText("company")).toBe(
      "Not sure? Many small providers start with Assistance with daily personal activities and Household tasks.",
    );
  });

  it("no structure answer yet reads the general form", () => {
    expect(groupHintText(undefined)).toBe(GROUP_HINT.textGeneral);
    expect(groupHintText(null)).toBe(GROUP_HINT.textGeneral);
    expect(groupHintText("")).toBe(GROUP_HINT.textGeneral);
  });

  it("both sentences pass the copy lint and the claims lint; the selected classes are the two of the hint", () => {
    for (const t of [GROUP_HINT.text, GROUP_HINT.textGeneral]) {
      expect(lintText(t, { block: true }), t).toEqual([]);
      expect(findProhibitedClaims(t), t).toEqual([]);
    }
    expect(GROUP_HINT.selects).toEqual(["0107", "0120"]);
  });
});

/**
 * REQ-013 FR-3 / AC-3: the everyday groupings cover every one of the 38
 * classes exactly once, the hint points at real classes, the synonyms make
 * the expected searches work, and nothing in the copy is a prohibited claim.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { getGroupOptions, matchesGroupQuery } from "@/lib/questionnaire/groups";
import { getStandardsDataset } from "@/lib/standards/dataset";
import categories from "./group-categories.json";
import descriptions from "../registration-group-descriptions.json";

const dataset = getStandardsDataset();
const codes = dataset.registrationGroups.map((g) => g.code).sort();

describe("group categories and synonyms (REQ-013 FR-3)", () => {
  it("cover every class exactly once", () => {
    const mapped = categories.categories.flatMap((c) => c.codes).sort();
    expect(mapped).toEqual(codes);
  });

  it("hint selects real classes and every class has synonyms", () => {
    for (const code of categories.hint.selects) expect(codes).toContain(code);
    expect(categories.hint.selects).toEqual(["0107", "0120"]);
    for (const item of descriptions.items) {
      expect(
        (item as { synonyms?: string[] }).synonyms?.length,
        item.code,
      ).toBeGreaterThan(0);
    }
  });

  it("the expected searches find the expected classes (AC-3)", () => {
    const options = getGroupOptions(dataset);
    const find = (q: string) =>
      options.filter((g) => matchesGroupQuery(g, q)).map((g) => g.code);
    expect(find("support worker")).toContain("0107");
    expect(find("cleaning")).toContain("0120");
    expect(find("SIL")).toContain("0138");
    expect(find("sil")).toContain("0138");
    expect(find("zzzz")).toEqual([]);
    expect(find("")).toHaveLength(38);
  });

  it("contains no prohibited claim", () => {
    const text = [
      categories.question,
      categories.hint.text,
      ...categories.categories.flatMap((c) => [c.title, c.description]),
      ...descriptions.items.flatMap(
        (i) => (i as { synonyms?: string[] }).synonyms ?? [],
      ),
    ].join("\n");
    expect(findProhibitedClaims(text)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { FACT_KEYS } from "./facts";
import { describeFactSources, FACT_SOURCES } from "./fact-sources";

describe("fact sources (REQ-005 FR-5)", () => {
  it("names a questionnaire step and question for every fact key", () => {
    for (const key of FACT_KEYS) {
      expect(FACT_SOURCES[key].step).toBeGreaterThanOrEqual(1);
      expect(FACT_SOURCES[key].question.length).toBeGreaterThan(0);
    }
  });

  it("describes used facts without duplicates and ignores unknown keys", () => {
    const s = describeFactSources([
      "tradingName",
      "pathway",
      "modules",
      "nope",
    ]);
    expect(s.map((x) => x.question)).toEqual([
      "Trading name",
      "Registration groups (audit type derived)",
      "Registration groups (modules derived)",
    ]);
  });
});

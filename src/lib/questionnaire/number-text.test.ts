import { describe, expect, it } from "vitest";
import { numberText } from "./number-text";
import { WorkforceStep } from "./schema";

/**
 * QA pass N8: a decimal or a minus typed into a count survives to the schema,
 * which refuses it in words, rather than the input turning "2.5" into 25.
 */
describe("the number inputs keep what a person typed (N8)", () => {
  it("keeps digits, one decimal point and a leading minus; drops everything else", () => {
    expect(numberText("12")).toBe("12");
    expect(numberText("2.5")).toBe("2.5");
    expect(numberText("-1")).toBe("-1");
    expect(numberText("1.2.3")).toBe("1.23");
    expect(numberText("1-2")).toBe("12");
    expect(numberText("--3")).toBe("-3");
    expect(numberText("abc")).toBe("");
    expect(numberText("3 workers")).toBe("3");
    expect(numberText("")).toBe("");
    expect(numberText(".")).toBe(".");
  });

  it("the schema then says what is wrong with 2.5 or -1 workers, instead of a silent 25 or 1", () => {
    const base = {
      keyPersonnelCount: 1,
      hasRiskAssessedRoles: true,
      allRiskAssessedScreened: "yes",
    };
    const decimal = WorkforceStep.safeParse({
      ...base,
      workerCount: Number(numberText("2.5")),
    });
    expect(decimal.success).toBe(false);
    expect(decimal.error?.issues.map((i) => i.message)).toContain(
      "Enter a whole number of workers",
    );
    const minus = WorkforceStep.safeParse({
      ...base,
      workerCount: Number(numberText("-1")),
    });
    expect(minus.success).toBe(false);
    expect(minus.error?.issues.map((i) => i.message)).toContain(
      "Count yourself as a worker",
    );
    expect(
      WorkforceStep.safeParse({
        ...base,
        workerCount: Number(numberText("25")),
      }).success,
    ).toBe(true);
  });
});

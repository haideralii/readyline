import { describe, expect, it } from "vitest";
import { clearFieldError, revalidateField } from "./field-errors";

/** REQ-028 FR-3 (AC-3): the error-clearing reducer and its one await. */
describe("clearFieldError", () => {
  it("drops the field's entry when it passes and keeps every other key", () => {
    const errors = {
      tradingName: ["Enter your trading name"],
      states: ["Choose at least one"],
      form: ["Fix the fields above"],
    };
    expect(clearFieldError(errors, "tradingName", {})).toEqual({
      states: ["Choose at least one"],
      form: ["Fix the fields above"],
    });
  });

  it("replaces the field's entry with the fresh messages when it still fails", () => {
    const errors = { tradingName: ["Enter your trading name"] };
    expect(
      clearFieldError(errors, "tradingName", {
        tradingName: ["At least two characters"],
        abn: ["Eleven digits"],
      }),
    ).toEqual({ tradingName: ["At least two characters"] });
  });

  it("never mutates the object it was given", () => {
    const errors = { tradingName: ["x"] };
    clearFieldError(errors, "tradingName", {});
    expect(errors).toEqual({ tradingName: ["x"] });
  });
});

describe("revalidateField", () => {
  it("returns the same object when the field carries no error", async () => {
    const errors = { states: ["Choose at least one"] };
    expect(
      await revalidateField(
        "business",
        { tradingName: "", structure: "sole-trader", states: [], abn: "" },
        "tradingName",
        errors,
      ),
    ).toBe(errors);
  });

  it("clears the trading name's error once a name is typed and keeps the states' error", async () => {
    const errors = {
      tradingName: ["Enter your trading name"],
      states: ["Choose at least one"],
    };
    const next = await revalidateField(
      "business",
      {
        tradingName: "Sunrise Supports",
        structure: "sole-trader",
        states: [],
        abn: "",
      },
      "tradingName",
      errors,
    );
    expect(next.tradingName).toBeUndefined();
    expect(next.states).toEqual(["Choose at least one"]);
  });
});

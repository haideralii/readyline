import { describe, expect, it } from "vitest";
import { isValidAbn, normaliseAbn } from "./abn";

describe("isValidAbn", () => {
  it.each(["51824753556", "51 824 753 556", "53004085616"])(
    "accepts the published example %s",
    (abn) => {
      expect(isValidAbn(abn)).toBe(true);
    },
  );

  it.each([
    "51824753557",
    "12345678901",
    "5182475355",
    "518247535561",
    "abcdefghijk",
    "",
  ])("rejects %j", (abn) => expect(isValidAbn(abn)).toBe(false));

  it("normalises spaces", () => {
    expect(normaliseAbn(" 51 824 753 556 ")).toBe("51824753556");
  });
});

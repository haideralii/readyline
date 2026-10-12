import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOUSE_STYLE } from "./house-style";

describe("house style constant", () => {
  it("is byte-identical to product/domain/house-style.md (line endings normalised)", () => {
    const md = readFileSync("product/domain/house-style.md", "utf8").replace(
      /\r\n/g,
      "\n",
    );
    expect(HOUSE_STYLE).toBe(md);
  });

  it("carries the lists the lint enforces", () => {
    for (const word of [
      "participant",
      "worker",
      "guaranteed",
      "audit-proof",
      "Year 8",
    ]) {
      expect(HOUSE_STYLE).toContain(word);
    }
  });
});

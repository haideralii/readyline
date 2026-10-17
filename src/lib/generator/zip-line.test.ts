import { describe, expect, it } from "vitest";
import { zipSizeLine, zipSizeWords } from "./zip-line";

describe("the zip line (REQ-028 FR-7)", () => {
  it("counts the Word files and names the size to one decimal", () => {
    expect(zipSizeLine(22, 3.26 * 1024 * 1024)).toBe(
      "22 Word files and the readiness summary, about 3.3 MB",
    );
    expect(zipSizeLine(1, 120_000)).toBe(
      "1 Word file and the readiness summary, about 0.1 MB",
    );
  });

  it("says under 0.1 MB for a tiny zip and omits the size when the object is missing", () => {
    expect(zipSizeWords(10_000)).toBe("under 0.1 MB");
    expect(zipSizeLine(22, null)).toBe(
      "22 Word files and the readiness summary",
    );
  });
});

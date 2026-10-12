import { describe, expect, it } from "vitest";
import { progressPercent } from "./progress-line";

describe("progressPercent (REQ-014 R-2)", () => {
  it("fills by the share of steps reached: a sixth at step 1, a third at step 2, whole at step 6", () => {
    expect(progressPercent(1, 6)).toBe(17);
    expect(progressPercent(2, 6)).toBe(33);
    expect(progressPercent(3, 6)).toBe(50);
    expect(progressPercent(6, 6)).toBe(100);
  });

  it("never drops below 4 and never exceeds 100", () => {
    expect(progressPercent(1, 100)).toBe(4);
    expect(progressPercent(0, 6)).toBe(17);
    expect(progressPercent(9, 6)).toBe(100);
    expect(progressPercent(1, 0)).toBe(100);
  });
});

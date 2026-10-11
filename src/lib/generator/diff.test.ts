import { describe, expect, it } from "vitest";
import { diffLines, diffSummary } from "./diff";

describe("diffLines (REQ-005 AC-6)", () => {
  it("reports identical text as unchanged", () => {
    const d = diffLines("a\nb", "a\nb");
    expect(d.every((l) => l.kind === "same")).toBe(true);
  });

  it("marks added, removed and kept lines in order", () => {
    const d = diffLines(
      "We keep a register.\nWe review it monthly.",
      "We keep a register.\nThe owner reviews it monthly.\nWe file it.",
    );
    expect(d).toEqual([
      { kind: "same", text: "We keep a register." },
      { kind: "removed", text: "We review it monthly." },
      { kind: "added", text: "The owner reviews it monthly." },
      { kind: "added", text: "We file it." },
    ]);
    expect(diffSummary(d)).toEqual({ added: 2, removed: 1, same: 1 });
  });

  it("handles empty sides", () => {
    expect(diffLines("", "x")).toEqual([
      { kind: "removed", text: "" },
      { kind: "added", text: "x" },
    ]);
  });
});

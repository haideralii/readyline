import { describe, expect, it } from "vitest";
import { lintText } from "@/lib/copy-lint/rules";
import {
  readinessCounts,
  readyLineCounts,
  summaryLines,
  type ReadinessCounts,
} from "./readiness";

/**
 * REQ-025 FR-3, AC-2: the summary card's lines over derived counts, never
 * literals; a count of zero drops its "you said you have" clause, for
 * documents and registers alike.
 */
const counts = (over: Partial<ReadinessCounts> = {}): ReadinessCounts => ({
  have: 0,
  documentsHave: 0,
  registersHave: 0,
  documents: 15,
  registers: 5,
  ...over,
});

describe("the summary lines (REQ-025 FR-3)", () => {
  it("two documents and one register said yes", () => {
    const lines = summaryLines(
      counts({ have: 3, documentsHave: 2, registersHave: 1 }),
      42,
    );
    expect(lines).toEqual({
      documents: "Documents: 15, you said you have 2",
      registers: "Registers: 5, you said you have 1, you keep these as you go",
      checklist:
        "Checklist: 42 items (20 above plus 22 about your workers, insurance and the audit)",
      pack: "The pack drafts all 15 so they match; your checklist shows which to compare with what you have.",
    });
  });

  it("one document said yes, no register", () => {
    const lines = summaryLines(counts({ have: 1, documentsHave: 1 }), 30);
    expect(lines.documents).toBe("Documents: 15, you said you have 1");
    expect(lines.registers).toBe("Registers: 5, you keep these as you go");
  });

  it("nothing said yes drops both clauses and still adds up", () => {
    const lines = summaryLines(counts(), 24);
    expect(lines.documents).toBe("Documents: 15");
    expect(lines.registers).toBe("Registers: 5, you keep these as you go");
    expect(lines.checklist).toBe(
      "Checklist: 24 items (20 above plus 4 about your workers, insurance and the audit)",
    );
  });

  it("a checklist total below the documents and registers never goes negative", () => {
    expect(summaryLines(counts(), 10).checklist).toBe(
      "Checklist: 10 items (20 above plus 0 about your workers, insurance and the audit)",
    );
  });

  it("every line passes the copy lint", () => {
    const lines = summaryLines(
      counts({ have: 2, documentsHave: 1, registersHave: 1 }),
      42,
    );
    for (const line of Object.values(lines)) expect(lintText(line)).toEqual([]);
  });

  it("counts documents and registers separately and the ready line keeps its two segments", () => {
    const c = readinessCounts({
      documents: [{ have: "yes" }, { have: "no" }, { have: "not-sure" }],
      registers: [{ have: "yes" }, { have: "unknown" }],
    } as never);
    expect(c).toEqual({
      have: 2,
      documentsHave: 1,
      registersHave: 1,
      documents: 3,
      registers: 2,
    });
    expect(readyLineCounts(c)).toEqual({ done: 2, todo: 3 });
  });
});

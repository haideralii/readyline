// @vitest-environment node
/**
 * REQ-031 FR-3 (D-2888, D-2896): the sample page's sheet is the sole-trader
 * reference case's, every line to do, nothing adopted, and the same lines
 * the evidence file holds (the one the PO reads), so the two cannot drift.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { sheetLines } from "@/lib/generator/start-here";
import { HOME_COPY } from "@/lib/home-copy";
import { SAMPLE_START_HERE } from "./sample-start-here";

describe("the sample's Start here sheet (REQ-031 FR-3)", () => {
  it("is the sole trader's sheet with every line to do and the three next steps", () => {
    const s = SAMPLE_START_HERE;
    expect(s.tradingName).toBe("Sunrise Supports");
    expect(s.counts.toFill).toBeGreaterThan(0);
    expect(s.counts.done).toBe(0);
    for (const d of s.documents) {
      expect(d.adopted, d.typeId).toBe(false);
      for (const l of [...d.fillIn, ...d.fillInWord])
        expect(l.done, `${d.typeId} ${l.blank}`).toBe(false);
    }
    expect(s.next.map((n) => n.href)).toEqual([
      "/checklist",
      "/path/audit-day",
      "/path/audit-day/check",
    ]);
    expect(findProhibitedClaims(sheetLines(s).join("\n"))).toEqual([]);
  });

  it("D-2896: the line above it names the fictional provider, and the lines are the evidence file's", () => {
    expect(HOME_COPY.sampleSheetLine).toBe(
      "This is the sheet you get with your documents, shown for Sunrise Supports, a fictional sole trader.",
    );
    const evidence = readFileSync(
      "product/evidence/req-026/start-here-sole-trader.txt",
      "utf8",
    )
      .replace(/\r\n/g, "\n")
      .trimEnd();
    expect(sheetLines(SAMPLE_START_HERE).join("\n")).toBe(evidence);
  });
});

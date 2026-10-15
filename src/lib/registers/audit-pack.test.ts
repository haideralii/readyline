// @vitest-environment node
/** REQ-020 FR-1, FR-10: the pack's columns, dates, states, names and cover sheet. */
import { describe, expect, it } from "vitest";
import {
  auditPackFileName,
  lastEntryDate,
  packColumns,
  packIntro,
  packLine,
  packStateWord,
} from "./audit-pack";
import { renderCoverSheet } from "./audit-pack-pdf";

describe("the audit pack's rules", () => {
  it("words the three states without a score or a promise", () => {
    expect(packStateWord("filled")).toBe("present");
    expect(packStateWord("overdue")).toBe("incomplete");
    expect(packStateWord("missing")).toBe("missing");
  });

  it("exports every stored column but the hidden ones, in the stored order", () => {
    const rows = [
      {
        id: "1",
        account_id: "a",
        created_by: "u",
        title: "x",
        review_on: "2026-01-01",
      },
    ];
    expect(packColumns(rows)).toEqual(["title", "review_on"]);
    expect(packColumns([])).toEqual([]);
  });

  it("finds the latest date on any row, by the date columns a register carries", () => {
    expect(
      lastEntryDate([
        { occurred_on: "2026-10-01", created_at: "2026-10-02T03:00:00Z" },
        { occurred_on: "2026-10-09", created_at: "2026-10-09T03:00:00Z" },
      ]),
    ).toBe("2026-10-09");
    expect(lastEntryDate([{ note: "no dates" }])).toBeNull();
    expect(lastEntryDate([])).toBeNull();
  });

  it("names the record from the audit-day list and counts its rows", () => {
    const l = packLine("incidents", [{ occurred_on: "2026-10-09" }], "filled");
    expect(l).toEqual({
      id: "incidents",
      name: "Incident register",
      rows: 1,
      lastEntry: "2026-10-09",
      state: "present",
    });
    expect(packLine("nope", [], "missing").name).toBe("nope");
  });

  it("names the zip from the trading name and the date, and says what the pack is", () => {
    expect(auditPackFileName("Sunrise Supports & Co.", "2026-10-15")).toBe(
      "audit-pack-sunrise-supports-co-2026-10-15.zip",
    );
    expect(auditPackFileName("!!!", "2026-10-15")).toBe(
      "audit-pack-provider-2026-10-15.zip",
    );
    expect(packIntro("Sunrise Supports", "2026-10-15")).toMatch(
      /^Audit pack for Sunrise Supports, prepared on 2026-10-15\./,
    );
  });

  it("renders a cover sheet as a PDF, paginating a long table", async () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({
      id: `r${i}`,
      name: `Record ${i}`,
      rows: i,
      lastEntry: null,
      state: "missing" as const,
    }));
    const pdf = await renderCoverSheet({
      tradingName: "Sunrise Supports",
      date: "2026-10-15",
      lines,
      files: ["incidents-2026-10-15.csv"],
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  });
});

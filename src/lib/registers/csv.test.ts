import { describe, expect, it } from "vitest";
import { CSV_BOM, CSV_COLUMNS, toCsv } from "./csv";

describe("register CSV (REQ-009 FR-6)", () => {
  it("starts with the byte-order mark, uses CRLF and keeps dates as written", () => {
    const out = toCsv(
      ["reference", "occurred_on"],
      [{ reference: "INC-0001", occurred_on: "2026-10-09" }],
    );
    expect(out.startsWith(CSV_BOM)).toBe(true);
    expect(out).toBe(
      `${CSV_BOM}reference,occurred_on\r\nINC-0001,2026-10-09\r\n`,
    );
  });

  it("quotes commas, quotes and line breaks, and empties nulls", () => {
    const out = toCsv(
      ["a", "b", "c"],
      [{ a: 'say "hi", please', b: "line\nbreak", c: null }],
    );
    expect(out).toContain('"say ""hi"", please","line\nbreak",\r\n');
  });

  it("neutralises a cell that would run as a formula", () => {
    const out = toCsv(["summary"], [{ summary: '=HYPERLINK("x")' }]);
    expect(out).toContain('"\'=HYPERLINK(""x"")"');
    expect(toCsv(["s"], [{ s: "-5 degrees" }])).toContain("'-5 degrees");
  });

  it("every register has its reference or worker code first and never a participant name column", () => {
    for (const [name, cols] of Object.entries(CSV_COLUMNS)) {
      // The shared trail (retro finding 25) names the register first, then the row.
      // REQ-024 A3: a checklist is keyed by its subject code, a role by its title,
      // the worker file by the row kind and the workers index by its section.
      expect(cols[0], name).toMatch(
        /^(reference|worker_ref|document_type_id|register|subject_ref|title|kind|section)$/,
      );
      expect(cols.join(" "), name).not.toMatch(/name|dob|address|ndis_number/);
    }
  });
});

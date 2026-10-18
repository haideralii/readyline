// @vitest-environment node
/**
 * REQ-012 FR-1a, AC-1: the ASVS re-verification table in
 * product/security/asvs-l1-check-2026-10-14.md names, for every row of the
 * earlier tables, the control's `file:line` with the symbol on that line and
 * the test that keeps it (file and a title). This test opens each: the file
 * exists, the line exists and carries the symbol, the test file carries the
 * title. A moved control or a renamed test fails here naming the row, so the
 * table cannot drift silently (D-2899).
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ASVS = "product/security/asvs-l1-check-2026-10-14.md";
const text = readFileSync(ASVS, "utf8");
const HEADING = "## REQ-012 Session A re-verification";

/** The re-verification table's rows: `| n | row | state | control | test | note |`. */
function recheckRows(): {
  n: string;
  control: string;
  test: string;
  state: string;
  row: string;
}[] {
  const start = text.indexOf(HEADING);
  if (start < 0) return [];
  const section = text.slice(start);
  return section
    .split("\n")
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => {
      const cells = l.split("|").map((c) => c.trim());
      return {
        n: cells[1],
        row: cells[2],
        state: cells[3],
        control: cells[4],
        test: cells[5],
      };
    });
}

/** Every `| ... |` data row of the earlier tables (not the header or rule lines, not the re-verification). */
function earlierRows(): number {
  const end = text.indexOf(HEADING);
  return text
    .slice(0, end < 0 ? text.length : end)
    .split("\n")
    .filter((l) => /^\| (V\d|V1\d)/.test(l)).length;
}

const CONTROL = /`([^`:]+):(\d+)`\s*\(`([^`]+)`\)/;
const TEST = /`([^`]+)`\s*"([^"]+)"/;

describe("the ASVS re-verification table (REQ-012 FR-1a, AC-1)", () => {
  const rows = recheckRows();

  it("exists and covers every row of the earlier tables", () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThanOrEqual(earlierRows());
  });

  for (const r of rows) {
    it(`row ${r.n}: the control's file:line carries its symbol and the test carries its title`, () => {
      const c = CONTROL.exec(r.control);
      expect(c, `control cell: ${r.control}`).not.toBeNull();
      const [, file, lineText, symbol] = c!;
      expect(existsSync(file), `${file} exists`).toBe(true);
      const lines = readFileSync(file, "utf8").split("\n");
      const line = Number(lineText);
      expect(line, `${file}:${line} within the file`).toBeLessThanOrEqual(
        lines.length,
      );
      expect(lines[line - 1], `${file}:${line} carries ${symbol}`).toContain(
        symbol,
      );
      if (r.test !== "none" && !r.test.startsWith("Gap")) {
        const t = TEST.exec(r.test);
        expect(t, `test cell: ${r.test}`).not.toBeNull();
        const [, testFile, title] = t!;
        expect(existsSync(testFile), `${testFile} exists`).toBe(true);
        expect(
          readFileSync(testFile, "utf8"),
          `${testFile} carries "${title}"`,
        ).toContain(title);
      }
      expect(["Met", "Gap", "Met (L2 gap listed)"]).toContain(
        r.state.replace(/\*\*/g, "").split(";")[0].trim(),
      );
    });
  }

  it("no Gap row lacks a fix commit or a dated ruling", () => {
    for (const r of rows.filter((r) => r.state.startsWith("Gap")))
      expect(r.test, `Gap row ${r.n}`).toMatch(
        /[0-9a-f]{7}|\d{1,2} [A-Z][a-z]{2} 20\d\d/,
      );
  });
});

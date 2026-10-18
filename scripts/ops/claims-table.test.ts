// @vitest-environment node
/**
 * REQ-012 FR-4b (AC-9, AC-16): the claims table carries D-2907's columns,
 * puts UNVERIFIED first with both counts on the first line, maps a found
 * sentence to its entry, marks the rest UNVERIFIED, adds the hand-kept
 * facts the extractor cannot see, and the repository's mapping names the
 * eight D-2908 facts.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  buildRows,
  renderTable,
  typeFromClasses,
} from "./claims-table-lib.mjs";

const found = [
  {
    file: "g.md",
    line: 3,
    classes: ["number"],
    sentence: "Registration lasts three years.",
  },
  {
    file: "g.md",
    line: 9,
    classes: ["number", "dollar"],
    sentence: "A verification audit costs $900 to $1,800.",
  },
  {
    file: "g.md",
    line: 12,
    classes: ["hedge"],
    sentence: "Most providers keep a register.",
  },
];
const mapping = [
  {
    sentence: "A verification audit costs $900 to $1,800.",
    type: "price",
    sourceId: "providerplus-cost",
    url: "https://example.test/cost",
    fetchedAt: "2026-10-13",
    readBy: "PO",
    staleOn: "2026-11-12",
    status: "VERIFIED-SECONDARY",
  },
  {
    sentence: "The Commission does not charge an application fee.",
    where: "g.md:60",
    type: "regulatory fact",
    status: "VERIFIED-SECONDARY",
    sourceId: "ablis",
    fetchedAt: "2026-10-13",
  },
];

describe("the claims-and-sources table (REQ-012 FR-4b)", () => {
  it("maps a found sentence, marks the rest UNVERIFIED, adds the hand-kept facts and sorts UNVERIFIED first", () => {
    const rows = buildRows(found, mapping);
    expect(rows.map((r) => r.status)).toEqual([
      "UNVERIFIED",
      "UNVERIFIED",
      "VERIFIED-SECONDARY",
      "VERIFIED-SECONDARY",
    ]);
    expect(rows[2].where).toBe("g.md:9");
    expect(rows[3].where).toBe("g.md:60");
    expect(rows[0].type).toBe("regulatory fact");
    expect(rows.find((r) => r.sentence.startsWith("Most"))!.type).toBe(
      "hedge (D-2911)",
    );
  });

  it("renders D-2907's columns with both counts on the first line", () => {
    const md = renderTable(buildRows(found, mapping), {
      extractedAt: "2026-10-18",
    });
    const lines = md.split("\n");
    expect(lines[0]).toMatch(
      /^UNVERIFIED 2, mapped 2 \(0 VERIFIED, 2 VERIFIED-SECONDARY, 0 CHANGED\); 4 rows/,
    );
    expect(lines[2]).toBe(`| ${COLUMNS.join(" | ")} | Note |`);
    expect(COLUMNS).toEqual([
      "Sentence",
      "Route and file:line",
      "Claim type",
      "Primary instrument",
      "Source id and URL",
      "Source version",
      "Fetched",
      "Read by",
      "Last lawyer read",
      "Stale on",
      "Status",
    ]);
    expect(lines[4]).toMatch(
      /^\| Registration lasts three years\. \| g\.md:3 \| regulatory fact \| .* \| UNVERIFIED \|/,
    );
  });

  it("names the claim type from the classes when the mapping gives none", () => {
    expect(typeFromClasses(["number", "dollar"])).toBe("price");
    expect(typeFromClasses(["number", "time"])).toBe("time");
    expect(typeFromClasses(["hedge"])).toBe("hedge (D-2911)");
    expect(typeFromClasses(["instrument"])).toBe("regulatory fact");
  });

  it("refuses a status off the list", () => {
    expect(() => buildRows([], [{ sentence: "x", status: "TRUE" }])).toThrow(
      /unknown status/,
    );
  });

  it("the repository's mapping carries the eight D-2908 facts by name and valid statuses", () => {
    const mapping = JSON.parse(
      readFileSync("data/claims-sources.json", "utf8"),
    ) as {
      entries: { sentence: string; status: string; note?: string }[];
    };
    const notes = mapping.entries.map((e) => e.note ?? "").join("\n");
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8])
      expect(notes, `D-2908 (${n})`).toContain(`D-2908 (${n})`);
    for (const e of mapping.entries)
      expect(
        ["UNVERIFIED", "CHANGED", "VERIFIED-SECONDARY", "VERIFIED"],
        e.sentence,
      ).toContain(e.status);
  });
});

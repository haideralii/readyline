// @vitest-environment node
/**
 * Retro review of REQ-016 (findings 38 and 39): the retention schedule's
 * worker-screening row cites the sections of the Worker Screening Rules that
 * hold the two lists, the form and the period; and the recruitment
 * procedure's clearance register says it is the companion to the provider's
 * own s 18 list, which holds the names and never leaves the provider.
 */
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { documentTypeById } from "./catalogue";
import { buildProviderFacts } from "./facts";
import { fixedExtra } from "./fixed-extras";
import type { FixedContext } from "./fixed-text";
import { loadReferenceCases } from "./reference-cases";

const reference = loadReferenceCases().find(
  (c) => c.id === "verification-sole-trader",
)!;
const ctx = (typeId: string): FixedContext => ({
  type: documentTypeById(typeId)!,
  facts: buildProviderFacts(reference.answers, reference.result),
  standards: [],
  documents: [],
  registers: [],
  version: "1",
  generatedAt: "2026-10-15",
  reviewDueAt: "2027-10-15",
});
void getStandardsDataset();

type Table = { type: "table"; columns: string[]; rows: string[][] };
type Paragraph = { type: "paragraph"; text: string };

describe("the retention schedule (records management policy)", () => {
  it("cites ss 17 and 18 for the two worker lists, s 20 for the form and s 21 for the period (finding 38)", () => {
    const blocks = fixedExtra(
      "retention-schedule",
      ctx("records-management-policy"),
    )!;
    const table = blocks.find((b) => b.type === "table") as Table;
    const row = table.rows.find((r) => /screened workers/.test(r[0]))!;
    expect(row).toEqual([
      "The list of risk-assessed roles and the list of screened workers",
      "7 years from the date the record is made, kept so an auditor can see who was in a risk-assessed role on any day in the last 7 years",
      "Worker Screening Rules ss 17 and 18 (the two lists), s 20 (the form) and s 21 (the period), read 15 October 2026",
    ]);
    const text = JSON.stringify(blocks);
    expect(text).not.toMatch(/ss 20 and 21/);
  });
});

describe("the worker screening clearance register (recruitment procedure)", () => {
  it("says it is the companion to the provider's own s 18 list, which holds the names and stays with the provider (finding 39)", () => {
    const blocks = fixedExtra(
      "clearance-register",
      ctx("worker-screening-and-recruitment-procedure"),
    )!;
    const paragraphs = blocks.filter(
      (b): b is Paragraph => b.type === "paragraph",
    );
    const companion = paragraphs.find((p) =>
      /companion to our own list of workers/.test(p.text),
    );
    expect(companion).toBeDefined();
    expect(companion!.text).toMatch(/Worker Screening Rules s 18/);
    expect(companion!.text).toMatch(
      /full name, date of birth and address and stays in our own records/,
    );
    // The sentence sits before the table, and the table itself holds no name column.
    const tableIndex = blocks.findIndex((b) => b.type === "table");
    expect(blocks.indexOf(companion!)).toBeLessThan(tableIndex);
    const table = blocks[tableIndex] as Table;
    expect(table.columns.join(" ")).not.toMatch(/name|birth|address/i);
  });
});

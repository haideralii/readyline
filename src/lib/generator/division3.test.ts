import { describe, expect, it } from "vitest";
import { collectBlanks, lintBlanks } from "./blanks";
import { documentTypeById } from "./catalogue";
import { buildSkeleton } from "./document-model";
import {
  DIVISION_3_HEADING,
  DIVISION_3_SECTION,
  REGISTER_EMPTY_SENTENCE,
  WORKER_SCREENING_PROCEDURE_ID,
  division3Blocks,
  hasDivision3Plan,
  insertDivision3Plan,
} from "./division3";
import { buildProviderFacts } from "./facts";
import { blocksToText } from "./section-schema";
import { loadReferenceCases } from "./reference-cases";
import { getStandardsDataset } from "@/lib/standards/dataset";

/**
 * REQ-024 A2 (FR-4a; D-2421, D-2424, D-2428): the Division 3 plan as a model
 * transform, not a catalogue section, so the procedure's recorded prompt
 * hashes stand; after the records section, numbered in sequence, replaced
 * on a second insert, the register's rows by code, no bracketed blank.
 */
const dataset = getStandardsDataset();
const soleTrader = loadReferenceCases().find(
  (c) => c.id === "verification-sole-trader",
)!;
const result = soleTrader.result;
const facts = buildProviderFacts(soleTrader.answers, result);
const type = documentTypeById(WORKER_SCREENING_PROCEDURE_ID)!;
const skeleton = () =>
  buildSkeleton({
    type,
    facts,
    dataset,
    result,
    version: "1",
    generatedAt: "2026-11-02",
  });
const snapshot = {
  rows: [
    { code: "P-14", risk: "Tires in the afternoon and may fall." },
    { code: "P-2", risk: "Chokes on thin fluids." },
  ],
  lastReviewedOn: "2026-10-28",
  takenOn: "2026-11-02",
};

describe("the Division 3 plan section", () => {
  it("is not in the skeleton, and the insert puts it after the records section, numbered in sequence", () => {
    const base = skeleton();
    expect(hasDivision3Plan(base)).toBe(false);
    const ids = base.sections.map((s) => s.id);
    const with3 = insertDivision3Plan(base, snapshot);
    expect(hasDivision3Plan(with3)).toBe(true);
    const i = with3.sections.findIndex((s) => s.id === DIVISION_3_SECTION);
    expect(with3.sections[i - 1].id).toBe("records-and-evidence");
    expect(with3.sections[i].heading).toBe(DIVISION_3_HEADING);
    expect(with3.sections[i].status).toBe("fixed");
    const records = with3.sections[i - 1];
    expect(Number(with3.sections[i].number)).toBe(Number(records.number) + 1);
    // Every section before it keeps its number; the numbered ones after move by one; nothing else changes.
    for (let k = 0; k < i; k += 1)
      expect(with3.sections[k].number).toBe(base.sections[k].number);
    const after = with3.sections.slice(i + 1).filter((s) => s.number);
    const baseAfter = base.sections.slice(i).filter((s) => s.number);
    expect(after.map((s) => Number(s.number))).toEqual(
      baseAfter.map((s) => Number(s.number) + 1),
    );
    expect(
      with3.sections
        .filter((s) => s.id !== DIVISION_3_SECTION)
        .map((s) => s.id),
    ).toEqual(ids);
    expect(base.sections.length + 1).toBe(with3.sections.length);
  });

  it("replaces an earlier copy on a second insert, with the new snapshot's rows", () => {
    const once = insertDivision3Plan(skeleton(), snapshot);
    const twice = insertDivision3Plan(once, {
      ...snapshot,
      rows: [{ code: "P-9", risk: "Wanders at night." }],
      takenOn: "2026-11-20",
    });
    expect(
      twice.sections.filter((s) => s.id === DIVISION_3_SECTION),
    ).toHaveLength(1);
    expect(twice.sections.length).toBe(once.sections.length);
    const text = blocksToText(
      twice.sections.find((s) => s.id === DIVISION_3_SECTION)!.blocks,
    );
    expect(text).toContain("P-9");
    expect(text).not.toContain("P-14");
    expect(text).toContain("20 November 2026");
  });

  it("carries the rows by code with the register's dates, the fixed controls and the s 12(3) triggers, and no blank", () => {
    const blocks = division3Blocks("Sunrise Supports", snapshot);
    const text = blocksToText(blocks);
    expect(text).toContain("Sunrise Supports");
    expect(text).toContain("2 rows as the register stood on 2 November 2026");
    expect(text).toContain("last reviewed on 28 October 2026");
    expect(text).toContain("P-14");
    expect(text).toContain("Tires in the afternoon and may fall.");
    expect(text).toContain("s 14(1)(a)(ii)");
    expect(text).toContain("s 15(2)(f)");
    expect(text).toContain("s 12(3)(b)");
    expect(text).toContain("s 12(4)");
    expect(lintBlanks(text)).toEqual([]);
    const model = insertDivision3Plan(skeleton(), snapshot);
    expect(
      collectBlanks(model).filter(
        (b) => b.sectionHeading === DIVISION_3_HEADING,
      ),
    ).toEqual([]);
  });

  it("says the register was empty, with the day, and that the plan is complete only with rows (D-2421)", () => {
    const text = blocksToText(
      division3Blocks("Sunrise Supports", {
        rows: [],
        lastReviewedOn: null,
        takenOn: "2026-11-02",
      }),
    );
    expect(text).toContain("had no rows on 2 November 2026");
    expect(text).toContain(REGISTER_EMPTY_SENTENCE);
    expect(text).not.toContain("Participant code");
    expect(lintBlanks(text)).toEqual([]);
  });
});

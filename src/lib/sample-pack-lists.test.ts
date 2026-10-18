/**
 * REQ-034 FR-5, AC-5 (D-2951): the two pack lists on the sample page are
 * the reference cases' own document lists, counted, every title in the
 * catalogue; the certification case holds more than the verification case.
 */
import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/generator/catalogue";
import { findProhibitedClaims } from "@/lib/claims";
import {
  packCountLine,
  SAMPLE_PACK_CASES,
  SAMPLE_PACK_HEADING,
  SAMPLE_PACK_LEAD,
  samplePackLists,
} from "./sample-pack-lists";

describe("the pack lists on the sample page (REQ-034 FR-5)", () => {
  const lists = samplePackLists();
  const titles = new Set(catalogue.items.map((d) => d.title));

  it("lists the two cases, counted, every title a catalogue document", () => {
    expect(lists.map((l) => l.id)).toEqual(SAMPLE_PACK_CASES.map((c) => c.id));
    for (const l of lists) {
      expect(l.count).toBe(l.titles.length);
      expect(l.count).toBeGreaterThanOrEqual(10);
      expect(new Set(l.titles).size).toBe(l.titles.length);
      for (const t of l.titles) expect(titles, `${l.id}: ${t}`).toContain(t);
    }
  });

  it("the certification case carries more documents than the sole trader's", () => {
    const [verification, certification] = lists;
    expect(certification.count).toBeGreaterThan(verification.count);
    for (const t of verification.titles)
      expect(certification.titles, t).toContain(t);
  });

  it("counts in words a buyer reads, with no claim", () => {
    expect(packCountLine(18)).toBe("18 documents");
    for (const s of [
      SAMPLE_PACK_HEADING,
      SAMPLE_PACK_LEAD,
      ...SAMPLE_PACK_CASES.map((c) => c.label),
    ])
      expect(findProhibitedClaims(s), s).toEqual([]);
  });
});

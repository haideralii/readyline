/**
 * REQ-035 FR-3, FR-4 (D-2966): the outline the gap check sends and shows is
 * the generator's own, numbered as the documents are, with the document's
 * standards on its tailored sections, the indicators placed by their words,
 * the registers on the records sections, and labels built from names.
 */
import { describe, expect, it } from "vitest";
import { catalogue, sectionsFor } from "@/lib/generator/catalogue";
import { outlineFor } from "@/lib/generator/document-model";
import { gapCheckTypes, gapOutlineFor, indicatorLabel } from "./outline";

const COMPLAINTS = "complaints-management-policy-and-register";

describe("the gap check's outline (REQ-035 FR-3, FR-4)", () => {
  const o = gapOutlineFor(COMPLAINTS)!;

  it("is the generator's sections in order, numbered as the document numbers them", () => {
    const type = catalogue.items.find((t) => t.id === COMPLAINTS)!;
    expect(o.sections.map((s) => s.id)).toEqual(
      sectionsFor(type).map((s) => s.id),
    );
    const numbers = new Map(outlineFor(type).map((e) => [e.id, e.number]));
    for (const s of o.sections)
      expect(s.number, s.id).toBe(numbers.get(s.id) ?? "");
    expect(o.title).toBe(type.title);
    expect(o.kind).toBe("policy");
  });

  it("gives every tailored section the document's standards and the fixed ones none", () => {
    for (const s of o.sections) {
      if (s.mode === "tailored")
        expect(s.standardIds).toEqual([
          "core.governance.feedback-and-complaints-management",
          "verification.complaints-management",
        ]);
      else {
        expect(s.standardIds).toEqual([]);
        expect(s.indicators).toEqual([]);
      }
    }
  });

  it("places indicators on the sections whose brief shares their words, labelled by names, each at most once", () => {
    const placed = o.sections.flatMap((s) => s.indicators);
    expect(placed.length).toBeGreaterThanOrEqual(3);
    const keys = placed.map((i) => `${i.standardId}#${i.place}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of placed) {
      expect(i.place).toBeGreaterThanOrEqual(1);
      expect(i.label).toMatch(
        /^.+ \((Core|Verification) module\), indicator \d+$/,
      );
      expect(i.label).toBe(indicatorLabel(i.standardId, i.place));
    }
    expect(
      indicatorLabel("core.governance.feedback-and-complaints-management", 2),
    ).toBe("Feedback and complaints management (Core module), indicator 2");
    expect(indicatorLabel("no.such.standard", 1)).toBe(
      "no.such.standard, indicator 1",
    );
  });

  it("names the registers on the sections that keep records and nowhere else", () => {
    const withRegisters = o.sections.filter((s) => s.registers.length > 0);
    expect(withRegisters.map((s) => s.id)).toEqual([
      "register",
      "records-and-evidence",
      "related-documents",
    ]);
    for (const s of withRegisters)
      expect(s.registers).toEqual(["Complaints register"]);
  });

  it("knows no retired or unknown type, and lists the live types for the picker", () => {
    expect(gapOutlineFor("no-such-type")).toBeNull();
    const retired = catalogue.items.find((t) => t.retired);
    if (retired) expect(gapOutlineFor(retired.id)).toBeNull();
    const types = gapCheckTypes();
    expect(types.some((t) => t.id === COMPLAINTS)).toBe(true);
    expect(types.every((t) => t.title.length > 0)).toBe(true);
    if (retired) expect(types.some((t) => t.id === retired.id)).toBe(false);
  });
});

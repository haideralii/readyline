// @vitest-environment node
/**
 * REQ-033 FR-4, AC-6 (D-2933): a finding against the incident management
 * standard answers in the incident management policy with a section and the
 * incident register; a standard no document carries reads D-2933's line; an
 * unmapped finding has no line yet.
 */
import { describe, expect, it } from "vitest";
import { documentTypeById } from "@/lib/generator/catalogue";
import { outlineFor } from "@/lib/generator/document-model";
import { catalogue } from "@/lib/generator/catalogue";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  NO_DOCUMENT_LINE,
  answeredInLine,
  mapFinding,
  sectionForIndicator,
} from "./findings-map";

const idOf = (name: string) =>
  getStandardsDataset().standards.find((s) => s.name === name)!.id;

describe("the finding's mapping to the pack (REQ-033 FR-4)", () => {
  it("names the incident policy, a section and the incident register for the incident management standard", () => {
    const m = mapFinding(idOf("Incident management"));
    expect(m.documents.map((d) => d.typeId)).toContain(
      "incident-management-policy-and-register",
    );
    const doc = m.documents.find(
      (d) => d.typeId === "incident-management-policy-and-register",
    )!;
    expect(doc.section).not.toBeNull();
    expect(doc.section!.number).toBeGreaterThan(0);
    expect(m.registers).toContain("Incident register");
    const line = answeredInLine(idOf("Incident management"))!;
    expect(line).toMatch(/^Answered in: /);
    expect(line).toContain("Incident management policy");
    expect(line).toMatch(/section \d+ /);
    expect(line).toContain("Incident register");
  });

  it("matches the section by the indicator's words when the report quotes one, else takes the first tailored section", () => {
    const quoted = sectionForIndicator(
      "incident-management-policy-and-register",
      "Reportable incidents are notified to the Commission within the required time and the register records the notification.",
    );
    expect(quoted).not.toBeNull();
    const fallback = sectionForIndicator(
      "incident-management-policy-and-register",
      "zzz qqq",
    );
    expect(fallback).not.toBeNull();
    expect(sectionForIndicator("no-such-document", "x")).toBeNull();
  });

  it("numbers the section as the document renders it, never counting the unnumbered front matter (Session B)", () => {
    const type = documentTypeById("complaints-management-policy-and-register")!;
    const outline = outlineFor(type);
    const s = sectionForIndicator(
      type.id,
      "The scope of the policy covers who can complain, including family members, nominees and advocates acting for a participant.",
    )!;
    expect(s.id).toBe("scope");
    expect(String(s.number)).toBe(
      outline.find((o) => o.id === "scope")!.number,
    );
    expect(s.mode).toBe("tailored");
  });

  it("AC-6: a standard no document carries reads D-2933's line; an unmapped finding has no line", () => {
    const carried = new Set(catalogue.items.flatMap((t) => t.standards));
    const orphan = getStandardsDataset().standards.find(
      (s) => !carried.has(s.id),
    );
    if (orphan) expect(answeredInLine(orphan.id)).toBe(NO_DOCUMENT_LINE);
    expect(answeredInLine("a.standard.nothing-carries")).toBe(NO_DOCUMENT_LINE);
    expect(answeredInLine("")).toBeNull();
    expect(mapFinding("")).toEqual({ documents: [], registers: [] });
  });
});

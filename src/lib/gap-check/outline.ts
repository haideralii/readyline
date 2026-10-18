import { catalogue, sectionsFor } from "@/lib/generator/catalogue";
import { outlineFor } from "@/lib/generator/document-model";
import { REGISTER_NAMES, wordsOf } from "@/lib/registers/findings-map";
import { getStandardsDataset } from "@/lib/standards/dataset";

/**
 * REQ-035 FR-3, FR-4 (D-2966): a document type's outline as the gap check
 * sends it to the model and shows it back. Each section is the generator's
 * (`sectionsFor`, numbered as `outlineFor` numbers them) with the standard
 * ids the catalogue gives the document and, under them, the indicators whose
 * words overlap the section's brief (REQ-033's rule, inverted: the catalogue
 * holds standards per document and the Standards' indicators carry no ids,
 * so a section's indicators are found by their words). A fixed section
 * carries none. The records section carries the type's registers.
 */
export type GapIndicator = {
  standardId: string;
  /** 1-based, in the Commission's order within the standard. */
  place: number;
  text: string;
  /** "<standard name> (<module name>), indicator N" (Dev question 1 (a)). */
  label: string;
};

export type GapOutlineSection = {
  id: string;
  /** "1", "2", … or "" for the front and back matter. */
  number: string;
  heading: string;
  brief: string;
  mode: "fixed" | "tailored";
  standardIds: string[];
  indicators: GapIndicator[];
  /** The registers this section keeps as records, in the registers index's words. */
  registers: string[];
};

export type GapOutline = {
  typeId: string;
  title: string;
  kind: string;
  sections: GapOutlineSection[];
};

/** The sections that keep records: the outline's records section, or one whose heading or brief names a register. */
const RECORDS_SECTION_IDS = new Set(["records-and-evidence"]);

export function indicatorLabel(standardId: string, place: number): string {
  const data = getStandardsDataset();
  const s = data.standards.find((x) => x.id === standardId);
  if (!s) return `${standardId}, indicator ${place}`;
  const moduleName =
    data.modules.find((m) => m.id === s.moduleId)?.name ?? s.moduleId;
  return `${s.name} (${moduleName}), indicator ${place}`;
}

/** The outline for a catalogue type, or null for an id the catalogue does not hold or has retired. */
export function gapOutlineFor(typeId: string): GapOutline | null {
  const type = catalogue.items.find((t) => t.id === typeId && !t.retired);
  if (!type) return null;
  const sections = sectionsFor(type);
  const data = getStandardsDataset();
  // The numbers the document itself carries (`outlineFor`), so the result and the pack agree.
  const numbers = new Map(outlineFor(type).map((e) => [e.id, e.number]));
  const out: GapOutlineSection[] = sections.map((s) => {
    const names =
      RECORDS_SECTION_IDS.has(s.id) || /\bregisters?\b/i.test(s.heading)
        ? (type.registers ?? []).map((r) => REGISTER_NAMES[r] ?? r)
        : [];
    return {
      id: s.id,
      number: numbers.get(s.id) ?? "",
      heading: s.heading,
      brief: s.brief,
      mode: s.mode,
      standardIds: s.mode === "tailored" ? [...type.standards] : [],
      indicators: [],
      registers: names,
    };
  });
  // Each indicator to the tailored section whose heading and brief share the most words with it, above a floor of two.
  for (const standardId of type.standards) {
    const standard = data.standards.find((x) => x.id === standardId);
    if (!standard) continue;
    standard.indicators.forEach((text, i) => {
      const want = wordsOf(text);
      let best: { index: number; score: number } | null = null;
      out.forEach((s, index) => {
        if (s.mode !== "tailored") return;
        const have = wordsOf(`${s.heading} ${s.brief}`);
        let score = 0;
        for (const w of want) if (have.has(w)) score += 1;
        if (score >= 2 && (!best || score > best.score))
          best = { index, score };
      });
      if (best) {
        const place = i + 1;
        out[(best as { index: number }).index].indicators.push({
          standardId,
          place,
          text,
          label: indicatorLabel(standardId, place),
        });
      }
    });
  }
  return { typeId: type.id, title: type.title, kind: type.kind, sections: out };
}

/** The catalogue's live types, titles and ids, for the picker (FR-1). */
export function gapCheckTypes(): { id: string; title: string }[] {
  return catalogue.items
    .filter((t) => !t.retired)
    .map((t) => ({ id: t.id, title: t.title }));
}

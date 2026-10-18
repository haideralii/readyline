/**
 * From a finding's standard to the pack (REQ-033 FR-4; D-2933): the document
 * types whose standards carry it and, in each, the section whose brief names
 * the indicator (word overlap with the indicator's text, else the first
 * section the model drafts), with the registers those documents carry. Pure
 * over the catalogue and the standards dataset; the page adds the links into
 * the account's own set.
 */
import { catalogue, sectionsFor } from "@/lib/generator/catalogue";
import { getStandardsDataset } from "@/lib/standards/dataset";

export type AnsweredIn = {
  typeId: string;
  title: string;
  /** The section's number in the document and its heading, or null when no brief names the indicator and no tailored section exists. */
  section: { number: number; heading: string } | null;
};

export type FindingMapping = {
  documents: AnsweredIn[];
  /** The registers those documents carry, by their register names. */
  registers: string[];
};

/** D-2933: the line when the standard maps to no document of the pack. */
export const NO_DOCUMENT_LINE =
  "No document in your pack carries this standard.";

/** The registers the pack's documents name, in the words the registers index uses. */
export const REGISTER_NAMES: Record<string, string> = {
  incidents: "Incident register",
  complaints: "Complaints register",
  "worker-clearances": "Worker checks register",
  "policy-reviews": "Policy review register",
  training: "Training register",
  "restrictive-practices": "Restrictive practices register",
  improvements: "Continuous improvement register",
};

const STOP = new Set([
  "and",
  "the",
  "of",
  "for",
  "to",
  "in",
  "a",
  "an",
  "or",
  "with",
  "is",
  "are",
  "each",
  "their",
  "that",
  "by",
  "on",
  "as",
  "be",
  "its",
]);
/** The content words of a text (REQ-035 reuses it for the gap check's outline). */
export const wordsOf = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );

/** The section of a document whose brief shares the most words with the indicator, above a floor of two; else the first tailored section. */
export function sectionForIndicator(
  typeId: string,
  indicator: string,
): { number: number; heading: string } | null {
  const type = catalogue.items.find((t) => t.id === typeId);
  if (!type) return null;
  const sections = sectionsFor(type);
  const want = wordsOf(indicator);
  let best: { index: number; score: number } | null = null;
  if (want.size > 0)
    sections.forEach((s, index) => {
      const have = wordsOf(`${s.heading} ${s.brief}`);
      let score = 0;
      for (const w of want) if (have.has(w)) score += 1;
      if (score >= 2 && (!best || score > best.score)) best = { index, score };
    });
  const index =
    best !== null
      ? (best as { index: number }).index
      : sections.findIndex((s) => s.mode === "tailored");
  if (index < 0) return null;
  return { number: index + 1, heading: sections[index].heading };
}

/** The indicator text to match by: the row's own, else the standard's indicators joined. */
export function indicatorTextFor(
  standardId: string,
  indicator: string,
): string {
  if (indicator.trim()) return indicator;
  const s = getStandardsDataset().standards.find((x) => x.id === standardId);
  return s ? s.indicators.join(" ") : "";
}

/** FR-4: the documents and sections that answer a finding against `standardId`, and their registers. */
export function mapFinding(standardId: string, indicator = ""): FindingMapping {
  if (!standardId) return { documents: [], registers: [] };
  const text = indicatorTextFor(standardId, indicator);
  const types = catalogue.items.filter(
    (t) => !t.retired && t.standards.includes(standardId),
  );
  const registers = new Set<string>();
  const documents = types.map((t) => {
    for (const r of t.registers ?? []) registers.add(REGISTER_NAMES[r] ?? r);
    return {
      typeId: t.id,
      title: t.title,
      section: sectionForIndicator(t.id, text),
    };
  });
  return { documents, registers: [...registers] };
}

/** "Answered in: Incident management policy, section 3 What we do; Incident register", or D-2933's line, or null while unmapped. */
export function answeredInLine(
  standardId: string,
  indicator = "",
): string | null {
  if (!standardId) return null;
  const m = mapFinding(standardId, indicator);
  if (m.documents.length === 0) return NO_DOCUMENT_LINE;
  const parts = m.documents.map((d) =>
    d.section
      ? `${d.title}, section ${d.section.number} ${d.section.heading}`
      : d.title,
  );
  return `Answered in: ${[...parts, ...m.registers].join("; ")}`;
}

/**
 * From an auditor's report to candidate findings (REQ-033 FR-1, FR-2, FR-4;
 * D-2930, D-2931, D-2934). Pure: the text in, the candidates out, nothing
 * kept. A candidate is a numbered item, a table row or a paragraph that
 * names a standard, an indicator or one of the finding words; each carries
 * the severity the words give, the standard when its name is in the text,
 * and the participant detector's warnings (the gate, FR-2). The model's
 * proposal of a standard is a separate, later step, after the gate.
 */
import { detectParticipantData } from "@/lib/privacy/participant-data";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { AUDIT_DAY_TEXT_CAPS } from "./audit-day-types";
import type { FindingSeverity } from "./audit-day-types";

export const FINDING_MAX_CHARS = AUDIT_DAY_TEXT_CAPS.short;
/** A block shorter than this is a heading ("Summary of findings"), not a finding. */
export const FINDING_MIN_CHARS = 40;

/** The words that make a paragraph a candidate (FR-1), case-insensitively. */
export const FINDING_WORDS =
  /non-?conform(?:ity|ance|ities|ances)|\bfinding\b|\bfindings\b|corrective|\bmajor\b|\bminor\b|\bobservation\b|quality indicator|practice standard|\bindicator\b|\bstandard\b/i;

/** A numbered item: "1.", "1)", "(1)", "1.2", "Finding 3:", "NC-02". */
const NUMBERED =
  /^\s*(?:\(?\d{1,3}(?:\.\d{1,2})?[.)]?|finding\s+\d{1,3}:?|NC[-\s]?\d{1,3}:?)\s+/i;

export type FindingCandidate = {
  /** The candidate's words, whitespace folded, at most FINDING_MAX_CHARS. */
  text: string;
  severity: FindingSeverity;
  /** The standard whose name the words carry, or "" (the model may propose one later). */
  standardId: string;
  /** The gate (FR-2): the detector's messages; a candidate with any cannot be saved as it is. */
  warnings: string[];
  /** True when the text was cut to the cap. */
  truncated: boolean;
};

/** Folds whitespace and cuts to the cap on a word boundary. */
export function foldCandidateText(raw: string): {
  text: string;
  truncated: boolean;
} {
  const folded = raw.replace(/\s+/g, " ").trim();
  if (folded.length <= FINDING_MAX_CHARS)
    return { text: folded, truncated: false };
  const cut = folded.slice(0, FINDING_MAX_CHARS);
  const space = cut.lastIndexOf(" ");
  return {
    text: (space > FINDING_MAX_CHARS - 60 ? cut.slice(0, space) : cut).trim(),
    truncated: true,
  };
}

/** The severity the words give: major before minor before observation; minor when none (the common case). */
export function severityFromWords(text: string): FindingSeverity {
  if (/\bmajor\b/i.test(text)) return "major";
  if (/\bminor\b/i.test(text)) return "minor";
  if (/\bobservation\b|opportunit(?:y|ies) for improvement|\bOFI\b/i.test(text))
    return "observation";
  return "minor";
}

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
  "management",
  "supports",
  "support",
  "provision",
  "module",
  "core",
  // The audit's own words, in every finding, never the standard's name alone.
  "quality",
  "indicator",
  "indicators",
  "practice",
  "standard",
  "standards",
]);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/**
 * The standard whose name the words carry: every content word of the
 * standard's name present in the text (so "incident management" names the
 * incident management standard, "risk management" the risk one); the
 * longest such name wins; "" when none.
 */
export function standardFromWords(text: string): string {
  const lower = text.toLowerCase();
  const hay = new Set(words(text));
  const data = getStandardsDataset();
  // A report names the division before the standard ("Governance and operational management:
  // incident management"), so the name whose words come later wins; a longer name breaks a tie.
  let best: { id: string; size: number; at: number } | null = null;
  for (const s of data.standards) {
    const need = [...new Set(words(s.name))];
    if (need.length === 0) continue;
    if (!need.every((w) => hay.has(w))) continue;
    const at = Math.max(...need.map((w) => lower.indexOf(w)));
    if (!best || at > best.at || (at === best.at && need.length > best.size))
      best = { id: s.id, size: need.length, at };
  }
  return best?.id ?? "";
}

/** Splits a report's text into blocks: numbered items start a block; blank lines end one; table rows (tabs or pipes) stand alone. */
export function splitBlocks(text: string): string[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    const joined = cur.join(" ").trim();
    if (joined) blocks.push(joined);
    cur = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/\t|\|/.test(line)) {
      flush();
      blocks.push(
        line.replace(/\s*[\t|]\s*/g, "; ").replace(/^;\s*|;\s*$/g, ""),
      );
      continue;
    }
    if (NUMBERED.test(line) && cur.length) flush();
    cur.push(line);
  }
  flush();
  return blocks;
}

/** FR-1: the candidates in a report's text, each with its severity, its named standard and the gate's warnings. */
export function findingCandidates(text: string): FindingCandidate[] {
  return splitBlocks(text)
    .filter((b) => b.length >= FINDING_MIN_CHARS && FINDING_WORDS.test(b))
    .map((b) => {
      const { text: folded, truncated } = foldCandidateText(b);
      return {
        text: folded,
        severity: severityFromWords(folded),
        standardId: standardFromWords(folded),
        warnings: detectParticipantData(folded).map((w) => w.message),
        truncated,
      };
    });
}

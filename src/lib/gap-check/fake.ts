import type { ModelRequest } from "@/lib/generator/prompts";
import { readGapRequest } from "./prompt";

/**
 * REQ-035 FR-3 (D-2965): the e2e's answer to a gap-check request, from the
 * request itself. A section is `covered` when every word of its heading of
 * four letters or more, outside the small words, appears in the text (whole
 * words, case-insensitive); a heading with no such word, and every other
 * section, is `missing`. Never `partly`, so the fixture's answer is fixed.
 * Null for any other request, which goes to the replay client.
 */
const SMALL = new Set([
  "this",
  "that",
  "with",
  "from",
  "into",
  "your",
  "what",
  "when",
]);

export function headingWords(heading: string): string[] {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !SMALL.has(w));
}

export function fakeGapCheckReply(request: ModelRequest): string | null {
  const read = readGapRequest(request);
  if (!read) return null;
  const have = new Set(
    read.text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  const reply = read.outline.sections.map((s) => {
    const words = headingWords(s.heading);
    const covered = words.length > 0 && words.every((w) => have.has(w));
    return {
      sectionId: s.id,
      state: covered ? "covered" : "missing",
      reason: covered
        ? `The outline's ${s.heading} section was found by its heading.`
        : `The outline's ${s.heading} section was not found by its heading.`,
    };
  });
  return JSON.stringify(reply);
}

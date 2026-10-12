/**
 * The refund promise shown before purchase (REQ-007 business rules, FR-1) is
 * the text of product/legal/refunds.md, sections "Our promise" and "The
 * document pack", read at render time so the pricing page and the Refunds
 * page say the same thing (D-043: refunds.md is the single source). Server
 * code only: it reads the file system through the legal loader.
 */
import { loadLegalPage } from "@/lib/legal/pages";

export const REFUND_PROMISE_SECTIONS = [
  "Our promise",
  "The document pack",
] as const;

/** The paragraphs under the named "##" headings of a markdown body, in order. */
export function sectionParagraphs(
  markdown: string,
  headings: readonly string[],
): string[] {
  const out: string[] = [];
  let collecting = false;
  for (const line of markdown.split(/\r?\n/)) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) {
      collecting = headings.includes(h[1].trim());
      continue;
    }
    if (/^#\s/.test(line)) {
      collecting = false;
      continue;
    }
    if (collecting && line.trim()) out.push(line.trim());
  }
  return out;
}

/** The promise paragraphs exactly as refunds.md states them. */
export function refundPromise(): string[] {
  return sectionParagraphs(
    loadLegalPage("refunds").body,
    REFUND_PROMISE_SECTIONS,
  );
}

/**
 * Resolving merge conflicts in prose (the PO's standing rule, 14 Oct 2026;
 * D-1011): DECISIONS.md and product/NEXT.md conflict at every stacked merge
 * because each branch appends at the same place, and the rule is to keep
 * both sides in order. This module does that and nothing else: it refuses
 * any path that is not a Markdown file, because the same treatment once
 * landed on `playwright.config.ts` and produced a file with both versions
 * of a code block. Pure functions; the command is resolve-prose-conflicts.ts.
 */
import { repairText } from "../../src/lib/text/encoding.ts";

/** Only Markdown is prose; anything else is code and is never merged by concatenation. */
export function isProsePath(path: string): boolean {
  return /\.md$/i.test(path.trim());
}

export function assertProsePath(path: string): void {
  if (!isProsePath(path))
    throw new Error(
      `resolve-prose-conflicts: refusing ${path}; only .md files are prose (resolve code conflicts by hand)`,
    );
}

const BLOCK =
  /^<<<<<<< [^\n]*\r?\n([\s\S]*?)^=======\r?\n([\s\S]*?)^>>>>>>> [^\n]*\r?\n/gm;
const MARKER = /^(<<<<<<<|=======|>>>>>>>)/m;

export type ResolvedProse = { text: string; blocks: number };

/**
 * Every conflict block becomes HEAD's side followed by the other side, each
 * ending in one blank line; when one side is only the mojibake repair of
 * the other, the repaired side is kept alone. Throws when a marker is left.
 */
export function resolveProseConflicts(input: string): ResolvedProse {
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  let blocks = 0;
  text = text.replace(BLOCK, (_m, head: string, other: string) => {
    blocks += 1;
    if (repairText(head) === other) return other;
    if (repairText(other) === head) return head;
    const h = head.replace(/\s*$/, "\n\n");
    const o = other.replace(/\s*$/, "\n\n");
    return h + o;
  });
  if (MARKER.test(text))
    throw new Error("resolve-prose-conflicts: a conflict marker remains");
  return { text: repairText(text), blocks };
}

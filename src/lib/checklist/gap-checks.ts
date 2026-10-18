import { gapCheckDatedLine } from "@/lib/gap-check/words";
import type { ShownChecklist } from "./state";

/**
 * REQ-035 FR-5 (D-2967): the checklist's document item for a type the owner
 * has checked gains one dated line linking the newest result; the item's
 * own status is untouched, since a covered outline is not an adopted policy.
 */
export type GapCheckForChecklist = {
  id: string;
  documentTypeId: string;
  /** "19 October 2026", the run's Sydney day. */
  day: string;
  missing: number;
};

export function applyGapChecks(
  shown: ShownChecklist,
  checks: readonly GapCheckForChecklist[],
): ShownChecklist {
  if (checks.length === 0) return shown;
  // Newest first is how the rows come; the first per type wins.
  const latest = new Map<string, GapCheckForChecklist>();
  for (const c of checks)
    if (!latest.has(c.documentTypeId)) latest.set(c.documentTypeId, c);
  const items = shown.items.map((i) => {
    const c = i.documentTypeId ? latest.get(i.documentTypeId) : undefined;
    if (!c) return i;
    return {
      ...i,
      gapLine: {
        text: gapCheckDatedLine(c.day, c.missing),
        href: `/documents/gap-check/${c.id}`,
      },
    };
  });
  return {
    ...shown,
    items,
    groups: shown.groups.map((g) => ({
      ...g,
      items: g.items.map((i) => items.find((x) => x.id === i.id) ?? i),
    })),
  };
}

/**
 * The result page's own copy and the two list rules it renders (REQ-027 A2:
 * FR-3a, FR-3b; D-2707 as REQ-028 D-2805 amends it, D-2716, D-2718, D-2722, D-2723, D-2725), in a `.ts`
 * beside the page so the copy lint walks the strings (`COPY_MODULES`) and the
 * unit test reads them without React. Every sentence here is the PO's.
 */
import type { HaveStatus } from "@/lib/questionnaire/document-set";

/** REQ-025 FR-4a as D-2718 amends it: the reader's answers, in the reader's words; an unasked row carries no tag. */
export const HAVE_TAG: Partial<
  Record<HaveStatus, { label: string; icon: string; tone: string }>
> = {
  yes: { label: "You have one", icon: "✓", tone: "text-moss border-moss" },
  no: { label: "You need one", icon: "○", tone: "text-ochre border-ochre" },
  "not-sure": {
    label: "You said not sure",
    icon: "○",
    tone: "text-ochre border-ochre",
  },
};

export type HaveCounts = { yes: number; need: number; notSure: number };

/** D-2725: a group's three counted parts; `unknown` rows count nowhere and `need` never counts a `not-sure` row. */
export function countHave(items: readonly { have: HaveStatus }[]): HaveCounts {
  const c: HaveCounts = { yes: 0, need: 0, notSure: 0 };
  for (const i of items) {
    if (i.have === "yes") c.yes += 1;
    else if (i.have === "no") c.need += 1;
    else if (i.have === "not-sure") c.notSure += 1;
  }
  return c;
}

/** "1 you have, 1 you need, 1 not sure", in that order, empty parts dropped; "" for a group with no asked row. */
export function haveCounts(items: readonly { have: HaveStatus }[]): string {
  const c = countHave(items);
  const parts: string[] = [];
  if (c.yes) parts.push(`${c.yes} you have`);
  if (c.need) parts.push(`${c.need} you need`);
  if (c.notSure) parts.push(`${c.notSure} not sure`);
  return parts.join(", ");
}

/** D-2718, D-2722: the five sentences above the first document group; the numeral is `askedDocumentCount(set)`. */
export function haveLegend(asked: number): string {
  return `Your pack drafts every document below. Where you have one, keep yours or use ours. Where you need one, ours is your starting point. We asked about ${asked} of the documents below in the last step. The tags are your answers from the last step.`;
}

/** D-2723: the sole trader's line in the "Your workers" group, the rule and not the reader's gap. */
export const SOLE_TRADER_LINE =
  "A sole trader needs the clearance in their own name.";

/** D-2723: its source line, in the reasons' shape; the hedge sentence the convention puts first; the link in the same tab. */
export const SOLE_TRADER_SOURCE = {
  text: "Worker Screening Rules s 13(c), with few exceptions.",
  source: {
    title: "NDIS Worker Screening Check (NDIS Commission)",
    url: "https://www.ndiscommission.gov.au/workers/worker-screening",
  },
} as const;

/** The result page's hedge for an unconfirmed source (`result-step.tsx`'s reasons convention). */
export const UNCONFIRMED_SOURCE_HEDGE =
  "Check this against the Commission's page before you rely on it.";

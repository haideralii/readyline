import { z } from "zod";
import { findProhibitedClaims } from "@/lib/claims";
import type { GapOutline } from "./outline";
import {
  GAP_BANNED_WORDS,
  GAP_STATES,
  type GapCounts,
  type GapState,
} from "./words";

/**
 * REQ-035 FR-3, AC-4 (D-2964, D-2968): the model's reply read against the
 * outline. A section id outside the outline is dropped; a section the reply
 * leaves out is `missing`; a reason that carries any run of eight
 * consecutive words from the provider's text, a prohibited claim or a banned
 * word, or more than 300 characters, is replaced by the fixed sentence.
 */
export const FIXED_REASON =
  "The outline asks for this; your document does not say it in a way the check could find.";
export const REASON_MAX_CHARS = 300;
export const QUOTE_RUN_WORDS = 8;

export type GapSectionResult = {
  sectionId: string;
  state: GapState;
  reason: string;
};

const Reply = z.array(
  z.object({
    sectionId: z.string(),
    state: z.enum(GAP_STATES),
    reason: z.string().optional(),
  }),
);

/** The words of a text, lower case, letters and digits only. */
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True when `reason` carries `QUOTE_RUN_WORDS` consecutive words that appear consecutively in `source` (D-2964). */
export function quotesSource(reason: string, source: string): boolean {
  const r = tokens(reason);
  if (r.length < QUOTE_RUN_WORDS) return false;
  const s = tokens(source);
  if (s.length < QUOTE_RUN_WORDS) return false;
  const runs = new Set<string>();
  for (let i = 0; i + QUOTE_RUN_WORDS <= s.length; i += 1)
    runs.add(s.slice(i, i + QUOTE_RUN_WORDS).join(" "));
  for (let i = 0; i + QUOTE_RUN_WORDS <= r.length; i += 1)
    if (runs.has(r.slice(i, i + QUOTE_RUN_WORDS).join(" "))) return true;
  return false;
}

/** The reason as it may be stored, or the fixed sentence. */
export function cleanReason(
  reason: string | undefined,
  source: string,
): string {
  const r = (reason ?? "").replace(/\s+/g, " ").trim();
  if (!r || r.length > REASON_MAX_CHARS) return FIXED_REASON;
  if (quotesSource(r, source)) return FIXED_REASON;
  if (GAP_BANNED_WORDS.some((re) => re.test(r))) return FIXED_REASON;
  if (findProhibitedClaims(r).length > 0) return FIXED_REASON;
  return r;
}

/** The reply's JSON array, found even when the model wraps it in prose or a fence. */
function arrayIn(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const a = trimmed.indexOf("[");
    const b = trimmed.lastIndexOf("]");
    if (a < 0 || b <= a) return null;
    try {
      return JSON.parse(trimmed.slice(a, b + 1));
    } catch {
      return null;
    }
  }
}

export function parseGapReply(
  replyText: string,
  outline: GapOutline,
  source: string,
): GapSectionResult[] {
  const raw = arrayIn(replyText);
  const parsed = Reply.safeParse(raw);
  const byId = new Map<string, { state: GapState; reason?: string }>();
  if (parsed.success)
    for (const item of parsed.data)
      if (!byId.has(item.sectionId))
        byId.set(item.sectionId, { state: item.state, reason: item.reason });
  // Outline order; an id the reply did not name is missing (AC-4); ids outside the outline fall away.
  return outline.sections.map((s) => {
    const got = byId.get(s.id);
    if (!got)
      return { sectionId: s.id, state: "missing", reason: FIXED_REASON };
    return {
      sectionId: s.id,
      state: got.state,
      reason: cleanReason(got.reason, source),
    };
  });
}

export function countStates(
  sections: readonly { state: GapState }[],
): GapCounts {
  const c: GapCounts = { covered: 0, partly: 0, missing: 0 };
  for (const s of sections) c[s.state] += 1;
  return c;
}

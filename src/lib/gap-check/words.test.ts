/**
 * REQ-035 FR-6, AC-6 (D-2968): the page's words carry the lawyer's intro
 * verbatim, none of the banned words, no prohibited claim; the lines read as
 * FR-4 and FR-5 write them.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import {
  GAP_BANNED_WORDS,
  GAP_CHECK_INTRO,
  GAP_CHECK_NEVER_STORED,
  GAP_CHECK_WORDS,
  GAP_STATE_LABELS,
  gapCheckCardLine,
  gapCheckDatedLine,
  gapCountsLine,
  inPackLine,
  keptAsRecordLine,
} from "./words";

describe("the gap check's words (REQ-035 FR-6)", () => {
  it("carries the intro and the never-stored line verbatim", () => {
    expect(GAP_CHECK_INTRO).toBe(
      "Compare a policy you already have with the outline Readyline writes from the NDIS Practice Standards' quality indicators. The check tells you which sections of the outline your document covers, partly covers or leaves out. It is a comparison with Readyline's outline, not an audit, and an auditor may read your document differently.",
    );
    expect(GAP_CHECK_NEVER_STORED).toBe(
      "Readyline reads your document once, compares it with its outline for this document type, and keeps only the list below. The file and its words are not stored.",
    );
  });

  it("has no banned word and no prohibited claim in any string", () => {
    for (const w of GAP_CHECK_WORDS) {
      for (const re of GAP_BANNED_WORDS) expect(w, re.source).not.toMatch(re);
      expect(findProhibitedClaims(w), w).toEqual([]);
    }
    expect(GAP_STATE_LABELS).toEqual({
      covered: "Covered",
      partly: "Partly covered",
      missing: "Not covered",
    });
  });

  it("writes the counts, the pack, the record, the dated and the card lines as the REQ does", () => {
    expect(
      gapCountsLine(
        "Complaints policy 2023",
        "Complaints management policy, procedure and register",
        {
          covered: 6,
          partly: 2,
          missing: 3,
        },
      ),
    ).toBe(
      "Your Complaints policy 2023 against Readyline's Complaints management policy, procedure and register outline: 6 sections covered, 2 partly, 3 not covered",
    );
    expect(inPackLine("Incident management policy", "3", "What we do")).toBe(
      "In the Readyline pack: Incident management policy, section 3 What we do",
    );
    expect(keptAsRecordLine("Complaints register")).toBe(
      "Kept as a record: the Complaints register",
    );
    expect(gapCheckDatedLine("19 October 2026", 3)).toBe(
      "Gap check 19 October 2026: 3 sections not covered",
    );
    expect(gapCheckDatedLine("19 October 2026", 1)).toBe(
      "Gap check 19 October 2026: 1 section not covered",
    );
    expect(gapCheckCardLine(2, 5)).toBe(
      "2 of your own policies checked, 5 sections to close",
    );
    expect(gapCheckCardLine(1, 1)).toBe(
      "1 of your own policy checked, 1 section to close",
    );
  });
});

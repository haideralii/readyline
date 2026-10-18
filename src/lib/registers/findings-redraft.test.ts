/**
 * REQ-033 Session B FR-B7 (D-2936, D-2955, D-2957; AC-B9): the redraft's
 * words pass the claims lint, name no "fix", "resolve", "comply" or "close"
 * on a control, say that the auditor decides, and the small helpers behave.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import {
  DRAFT_REDRAFT_LABEL,
  KEEP_CURRENT_LABEL,
  REDRAFT_BUTTON_LABEL,
  REDRAFT_INTRO,
  REDRAFT_LIMITED,
  REDRAFT_NEEDS_SUBSCRIPTION,
  REDRAFT_NO_PACK,
  REDRAFT_NO_SECTION,
  REDRAFT_NO_VERSION,
  REDRAFT_NOT_FOUND,
  REDRAFT_UNAVAILABLE,
  REDRAFT_WHAT_IS_SENT,
  USE_REDRAFT_LABEL,
  changedSentences,
  noRedraftReason,
  redraftStateLine,
  redraftTrailLine,
} from "./findings-redraft";

const CONTROLS = [
  REDRAFT_BUTTON_LABEL,
  USE_REDRAFT_LABEL,
  KEEP_CURRENT_LABEL,
  DRAFT_REDRAFT_LABEL,
];
const SENTENCES = [
  REDRAFT_INTRO,
  REDRAFT_WHAT_IS_SENT,
  REDRAFT_NEEDS_SUBSCRIPTION,
  REDRAFT_NO_PACK,
  REDRAFT_NO_SECTION,
  REDRAFT_NO_VERSION,
  REDRAFT_LIMITED,
  REDRAFT_NOT_FOUND,
  REDRAFT_UNAVAILABLE,
  noRedraftReason("register"),
  noRedraftReason("fixed"),
  noRedraftReason("no-version"),
  noRedraftReason("unmapped"),
  redraftTrailLine("Complaints policy", "2", 2),
  redraftStateLine({ title: "Complaints policy", version: 2, adoptedOn: null }),
  redraftStateLine({
    title: "Complaints policy",
    version: 2,
    adoptedOn: "2026-10-20",
  }),
];

describe("the redraft's words (FR-B7)", () => {
  it("pass the prohibited-claims lint", () => {
    for (const s of [...CONTROLS, ...SENTENCES])
      expect(findProhibitedClaims(s), s).toEqual([]);
  });

  it("name no fix, resolve, comply, clear, pass or close on a control (D-2936)", () => {
    for (const c of CONTROLS)
      expect(c).not.toMatch(/\b(fix|resolve|comply|clear|pass|close)\b/i);
  });

  it("say the auditor decides and what the model sees", () => {
    expect(REDRAFT_INTRO).toBe(
      "Readyline rewrites this one section with your finding as context and shows you the result beside the current text. Nothing changes until you choose the redraft, and the new version waits for your approval like any other. Your auditor decides whether the finding is closed.",
    );
    expect(REDRAFT_WHAT_IS_SENT).toMatch(
      /nothing else from your account or your registers/,
    );
  });

  it("writes the trail and state lines an auditor reads (FR-B6)", () => {
    expect(redraftTrailLine("Complaints policy", "2", 2)).toBe(
      "Section 2 of Complaints policy redrafted (version 2).",
    );
    expect(
      redraftStateLine({
        title: "Complaints policy",
        version: 2,
        adoptedOn: null,
      }),
    ).toBe("Redrafted: Complaints policy, version 2, awaiting adoption");
    expect(
      redraftStateLine({
        title: "Complaints policy",
        version: 2,
        adoptedOn: "2026-10-20",
      }),
    ).toBe("Redrafted: Complaints policy, version 2, adopted 2026-10-20");
  });

  it("marks the sentences the current text does not carry (FR-B4)", () => {
    const changed = changedSentences(
      "We welcome complaints. We record each one.",
      "We welcome complaints. We record each one. Family members can complain for a participant.",
    );
    expect([...changed]).toEqual([
      "Family members can complain for a participant.",
    ]);
    expect(changedSentences("Same words.", "same  words.").size).toBe(0);
  });
});

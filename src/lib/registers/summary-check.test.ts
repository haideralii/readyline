// @vitest-environment node
/**
 * REQ-033 Session C (AC-C1's unit half, FR-C5): the state follows a changed
 * tailored section only in a document that carries the plain-words summary,
 * never the summary's own redraft; the words pass the claims lint and name
 * no "compliant", "closed" or "resolved".
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { documentTypeById } from "@/lib/generator/catalogue";
import {
  EASY_READ_CHECK_LINE,
  SUMMARY_CHECK_INTRO,
  SUMMARY_CHECK_LABEL,
  SUMMARY_CONFIRM_LABEL,
  SUMMARY_REDRAFT_LABEL,
  changedSectionLabel,
  summariesToCheckClause,
  summaryCheckFor,
  summaryCheckLine,
  summaryConfirmChangeText,
  summaryRedraftChangeText,
} from "./summary-check";

const complaints = documentTypeById(
  "complaints-management-policy-and-register",
)!;
const governance = documentTypeById("governance-policy")!;

describe("summaryCheckFor (FR-C1, D-2977)", () => {
  it("sets the state when a tailored section of a participant-facing document changes", () => {
    expect(summaryCheckFor(complaints, "scope", "2026-10-19")).toEqual({
      sectionId: "scope",
      on: "2026-10-19",
    });
  });

  it("sets nothing for a document without the summary, for the summary's own redraft, or for an unknown section", () => {
    expect(summaryCheckFor(governance, "scope", "2026-10-19")).toBeNull();
    expect(
      summaryCheckFor(complaints, "plain-language-summary", "2026-10-19"),
    ).toBeNull();
    expect(summaryCheckFor(complaints, "no-such", "2026-10-19")).toBeNull();
  });
});

describe("the words (FR-C5, FR-C1, FR-C2)", () => {
  it("number the changed section as the document does and write the line", () => {
    expect(changedSectionLabel(complaints.id, "scope")).toEqual({
      number: "2",
      heading: "Scope",
    });
    expect(
      summaryCheckLine({ number: "2", heading: "Scope", on: "2026-10-19" }),
    ).toBe(
      "In plain words may be out of date: section 2 Scope changed on 19 October 2026",
    );
    expect(summaryRedraftChangeText("2")).toBe(
      "In plain words redrafted after section 2 changed; approved by [role]",
    );
    expect(summaryConfirmChangeText("2")).toBe(
      "In plain words confirmed after section 2 changed",
    );
    expect(summariesToCheckClause(0)).toBeNull();
    expect(summariesToCheckClause(1)).toBe("1 summary to check");
    expect(summariesToCheckClause(2)).toBe("2 summaries to check");
  });

  it("pass the claims lint and name no compliant, closed or resolved", () => {
    const all = [
      SUMMARY_CHECK_LABEL,
      SUMMARY_CONFIRM_LABEL,
      SUMMARY_REDRAFT_LABEL,
      EASY_READ_CHECK_LINE,
      SUMMARY_CHECK_INTRO,
      summaryCheckLine({ number: "2", heading: "Scope", on: "2026-10-19" }),
      summaryRedraftChangeText("2"),
      summaryConfirmChangeText("2"),
    ];
    for (const s of all) {
      expect(findProhibitedClaims(s), s).toEqual([]);
      expect(s).not.toMatch(/\b(compliant|closed|resolved)\b/i);
    }
    expect(SUMMARY_CHECK_LABEL).toBe("Summary to check");
  });
});

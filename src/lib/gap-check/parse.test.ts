/**
 * REQ-035 FR-3, AC-4 (D-2964, D-2968): the reply read against the outline.
 * A reason quoting eight words of the input is replaced; a section outside
 * the outline is dropped; a section the reply leaves out is missing; a
 * banned word or a prohibited claim in a reason is replaced; the counts.
 */
import { describe, expect, it } from "vitest";
import { gapOutlineFor } from "./outline";
import {
  cleanReason,
  countStates,
  FIXED_REASON,
  parseGapReply,
  quotesSource,
} from "./parse";

const outline = gapOutlineFor("complaints-management-policy-and-register")!;
const source =
  "Every complaint is acknowledged within two business days and answered within twenty business days, and the person is told about other places they can take a complaint.";

describe("the gap reply against the outline (REQ-035 AC-4)", () => {
  it("replaces a reason that quotes eight consecutive words of the input with the fixed sentence", () => {
    const quoting =
      'The document says "acknowledged within two business days and answered within twenty business days" which covers the time frames.';
    expect(quotesSource(quoting, source)).toBe(true);
    expect(cleanReason(quoting, source)).toBe(FIXED_REASON);
    const own =
      "The outline asks for acknowledgement and resolution time frames, and the document gives both.";
    expect(quotesSource(own, source)).toBe(false);
    expect(cleanReason(own, source)).toBe(own);
    // Seven words in a row is not a quote.
    expect(
      quotesSource(
        "acknowledged within two business days and answered",
        source,
      ),
    ).toBe(false);
  });

  it("drops a section outside the outline and marks a section the reply leaves out as missing, in outline order", () => {
    const reply = JSON.stringify([
      {
        sectionId: "purpose",
        state: "covered",
        reason: "The purpose is stated.",
      },
      { sectionId: "not-in-outline", state: "covered", reason: "Nothing." },
      {
        sectionId: "scope",
        state: "partly",
        reason: "The states are named, the workers are not.",
      },
    ]);
    const result = parseGapReply(reply, outline, source);
    expect(result.map((r) => r.sectionId)).toEqual(
      outline.sections.map((s) => s.id),
    );
    expect(result.find((r) => r.sectionId === "purpose")).toEqual({
      sectionId: "purpose",
      state: "covered",
      reason: "The purpose is stated.",
    });
    expect(result.find((r) => r.sectionId === "scope")?.state).toBe("partly");
    const left = result.find((r) => r.sectionId === "procedure")!;
    expect(left).toEqual({
      sectionId: "procedure",
      state: "missing",
      reason: FIXED_REASON,
    });
    expect(result.some((r) => r.sectionId === "not-in-outline")).toBe(false);
  });

  it("reads an array wrapped in prose or a fence, and treats an unreadable reply as every section missing", () => {
    const wrapped =
      'Here is the list:\n```json\n[{"sectionId":"purpose","state":"covered","reason":"Stated."}]\n```';
    expect(
      parseGapReply(wrapped, outline, source).find(
        (r) => r.sectionId === "purpose",
      )?.state,
    ).toBe("covered");
    const broken = parseGapReply("no json here", outline, source);
    expect(broken.every((r) => r.state === "missing")).toBe(true);
    expect(broken.every((r) => r.reason === FIXED_REASON)).toBe(true);
  });

  it("replaces a reason with a banned word, a prohibited claim, an empty or an over-long one (D-2968)", () => {
    expect(
      cleanReason("The document is compliant with this section.", source),
    ).toBe(FIXED_REASON);
    expect(cleanReason("This section is audit-ready.", source)).toBe(
      FIXED_REASON,
    );
    expect(cleanReason("This policy guarantees registration.", source)).toBe(
      FIXED_REASON,
    );
    expect(cleanReason("", source)).toBe(FIXED_REASON);
    expect(cleanReason(undefined, source)).toBe(FIXED_REASON);
    expect(cleanReason("x".repeat(301), source)).toBe(FIXED_REASON);
    expect(cleanReason("  Two   spaces  collapse. ", source)).toBe(
      "Two spaces collapse.",
    );
  });

  it("counts the states", () => {
    expect(
      countStates([
        { state: "covered" },
        { state: "covered" },
        { state: "partly" },
        { state: "missing" },
      ]),
    ).toEqual({ covered: 2, partly: 1, missing: 1 });
  });
});

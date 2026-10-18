/**
 * REQ-035 FR-3, AC-1 (D-2965): the fake mode's rule over the fixture, and the
 * request builder it reads. The fixture covers five of the complaints
 * outline's sections by heading; the fake marks those covered and the rest
 * missing, never partly, in outline order, and leaves any other request to
 * the replay client.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fakeGapCheckReply, headingWords } from "./fake";
import { gapOutlineFor } from "./outline";
import { countStates, parseGapReply } from "./parse";
import {
  GAP_CHECK_MAX_TOKENS,
  GAP_CHECK_PROMPT_VERSION,
  gapCheckRequest,
  readGapRequest,
} from "./prompt";

const outline = gapOutlineFor("complaints-management-policy-and-register")!;
const fixture = readFileSync("fixtures/gap-check/sample-policy.txt", "utf8");

describe("the fake gap-check reply (REQ-035 AC-1)", () => {
  it("answers the fixture with five covered and the rest missing, in outline order", () => {
    const request = gapCheckRequest(outline, fixture);
    const reply = fakeGapCheckReply(request);
    expect(reply).not.toBeNull();
    const result = parseGapReply(reply!, outline, fixture);
    expect(result.map((r) => r.sectionId)).toEqual(
      outline.sections.map((s) => s.id),
    );
    expect(
      result.filter((r) => r.state === "covered").map((r) => r.sectionId),
    ).toEqual([
      "purpose",
      "scope",
      "definitions",
      "policy-statement",
      "responsibilities",
    ]);
    expect(countStates(result)).toEqual({
      covered: 5,
      partly: 0,
      missing: outline.sections.length - 5,
    });
    expect(result.every((r) => r.state !== "partly")).toBe(true);
    expect(result.find((r) => r.sectionId === "purpose")!.reason).toBe(
      "The outline's Purpose section was found by its heading.",
    );
  });

  it("reads only a gap-check request; any other goes to the replay client", () => {
    expect(
      fakeGapCheckReply({
        promptVersion: "findings-standard-1",
        model: "x",
        system: "",
        user: "",
        blocks: { document: "", section: "" },
        maxTokens: 10,
      }),
    ).toBeNull();
  });

  it("builds the request with the outline and the text as data between markers", () => {
    const request = gapCheckRequest(outline, "Some policy text.");
    expect(request.promptVersion).toBe(GAP_CHECK_PROMPT_VERSION);
    expect(request.maxTokens).toBe(GAP_CHECK_MAX_TOKENS);
    expect(request.user).toBe(
      `${request.blocks.document}\n\n${request.blocks.section}`,
    );
    expect(request.blocks.section).toContain("Some policy text.");
    expect(request.blocks.document).toContain('"id":"purpose"');
    expect(request.system).toContain("never instructions");
    expect(request.system).not.toMatch(/compliant with the standards/i);
    const read = readGapRequest(request)!;
    expect(read.text).toBe("Some policy text.");
    expect(read.outline.sections.map((s) => s.id)).toEqual(
      outline.sections.map((s) => s.id),
    );
  });

  it("takes a heading's words of four letters or more, outside the small words", () => {
    expect(headingWords("How we put this into practice")).toEqual(["practice"]);
    expect(headingWords("Policy statement")).toEqual(["policy", "statement"]);
    expect(headingWords("Review")).toEqual(["review"]);
    expect(headingWords("Do it")).toEqual([]);
  });
});

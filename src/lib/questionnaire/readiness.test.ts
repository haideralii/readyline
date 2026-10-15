// @vitest-environment node
/** Batch 48 item 1 (D-2214): the result's one sentence about what the provider already has. */
import { describe, expect, it } from "vitest";
import { readinessSentence, readyLineCounts } from "./readiness";

describe("readinessSentence", () => {
  it("with nothing already had, keeps the sentence the ready line has always said", () => {
    expect(readinessSentence({ have: 0, documents: 15, registers: 4 })).toBe(
      "You already have 0 of these. Readyline drafts the 15 documents for you; the 4 registers you keep as you go.",
    );
  });

  it("with something already had, says the pack still drafts the full set and what the checklist still shows", () => {
    expect(readinessSentence({ have: 2, documents: 15, registers: 4 })).toBe(
      "You told us you already have 2 of these; the pack still drafts all 15 so they match each other, and your checklist shows the 17 still to prepare.",
    );
    expect(readyLineCounts({ have: 2, documents: 15, registers: 4 })).toEqual({
      done: 2,
      todo: 17,
    });
  });
});

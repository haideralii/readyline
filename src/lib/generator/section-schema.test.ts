import { describe, expect, it } from "vitest";
import {
  Block,
  TailoredSection,
  blocksToProse,
  blocksToText,
} from "./section-schema";

const valid = {
  sectionId: "purpose",
  usedFacts: ["tradingName", "structure"],
  blocks: [
    {
      type: "paragraph",
      text: "This policy explains how Sunrise Supports is run.",
    },
    { type: "steps", items: ["Record the decision.", "Tell the worker."] },
    {
      type: "table",
      columns: ["Role", "Does what", "When"],
      rows: [["Owner", "Approves", "Yearly"]],
    },
    { type: "callout", text: "[Provider to complete: name the approver]" },
  ],
};

describe("TailoredSection schema (REQ-005 FR-2, D-501)", () => {
  it("accepts the closed block set", () => {
    const r = TailoredSection.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects unknown keys at every level", () => {
    expect(
      TailoredSection.safeParse({ ...valid, html: "<b>x</b>" }).success,
    ).toBe(false);
    expect(
      TailoredSection.safeParse({
        ...valid,
        blocks: [{ type: "paragraph", text: "ok", style: "bold" }],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown block types, empty lists, line breaks and ragged tables", () => {
    expect(Block.safeParse({ type: "heading", text: "x" }).success).toBe(false);
    expect(Block.safeParse({ type: "bullets", items: [] }).success).toBe(false);
    expect(
      Block.safeParse({ type: "paragraph", text: "two\nlines" }).success,
    ).toBe(false);
    expect(
      Block.safeParse({
        type: "table",
        columns: ["A", "B"],
        rows: [["only one"]],
      }).success,
    ).toBe(false);
  });

  it("only allows known fact keys in usedFacts", () => {
    expect(
      TailoredSection.safeParse({ ...valid, usedFacts: ["participantName"] })
        .success,
    ).toBe(false);
    expect(TailoredSection.safeParse({ ...valid, usedFacts: [] }).success).toBe(
      false,
    );
  });

  it("flattens blocks to text and prose", () => {
    const blocks = TailoredSection.parse(valid).blocks;
    expect(blocksToText(blocks)).toContain("Role Does what When");
    expect(blocksToProse(blocks)).not.toContain("Role");
    expect(blocksToProse(blocks)).toContain("Record the decision.");
  });
});

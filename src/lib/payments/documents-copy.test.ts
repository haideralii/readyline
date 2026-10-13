import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { DOCUMENTS_COPY, documentsStrings } from "./documents-copy";

describe("documents page copy (REQ-007 FR-5, FR-6; CLAUDE.md 4.3)", () => {
  it("passes the prohibited-claims lint on every string", () => {
    for (const s of documentsStrings())
      expect(findProhibitedClaims(s), s).toEqual([]);
  });

  it("shows preparing and delayed states without an error code, and the refund promise's two conditions", () => {
    expect(DOCUMENTS_COPY.preparing).toMatch(/usually 10 to 20 minutes/);
    expect(DOCUMENTS_COPY.delayed).toMatch(/will email you/);
    expect(documentsStrings().join("\n")).not.toMatch(
      /error|failed|exception|code \d/i,
    );
    expect(DOCUMENTS_COPY.refundNote).toMatch(/14 days/);
    expect(DOCUMENTS_COPY.preparingProgress(1)).toBe(
      "1 document drafted so far.",
    );
  });
});

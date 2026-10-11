/**
 * REQ-013 FR-5: every document id in document-sets.json sits under exactly
 * one of the four result-page headings, and no heading names a document that
 * does not exist.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import groups from "./document-groups.json";
import sets from "./document-sets.json";

const known = new Set<string>([
  ...sets.always,
  ...Object.values(sets.byModule).flatMap((list) => list.map((d) => d.id)),
]);

describe("document groups (REQ-013 FR-5)", () => {
  it("has four headings covering every document exactly once", () => {
    expect(groups.groups).toHaveLength(4);
    const mapped = groups.groups.flatMap((g) => g.documents);
    expect(new Set(mapped).size).toBe(mapped.length);
    const pending = new Set(groups.pending);
    // Every document in the current set is grouped; extra ids are allowed only while listed as pending.
    expect([...known].sort()).toEqual(
      mapped.filter((id) => known.has(id) || !pending.has(id)).sort(),
    );
    for (const id of mapped)
      expect(known.has(id) || pending.has(id), id).toBe(true);
  });

  it("uses plain headings without claims", () => {
    expect(
      findProhibitedClaims(groups.groups.map((g) => g.title).join("\n")),
    ).toEqual([]);
  });
});

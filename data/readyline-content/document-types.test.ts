/**
 * REQ-005 FR-1: the document catalogue must cover every id in
 * document-sets.json, point only at real standards and evidence ids, give
 * every document at least one tailored section, and contain no prohibited
 * claim. Data-only test; no generation code.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import sets from "./document-sets.json";
import types from "./document-types.json";
import standards from "../standards.json";

type Section = {
  id: string;
  heading: string;
  mode: "fixed" | "tailored";
  brief: string;
};
type Item = (typeof types.items)[number] & {
  extraSections: Section[];
  proposed?: boolean;
};

const items = types.items as Item[];
const outlines = types.outlines as Record<string, Section[]>;
const standardIds = new Set(standards.standards.map((s) => s.id));
const evidenceIds = new Set(
  standards.standards.flatMap((s) =>
    (s.evidence ?? [])
      .map((e) => e.documentTypeId)
      .filter((x): x is string => typeof x === "string" && x.length > 0),
  ),
);
const registerIds = new Set(sets.registers.map((r) => r.id));
const requiredIds = new Set<string>([
  ...sets.always,
  ...Object.values(sets.byModule).flatMap((list) => list.map((d) => d.id)),
]);

describe("document-types.json (REQ-005 FR-1)", () => {
  it("is Readyline content marked for PO review", () => {
    expect(types.author).toBe("readyline");
    expect(types.status).toBe("draft");
    expect(types.note).toMatch(
      /NOT NDIS Quality and Safeguards Commission text/,
    );
  });

  it("covers every document id in document-sets.json exactly once", () => {
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of requiredIds) expect(ids, id).toContain(id);
    const extras = ids.filter((id) => !requiredIds.has(id));
    for (const id of extras) {
      const item = items.find((i) => i.id === id)!;
      expect(
        item.proposed === true ||
          item.id === "practice-standards-self-assessment",
        id,
      ).toBe(true);
    }
  });

  it("references only real standards, evidence aliases, registers and outlines", () => {
    for (const item of items) {
      for (const s of item.standards)
        expect(standardIds.has(s), `${item.id} -> ${s}`).toBe(true);
      for (const a of item.evidenceAliases)
        expect(evidenceIds.has(a), `${item.id} -> ${a}`).toBe(true);
      for (const r of item.registers)
        expect(registerIds.has(r), `${item.id} -> ${r}`).toBe(true);
      expect(outlines[item.outline], `${item.id} outline`).toBeDefined();
      if (item.id !== "practice-standards-self-assessment")
        expect(item.standards.length, `${item.id} standards`).toBeGreaterThan(
          0,
        );
    }
  });

  it("gives every document a fixed document-control section, a notice, and at least one tailored section", () => {
    for (const item of items) {
      const sections = [...outlines[item.outline], ...item.extraSections];
      const ids = sections.map((s) => s.id);
      expect(new Set(ids).size, `${item.id} duplicate section ids`).toBe(
        ids.length,
      );
      expect(ids[0]).toBe("document-control");
      expect(ids).toContain("notice");
      expect(
        sections.some((s) => s.mode === "tailored"),
        item.id,
      ).toBe(true);
      for (const s of sections) expect(["fixed", "tailored"]).toContain(s.mode);
    }
  });

  it("contains no prohibited claim in any title, purpose, heading or brief", () => {
    const text = [
      ...items.flatMap((i) => [
        i.title,
        i.purpose,
        ...i.extraSections.flatMap((s) => [s.heading, s.brief]),
      ]),
      ...Object.values(outlines).flatMap((o) =>
        o.flatMap((s) => [s.heading, s.brief]),
      ),
    ].join("\n");
    expect(findProhibitedClaims(text)).toEqual([]);
  });

  it("maps every reviewed evidence document id that is a policy, plan, form or register to at least one document", () => {
    const covered = new Set(items.flatMap((i) => i.evidenceAliases));
    const uncovered = [...evidenceIds].filter((e) => !covered.has(e));
    // Listed so the PO can decide: these evidence ids have no document in the set yet.
    expect(uncovered.sort()).toEqual([]);
  });
});

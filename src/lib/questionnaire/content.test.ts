/**
 * REQ-003 PO review item 5: every module and audit type has Readyline content,
 * all content is marked as ours and reviewed, and none of it makes a prohibited claim.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { StandardsDataset } from "@/lib/standards/schema";
import {
  auditTypesContent,
  documentSetsContent,
  documentTitle,
  groupDescriptionsContent,
  modulesContent,
} from "./content";

const dataset = StandardsDataset.parse(
  JSON.parse(
    readFileSync(resolve(process.cwd(), "data/standards.json"), "utf8"),
  ),
);

describe("readyline content files", () => {
  it("are marked as Readyline text and reviewed by the PO", () => {
    for (const c of [
      modulesContent,
      auditTypesContent,
      documentSetsContent,
      groupDescriptionsContent,
    ]) {
      expect(c.author).toBe("readyline");
      expect(c.status).toBe("reviewed");
      expect(c.note).toMatch(/NOT NDIS Quality and Safeguards Commission text/);
    }
  });

  it("every module in the dataset has a description and a document-set entry", () => {
    for (const m of dataset.modules) {
      expect(
        modulesContent.items.some((x) => x.id === m.id),
        m.id,
      ).toBe(true);
      expect(Object.keys(documentSetsContent.byModule), m.id).toContain(m.id);
    }
    expect(modulesContent.items).toHaveLength(dataset.modules.length);
  });

  it("both audit types have a description", () => {
    expect(auditTypesContent.items.map((a) => a.id).sort()).toEqual([
      "certification",
      "verification",
    ]);
  });

  it("document rules reference real classes and the personal-care list is made of real classes", () => {
    const codes = new Set(dataset.registrationGroups.map((g) => g.code));
    for (const c of documentSetsContent.personalCareGroups)
      expect(codes.has(c), c).toBe(true);
    for (const rules of Object.values(documentSetsContent.byModule)) {
      for (const r of rules) {
        if (r.when && Array.isArray(r.when.groupsAny))
          for (const c of r.when.groupsAny) expect(codes.has(c), c).toBe(true);
      }
    }
  });

  it("group descriptions match the Commission class names exactly", () => {
    const byCode = new Map(
      dataset.registrationGroups.map((g) => [g.code, g.name]),
    );
    for (const item of groupDescriptionsContent.items)
      expect(byCode.get(item.code), item.code).toBe(item.name);
  });

  it("contains no prohibited claims", () => {
    const text = [
      ...modulesContent.items.map((m) => m.description),
      ...auditTypesContent.items.map((a) => a.description),
      ...groupDescriptionsContent.items.map((g) => g.description),
      ...documentSetsContent.always.map(documentTitle),
      ...documentSetsContent.registers.map((r) => r.title),
    ].join("\n");
    expect(findProhibitedClaims(text)).toEqual([]);
  });

  it("documentTitle humanises ids and keeps acronyms", () => {
    expect(documentTitle("risk-management-policy-and-register")).toBe(
      "Risk management policy and register",
    );
    expect(documentTitle("ai-use-and-governance-policy")).toBe(
      "AI use and governance policy",
    );
    expect(
      documentTitle("sil-safeguarding-and-roster-oversight-procedure"),
    ).toBe("SIL safeguarding and roster oversight procedure");
  });
});

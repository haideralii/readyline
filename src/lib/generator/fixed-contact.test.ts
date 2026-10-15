// @vitest-environment node
/**
 * Batch 42 fixed text (D-546, D-547, D-548): the Commission's contact block
 * in the complaints and incident documents, the restrictive practice
 * position in the safeguarding policy, the self-assessment's "Items to
 * prepare before the audit" from the one audit-day list, and the records
 * section by canonical names. Rendered from the sole-trader reference case
 * without a model call.
 */
import { describe, expect, it } from "vitest";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  canonicalRecordName,
  isCanonicalRecordName,
  itemsToPrepareBeforeAudit,
  itemsToPrepareByTier,
} from "@/lib/registers/names";
import { documentTypeById } from "./catalogue";
import { buildSkeleton, type ResolvedSection } from "./document-model";
import { buildProviderFacts } from "./facts";
import { COMMISSION_CONTACT_STRINGS } from "./fixed-extras";
import { contactStringsIn, lintContactDetails } from "./lint";
import { loadReferenceCases } from "./reference-cases";
import { blocksToText } from "./section-schema";

const dataset = getStandardsDataset();
const cases = loadReferenceCases();

function skeleton(caseId: string, typeId: string) {
  const c = cases.find((x) => x.id === caseId)!;
  const type = documentTypeById(typeId);
  if (!type) throw new Error(`no catalogue entry for ${typeId}`);
  return buildSkeleton({
    type,
    facts: buildProviderFacts(c.answers, c.result),
    dataset,
    result: c.result,
    version: "0.1.0-test",
    generatedAt: "2026-10-14",
  });
}

const section = (sections: ResolvedSection[], id: string) => {
  const s = sections.find((x) => x.id === id);
  if (!s) throw new Error(`no section ${id}`);
  return s;
};

describe("How to contact the Commission (D-546)", () => {
  for (const typeId of [
    "complaints-management-policy-and-register",
    "incident-management-policy-and-register",
  ])
    it(`${typeId} carries the fixed block with every sourced string, unnumbered, before the register`, () => {
      const { sections } = skeleton("verification-sole-trader", typeId);
      const s = section(sections, "commission-contact");
      expect(s.mode).toBe("fixed");
      expect(s.number).toBe("");
      expect(s.heading).toBe("How to contact the Commission");
      const text = blocksToText(s.blocks);
      for (const str of COMMISSION_CONTACT_STRINGS) expect(text).toContain(str);
      expect(text).toMatch(/Western Australia 7:30 am to 3:30 pm/);
      expect(text).toMatch(/National Relay Service/);
      // The lint recognises its own fixed text, so a tailored section quoting it passes.
      expect(lintContactDetails(text, COMMISSION_CONTACT_STRINGS)).toEqual([]);
      const ids = sections.map((x) => x.id);
      expect(ids.indexOf("commission-contact")).toBeLessThan(
        ids.indexOf("register"),
      );
    });

  it("no other fixed text in the sole-trader set carries a contact string the lint would not allow", () => {
    const c = cases.find((x) => x.id === "verification-sole-trader")!;
    const typeIds = [
      ...c.result.documents.map((d) => d.id),
      "practice-standards-self-assessment",
    ];
    const offenders: string[] = [];
    for (const typeId of typeIds) {
      const { sections } = skeleton("verification-sole-trader", typeId);
      for (const s of sections) {
        if (s.mode !== "fixed") continue;
        for (const f of lintContactDetails(
          blocksToText(s.blocks),
          COMMISSION_CONTACT_STRINGS,
        ))
          offenders.push(`${typeId}/${s.id}: ${f.match}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the complaints and incident procedure briefs refer to the block by its heading and forbid contact strings", () => {
    for (const typeId of [
      "complaints-management-policy-and-register",
      "incident-management-policy-and-register",
    ]) {
      const brief = documentTypeById(typeId)!.extraSections!.find(
        (s) => s.id === "procedure",
      )!.brief;
      expect(brief).toMatch(/"How to contact the Commission" by its heading/);
      expect(brief).toMatch(
        /never write a phone number, an email address or a web address/,
      );
      expect(contactStringsIn(brief)).toEqual([]);
    }
  });
});

describe("Our position on restrictive practices (D-548)", () => {
  it("is fixed text in the safeguarding policy for a provider that uses none", () => {
    const { sections } = skeleton(
      "verification-sole-trader",
      "safeguarding-policy",
    );
    const s = section(sections, "restrictive-practice-position");
    expect(s.mode).toBe("fixed");
    expect(s.number).toBe("");
    const text = blocksToText(s.blocks);
    for (const kind of [
      "seclusion",
      "chemical restraint",
      "mechanical restraint",
      "physical restraint",
      "environmental restraint",
    ])
      expect(text).toContain(kind);
    expect(text).toMatch(/locked door/);
    expect(text).toMatch(/withheld/);
    // Batch 45 item 19: the two windows as the Incident Rules ss 20 and 21 set them.
    expect(text).toMatch(
      /within 5 business days; within 24 hours if the use of a restrictive practice also caused serious injury or is itself abuse or neglect/,
    );
    expect(text).toMatch(/the same day/);
    expect(text).toMatch(/every 12 months/);
    // The steps name only canonical records.
    expect(text).toContain("incident register");
    expect(text).toContain("improvement register");
  });
});

describe("Items to prepare before the audit (D-547)", () => {
  it("is the audit-day list, twelve records in two tiers, each in the audit-day order, the paper records marked", () => {
    const { sections } = skeleton(
      "verification-sole-trader",
      "practice-standards-self-assessment",
    );
    const s = section(sections, "gaps");
    const lists = s.blocks.filter((b) => b.type === "bullets");
    expect(lists).toHaveLength(2);
    const tiers = itemsToPrepareByTier();
    expect(lists[0].type === "bullets" && lists[0].items).toEqual(tiers.named);
    expect(lists[1].type === "bullets" && lists[1].items).toEqual(
      tiers.practice,
    );
    expect(new Set([...tiers.named, ...tiers.practice])).toEqual(
      new Set(itemsToPrepareBeforeAudit()),
    );
    const leads = s.blocks
      .filter((b) => b.type === "paragraph")
      .map((b) => (b.type === "paragraph" ? b.text : ""));
    expect(leads.some((t) => t.startsWith("Records the standards name:"))).toBe(
      true,
    );
    expect(
      leads.some((t) => t.startsWith("Records auditors often ask for:")),
    ).toBe(true);
  });

  it("the records section names registers by their canonical names", () => {
    const c = cases.find((x) => x.id === "verification-sole-trader")!;
    const wrong: string[] = [];
    for (const d of c.result.documents) {
      const { sections } = skeleton("verification-sole-trader", d.id);
      const s = sections.find((x) => x.id === "records-and-evidence");
      if (!s) continue;
      for (const b of s.blocks)
        if (b.type === "bullets")
          for (const item of b.items)
            if (
              canonicalRecordName(item) !== null &&
              !isCanonicalRecordName(item)
            )
              wrong.push(`${d.id}: ${item}`);
    }
    expect(wrong).toEqual([]);
  });
});

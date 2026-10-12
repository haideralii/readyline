import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  CHECKLIST_GROUP_IDS,
  deriveChecklist,
  progressLine,
  type Checklist,
} from "./derive";

const dataset = getStandardsDataset();
const cases = loadReferenceCases();
const byId = Object.fromEntries(
  cases.map((c) => [
    c.id,
    { ...c, checklist: deriveChecklist(c.result, c.answers, dataset) },
  ]),
) as Record<string, (typeof cases)[number] & { checklist: Checklist }>;
const soleTrader = byId["verification-sole-trader"];
const personalCare = byId["certification-personal-care"];
const behaviour = byId["behaviour-support-company"];

function ids(c: Checklist, group: string) {
  return c.items.filter((i) => i.group === group).map((i) => i.id);
}

describe("deriveChecklist (REQ-006 AC-1)", () => {
  it("lists every document and register of each reference case exactly once, in groups", () => {
    for (const c of Object.values(byId)) {
      expect(ids(c.checklist, "documents")).toEqual(
        c.result.documents.map((d) => `documents:${d.id}`),
      );
      expect(ids(c.checklist, "registers")).toEqual(
        c.result.registers.map((r) => `registers:${r.id}`),
      );
      const all = c.checklist.items.map((i) => i.id);
      expect(new Set(all).size).toBe(all.length);
      expect(c.checklist.total).toBe(all.length);
      expect(c.checklist.groups.map((g) => g.id)).toEqual(
        CHECKLIST_GROUP_IDS.filter((g) => ids(c.checklist, g).length > 0),
      );
    }
  });

  it("every item has a sourceRef, a why line and no prohibited claim", () => {
    for (const c of Object.values(byId)) {
      for (const item of c.checklist.items) {
        expect(item.sourceRef.kind, item.id).toBeTruthy();
        if (item.sourceRef.kind !== "content") {
          expect(item.sourceRef.url, item.id).toMatch(/^https:\/\//);
          expect(item.sourceRef.title, item.id).not.toBe("");
        }
        if (item.sourceRef.kind === "standard") {
          expect(
            dataset.standards.some((s) => s.id === item.sourceRef.id),
            item.id,
          ).toBe(true);
        }
        expect(item.why.length, item.id).toBeGreaterThan(20);
        expect(findProhibitedClaims(`${item.title} ${item.why}`)).toEqual([]);
      }
    }
  });

  it("flags as unverified exactly what the Commission text in the dataset does not state", () => {
    for (const c of Object.values(byId)) {
      const unverified = c.checklist.items
        .filter((i) => i.unverified)
        .map((i) => i.id)
        .sort();
      const expected = ["people:worker-screening-clearances"];
      if (
        c.answers.workforce.workerCount > 1 ||
        c.answers.business.structure === "company"
      )
        expected.push("business:insurance-workers-compensation");
      expect(unverified, c.id).toEqual(expected.sort());
    }
  });

  it("People and Business match the case: sole trader has no workers compensation item; the six-worker company does", () => {
    expect(ids(soleTrader.checklist, "business")).toEqual([
      "business:abn",
      "business:insurance-public-liability",
      "business:insurance-professional-indemnity",
      "business:insurance-personal-accident",
    ]);
    expect(ids(personalCare.checklist, "business")).toContain(
      "business:insurance-workers-compensation",
    );
    const orientation = personalCare.checklist.items.find(
      (i) => i.id === "people:worker-orientation-module",
    )!;
    expect(orientation.count).toBe(6);
    expect(orientation.title).toContain("6 workers");
    expect(orientation.sourceRef).toMatchObject({
      kind: "standard",
      id: "core.governance.human-resource-management",
      indicator: 3,
    });
    const soleOrientation = soleTrader.checklist.items.find(
      (i) => i.id === "people:worker-orientation-module",
    )!;
    expect(soleOrientation.sourceRef).toMatchObject({
      kind: "standard",
      id: "verification.human-resource-management",
      indicator: 2,
    });
    expect(soleOrientation.title).toContain("1 worker");
  });

  it("pre-fills from the answers: ABN, insurance certificate, screening and the already-have registers (FR-2)", () => {
    const status = (c: Checklist, id: string) =>
      c.items.find((i) => i.id === id)?.initialStatus;
    // Sole trader: no ABN, has insurance, screened, no registers.
    expect(status(soleTrader.checklist, "business:abn")).toBe("need");
    expect(
      status(soleTrader.checklist, "business:insurance-public-liability"),
    ).toBe("have");
    expect(
      status(soleTrader.checklist, "people:worker-screening-clearances"),
    ).toBe("have");
    expect(status(soleTrader.checklist, "registers:incidents")).toBe("need");
    // Personal care company: ABN given, incident register yes, complaints no, screening not sure.
    expect(status(personalCare.checklist, "business:abn")).toBe("have");
    expect(status(personalCare.checklist, "registers:incidents")).toBe("have");
    expect(status(personalCare.checklist, "registers:complaints")).toBe("need");
    expect(
      status(personalCare.checklist, "people:worker-screening-clearances"),
    ).toBe("need");
    expect(
      status(
        personalCare.checklist,
        "documents:incident-management-policy-and-register",
      ),
    ).toBe("have");
  });

  it("audit items follow the pathway (FR-6): verification is desktop only; certification adds interviews and the mid-term date", () => {
    expect(ids(soleTrader.checklist, "audit")).toEqual([
      "audit:choose-auditor",
      "audit:book-audit",
    ]);
    expect(
      soleTrader.checklist.items.find((i) => i.id === "audit:book-audit")!
        .title,
    ).toMatch(/desktop review/);
    expect(ids(personalCare.checklist, "audit")).toEqual([
      "audit:choose-auditor",
      "audit:book-audit",
      "audit:participant-interview-consent",
      "audit:worker-interview-availability",
      "audit:mid-term-audit-date",
    ]);
    const midTerm = personalCare.checklist.items.find(
      (i) => i.id === "audit:mid-term-audit-date",
    )!;
    expect(midTerm.title).toContain("18 months");
    expect(midTerm.sourceRef).toMatchObject({
      kind: "rule",
      id: "midTermAudit",
    });
    expect(ids(behaviour.checklist, "registers")).toContain(
      "registers:restrictive-practices",
    );
  });

  it("cites registers to the standard whose evidence names them, in the module in scope", () => {
    const incidents = (c: Checklist) =>
      c.items.find((i) => i.id === "registers:incidents")!.sourceRef;
    expect(incidents(soleTrader.checklist)).toMatchObject({
      kind: "standard",
      id: "verification.incident-management",
    });
    expect(incidents(personalCare.checklist)).toMatchObject({
      kind: "standard",
      id: "core.governance.incident-management",
    });
    const restrictive = behaviour.checklist.items.find(
      (i) => i.id === "registers:restrictive-practices",
    )!;
    expect(restrictive.sourceRef).toMatchObject({
      kind: "standard",
      id: "ibsp.monitoring-and-reporting-the-use-of-regulated-restrictive-practices",
    });
  });

  it("writes the progress line", () => {
    expect(progressLine(14, 31)).toBe("14 of 31 items ready");
    expect(progressLine(0, 1)).toBe("0 of 1 item ready");
  });
});

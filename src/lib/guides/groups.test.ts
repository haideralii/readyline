// @vitest-environment node
/**
 * REQ-011 batch 31: all 38 registration-group pages build from the data,
 * agree with the dataset's audit type, carry four FAQ entries, link to
 * Commission sources, sit under an everyday heading with the questionnaire's
 * synonyms, and pass the plain-language rules on every generated string.
 */
import { describe, expect, it } from "vitest";
import { lintText } from "@/lib/copy-lint/rules";
import { findProhibitedClaims } from "@/lib/claims";
import { getStandardsDataset } from "@/lib/standards/dataset";
import {
  buildGroupPages,
  findGroupPage,
  groupPageSlug,
  groupPagesByCategory,
} from "./groups";

const dataset = getStandardsDataset();
const pages = buildGroupPages(dataset);

describe("registration-group pages (REQ-011 batch 31, D-1105)", () => {
  it("builds every group once with a unique slug", () => {
    expect(pages).toHaveLength(38);
    expect(new Set(pages.map((p) => p.slug)).size).toBe(38);
    expect(pages.map((p) => p.code)).toEqual(
      [...dataset.registrationGroups.map((g) => g.code)].sort(),
    );
    expect(groupPageSlug("Assistance with daily personal activities")).toBe(
      "assistance-with-daily-personal-activities",
    );
    expect(findGroupPage(dataset, "household-tasks")?.code).toBe("0120");
    expect(findGroupPage(dataset, "nope")).toBeNull();
  });

  it("the audit type comes from the rules and agrees with the dataset's table", () => {
    for (const p of pages) {
      const g = dataset.registrationGroups.find((x) => x.code === p.code)!;
      expect(p.pathway, p.code).toBe(g.auditType);
      expect(p.pathwayRule.source.url, p.code).toMatch(/^https:\/\//);
      expect(p.modules.length, p.code).toBeGreaterThan(0);
      expect(p.documents.length, p.code).toBeGreaterThan(10);
      expect(p.registers.length, p.code).toBeGreaterThan(0);
      expect(p.faq, p.code).toHaveLength(4);
      expect(p.sources.length, p.code).toBeGreaterThan(0);
      expect(
        p.sources.some((s) => /ndiscommission\.gov\.au/.test(s.url)),
        p.code,
      ).toBe(true);
      expect(p.description.length, p.code).toBeGreaterThan(20);
    }
  });

  it("the special cases come out of the rules, not the template", () => {
    const sil = pages.find((p) => p.code === "0138")!;
    expect(sil.modules.map((m) => m.id)).toEqual(["core", "sil"]);
    expect(sil.mandatoryFrom).toBe("2026-07-01");
    expect(sil.faq[3].answer).toMatch(/mandatory since 1 July 2026/);
    const sda = pages.find((p) => p.code === "0131")!;
    expect(sda.modules.map((m) => m.id)).toEqual(["sda"]);
    expect(sda.notes.some((n) => /without the core module/.test(n.text))).toBe(
      true,
    );
    const ec = pages.find((p) => p.code === "0118")!;
    expect(ec.notes.some((n) => /modified certification/.test(n.text))).toBe(
      true,
    );
    const household = pages.find((p) => p.code === "0120")!;
    expect(household.pathway).toBe("verification");
    expect(household.midTermAudit.applies).toBe(false);
    expect(household.faq[3].answer).toMatch(/Not yet/);
  });

  it("every group sits under an everyday heading with the questionnaire's synonyms", () => {
    const byCategory = groupPagesByCategory(pages);
    const placed = byCategory.flatMap((c) => c.pages.map((p) => p.code));
    expect(placed.sort()).toEqual(pages.map((p) => p.code));
    expect(byCategory.map((c) => c.id)).toContain("personal-care");
    expect(pages.find((p) => p.code === "0120")!.synonyms).toContain(
      "cleaning",
    );
  });

  it("every generated string passes the plain-language rules and the claims lint", () => {
    const findings: string[] = [];
    for (const p of pages) {
      const strings = [
        p.description,
        p.pathwayDescription,
        p.pathwayRule.text,
        ...p.modules.map((m) => m.description),
        ...p.notes.map((n) => n.text),
        ...p.faq.flatMap((f) => [f.question, f.answer]),
      ];
      for (const s of strings) {
        for (const v of lintText(s, { block: true }))
          findings.push(`${p.code}: ${v.rule}: ${v.detail}`);
        for (const c of findProhibitedClaims(s))
          findings.push(`${p.code}: claim ${JSON.stringify(c)}`);
      }
    }
    expect(findings).toEqual([]);
  });
});

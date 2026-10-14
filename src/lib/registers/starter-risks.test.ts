// @vitest-environment node
/**
 * The corporate risk register's starter rows (REQ-018 FR-1, AC-1; D-1903):
 * nine rows, one per area, every field filled, in plain words that pass
 * the copy lint, drawn from the answers (states, structure, worker count,
 * pathway, restrictive practices), with a review date six months out.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import { loadReferenceCases } from "@/lib/generator/reference-cases";
import { RISK_AREAS } from "./audit-day-types";
import { STARTER_REVIEW_MONTHS, starterCorporateRisks } from "./starter-risks";

const cases = loadReferenceCases();
const TODAY = "2026-10-14";

describe("starter corporate risks (REQ-018 FR-1)", () => {
  it("gives every reference case nine rows, one per area, with no empty field and a review date six months out", () => {
    for (const c of cases) {
      const rows = starterCorporateRisks(c.answers, c.result, TODAY);
      expect(rows.map((r) => r.area)).toEqual([...RISK_AREAS]);
      for (const r of rows) {
        expect(r.what_could_happen.length, `${c.id} ${r.area}`).toBeGreaterThan(
          20,
        );
        expect(r.what_could_happen.length).toBeLessThanOrEqual(500);
        expect(r.controls.length, `${c.id} ${r.area}`).toBeGreaterThan(20);
        expect(r.controls.length).toBeLessThanOrEqual(2000);
        expect(["low", "medium", "high"]).toContain(r.likelihood);
        expect(r.owner_role.length).toBeGreaterThan(0);
        expect(r.starter).toBe(true);
        expect(r.review_on).toBe(
          STARTER_REVIEW_MONTHS === 6 ? "2027-04-14" : r.review_on,
        );
      }
    }
  });

  it("every sentence passes the copy lint and the claims lint", () => {
    for (const c of cases)
      for (const r of starterCorporateRisks(c.answers, c.result, TODAY))
        for (const text of [r.what_could_happen, r.controls]) {
          expect(lintText(text, { block: true }), `${c.id} ${r.area}`).toEqual(
            [],
          );
          expect(findProhibitedClaims(text), `${c.id} ${r.area}`).toEqual([]);
        }
  });

  it("the rows follow the answers: states, worker count, structure, pathway and restrictive practices", () => {
    const sole = cases.find((c) => c.id === "verification-sole-trader")!;
    const company = cases.find((c) => c.id === "certification-personal-care")!;
    const behaviour = cases.find((c) => c.id === "behaviour-support-company")!;
    const s = starterCorporateRisks(sole.answers, sole.result, TODAY);
    const p = starterCorporateRisks(company.answers, company.result, TODAY);
    const b = starterCorporateRisks(behaviour.answers, behaviour.result, TODAY);
    const by = (rows: typeof s, area: string) =>
      rows.find((r) => r.area === area)!;
    expect(by(s, "emergency-and-disaster").what_could_happen).toContain(
      "New South Wales",
    );
    expect(by(s, "people-and-staffing").what_could_happen).toMatch(
      /^I am sick or away/,
    );
    expect(by(s, "people-and-staffing").likelihood).toBe("high");
    expect(by(s, "organisational-sustainability").what_could_happen).toContain(
      "sole trader with one worker",
    );
    expect(by(p, "people-and-staffing").what_could_happen).toMatch(
      /A worker leaves or is away/,
    );
    expect(by(p, "organisational-sustainability").what_could_happen).toMatch(
      /company with \d+ workers/,
    );
    expect(by(p, "legislation-change").what_could_happen).toContain(
      "mid-term audit",
    );
    expect(by(s, "legislation-change").what_could_happen).not.toContain(
      "mid-term audit",
    );
    expect(by(b, "compliance").what_could_happen).toContain(
      "restrictive practice",
    );
    expect(by(s, "compliance").what_could_happen).not.toContain(
      "restrictive practice",
    );
    // Deterministic: the same answers give the same rows.
    expect(starterCorporateRisks(sole.answers, sole.result, TODAY)).toEqual(s);
  });
});

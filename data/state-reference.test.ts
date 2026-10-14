/**
 * The state reference data (NDIS watch 13 October 2026, item A1; batch 35,
 * D-1801): every state and territory the questionnaire offers has every
 * field, every fact carries a source URL, a read date and a status, and an
 * unverified fact says who to confirm it with. The generator's STATE FACTS
 * block is built from this file and nothing else.
 */
import { describe, expect, it } from "vitest";
import { State } from "@/lib/questionnaire/schema";
import {
  STATE_FACT_FIELDS,
  STATE_REFERENCE,
  stateFactsFor,
} from "@/lib/generator/state-facts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("data/state-reference.json (A1)", () => {
  it("covers every state in the questionnaire with every field, each with a source and a date", () => {
    expect(Object.keys(STATE_REFERENCE.states).sort()).toEqual(
      [...State.options].sort(),
    );
    expect(STATE_REFERENCE.readAt).toMatch(DATE);
    for (const [code, s] of Object.entries(STATE_REFERENCE.states)) {
      expect(s.name, code).toMatch(/^[A-Z]/);
      for (const field of STATE_FACT_FIELDS) {
        const f = s[field];
        expect(f, `${code}.${field}`).toBeDefined();
        expect(f.text.trim().length, `${code}.${field}`).toBeGreaterThan(20);
        expect(f.source.url, `${code}.${field}`).toMatch(/^https:\/\//);
        expect(f.source.title.length, `${code}.${field}`).toBeGreaterThan(5);
        expect(f.source.readAt, `${code}.${field}`).toMatch(DATE);
        expect(["verified", "unverified"], `${code}.${field}`).toContain(
          f.status,
        );
      }
    }
    for (const n of Object.values(STATE_REFERENCE.national)) {
      expect(n.source.url).toMatch(/^https:\/\//);
      expect(n.source.readAt).toMatch(DATE);
    }
  });

  it("the facts named in the watch report are present as worded", () => {
    const s = STATE_REFERENCE.states;
    expect(s.TAS.restrictivePractice.text).toMatch(
      /Disability Rights, Inclusion and Safeguarding Act 2024/,
    );
    expect(s.TAS.restrictivePractice.text).toMatch(/replaced TASCAT/);
    expect(s.NT.restrictivePractice.text).toMatch(
      /NDIS \(Authorisations\) Act 2019/,
    );
    expect(s.VIC.childrenCheck.text).toMatch(
      /19 October 2026.*WWC Child Safety Training/,
    );
    for (const code of ["QLD", "ACT", "TAS"] as const)
      expect(s[code].workerScreening.text).toMatch(
        /Record the NDIS clearance number and expiry separately/,
      );
  });

  it("stateFactsFor renders the provider's states only, by full name, with the source and status on every line", () => {
    const lines = stateFactsFor(["New South Wales", "Tasmania"]);
    expect(lines.map((l) => l.code)).toEqual(["NSW", "TAS"]);
    const text = lines.map((l) => l.lines.join("\n")).join("\n");
    expect(text).toContain("Tasmania (TAS)");
    expect(text).not.toContain("Victoria");
    expect(text).toMatch(/read 2026-10-13/);
    expect(text).toMatch(/unverified/);
    expect(text).toMatch(
      /Senior Practitioner in the Department of Premier and Cabinet/,
    );
    // An unknown name renders nothing rather than guessing.
    expect(stateFactsFor(["Narnia"])).toEqual([]);
  });
});

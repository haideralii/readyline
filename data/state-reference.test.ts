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
import { STATE_FILE } from "@/lib/registers/state-facts";

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

  it("REQ-024 FR-2a: every state carries the screening unit's pending-work, s 14A and combined-scheme reads with a source and a date, the children's check its term, and the national block its Part 4 section and end date per state", () => {
    for (const [code, s] of Object.entries(STATE_FILE.states)) {
      const ws = s.workerScreening;
      for (const [field, f] of [
        ["pendingWorkAllowed", ws.pendingWorkAllowed],
        ["applicationProhibitsPending", ws.applicationProhibitsPending],
        ["combinedScheme", ws.combinedScheme],
      ] as const) {
        expect(f, `${code}.${field}`).toBeDefined();
        expect(f!.text.trim().length, `${code}.${field}`).toBeGreaterThan(20);
        expect(f!.source.url, `${code}.${field}`).toMatch(/^https:\/\//);
        expect(f!.source.readAt, `${code}.${field}`).toMatch(DATE);
        expect(["verified", "unverified"], `${code}.${field}`).toContain(
          f!.status,
        );
      }
      expect(ws.verificationWindow, `${code}.verificationWindow`).toBeNull();
      expect(typeof s.childrenCheck.termYears, `${code}.termYears`).toBe(
        "number",
      );
    }
    // The reads of 16 Oct 2026 (REQ-024 third pass, finding 73): Victoria and Queensland prohibit pending work; WA and the NT allow it; SA, TAS and the ACT are unverified and ship no line.
    const st = STATE_FILE.states;
    expect(st.VIC.workerScreening.applicationProhibitsPending!.prohibits).toBe(
      true,
    );
    expect(st.QLD.workerScreening.applicationProhibitsPending!.prohibits).toBe(
      true,
    );
    expect(st.WA.workerScreening.pendingWorkAllowed!.allowed).toBe(true);
    expect(st.NT.workerScreening.pendingWorkAllowed!.allowed).toBe(true);
    for (const code of ["SA", "TAS", "ACT"] as const)
      expect(st[code].workerScreening.pendingWorkAllowed!.status).toBe(
        "unverified",
      );
    // TAS and the ACT one registration; QLD one application; the rest separate (W-2, finding 46).
    expect(st.TAS.workerScreening.combinedScheme!.scheme).toBe(
      "one-registration",
    );
    expect(st.ACT.workerScreening.combinedScheme!.scheme).toBe(
      "one-registration",
    );
    expect(st.QLD.workerScreening.combinedScheme!.scheme).toBe(
      "one-application",
    );
    expect(st.NSW.workerScreening.combinedScheme!.scheme).toBe("separate");
    // W-2's terms (finding 74): WA three years, the NT's Ochre Card two.
    expect(st.WA.childrenCheck.termYears).toBe(3);
    expect(st.NT.childrenCheck.termYears).toBe(2);
    // D-2426 as amended: the national block's Part 4 line per state, every arrangement ended by its own date.
    const block = STATE_FILE.national.acceptableChecks!;
    expect(block.source.readAt).toBe("2026-10-15");
    expect(Object.keys(block.byState).sort()).toEqual(
      Object.keys(STATE_FILE.states).sort(),
    );
    for (const [code, line] of Object.entries(block.byState)) {
      expect(line.section, code).toMatch(/^\d+[A-Z]?\(\d+[A-Z]?\)$/);
      expect(line.endedOn, code).toMatch(DATE);
      expect(line.endedOn <= "2026-01-31", code).toBe(true);
    }
    expect(block.byState.NSW).toEqual({
      section: "23(7)",
      endedOn: "2026-01-31",
    });
    expect(block.byState.SA).toEqual({
      section: "24(6B)",
      endedOn: "2026-01-31",
    });
    expect(block.byState.WA).toEqual({
      section: "29A(5)",
      endedOn: "2023-01-31",
    });
    expect(block.byState.NT.endedOn).toBe("2021-06-30");
    // D-2439 as amended (finding 238): the per-state latest day for the (1)(b) help text; QLD and VIC unverified, so absent.
    expect(STATE_FILE.part4Ends!.byState).toEqual({
      NSW: "2026-01-31",
      SA: "2026-01-31",
      WA: "2023-01-31",
      TAS: "2024-01-31",
      ACT: "2024-01-31",
      NT: "2023-06-30",
    });
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

// @vitest-environment node
/**
 * The quarterly self-check's rules (REQ-020 FR-9, AC-7): one question per
 * record on the audit-day list with the hazard register after the
 * delegations, in plain words; the next walk three months after the last
 * with month ends handled; every "no" an improvement row with the source
 * `self-check`, the note kept, and a due date 30 days out; the closing
 * line with the count and the next date.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import { ASK_COUNT } from "./audit-day-ask";
import { AUDIT_DAY_RECORDS } from "./names";
import {
  SELF_CHECK_FINDING_DAYS,
  SELF_CHECK_QUESTIONS,
  addDaysIso,
  addMonthsIso,
  findingsFrom,
  nextSelfCheckOn,
  selfCheckOffer,
  selfCheckRecordIds,
  walkSummary,
} from "./self-check";

describe("the questions", () => {
  it("one per record on the audit-day list, in its order, every word plain", () => {
    const ids = selfCheckRecordIds();
    expect(ids).toHaveLength(ASK_COUNT);
    expect(ids).toEqual(AUDIT_DAY_RECORDS.map((r) => r.id));
    expect(ids[ids.indexOf("delegations") + 1]).toBe("hazards");
    for (const id of ids) {
      const q = SELF_CHECK_QUESTIONS[id];
      expect(q, id).toMatch(/\?$/);
      // D-2219: under 30 words each (PO, 15 Oct 2026).
      expect(q.split(/\s+/).length, `${id}: ${q}`).toBeLessThan(30);
      expect(lintText(q, { block: true }), `${id}: ${q}`).toEqual([]);
      expect(findProhibitedClaims(q), id).toEqual([]);
    }
  });
});

describe("the dates", () => {
  it("adds months with month ends clamped and days plainly", () => {
    expect(addMonthsIso("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2026-10-15", 3)).toBe("2027-01-15");
    expect(addDaysIso("2026-12-25", 30)).toBe("2027-01-24");
  });

  it("the next walk is three months after the last, or today when there has never been one", () => {
    expect(nextSelfCheckOn(null, "2026-10-15")).toBe("2026-10-15");
    expect(nextSelfCheckOn("2026-10-15", "2026-10-15")).toBe("2027-01-15");
  });

  it("the audit-day offer: never walked, due, and not yet, always with the open findings (AC-7)", () => {
    expect(
      selfCheckOffer({
        lastWalkedOn: null,
        lastFindings: 0,
        openFindings: 0,
        today: "2026-10-15",
      }),
    ).toEqual({
      due: true,
      line: "You have not checked your systems yet. It takes about ten minutes.",
    });
    const sameDay = selfCheckOffer({
      lastWalkedOn: "2026-10-15",
      lastFindings: 2,
      openFindings: 2,
      today: "2026-10-15",
    });
    expect(SELF_CHECK_QUESTIONS["document-control"]).toBe(
      "Is every policy in the document control register adopted, dated and not past its review date?",
    );
    expect(SELF_CHECK_QUESTIONS["participant-risks"]).toMatch(/up to date\?$/);
    expect(SELF_CHECK_QUESTIONS.improvements).toMatch(
      /get an improvement row\?$/,
    );
    expect(sameDay.due).toBe(false);
    expect(sameDay.line).toBe(
      "Last checked 2026-10-15, 2 findings still open. Next due 2027-01-15.",
    );
    const overdue = selfCheckOffer({
      lastWalkedOn: "2026-06-01",
      lastFindings: 1,
      openFindings: 0,
      today: "2026-10-15",
    });
    expect(overdue).toEqual({
      due: true,
      line: "Last checked 2026-06-01, nothing open from it. The next check is due.",
    });
    const one = selfCheckOffer({
      lastWalkedOn: "2026-10-01",
      lastFindings: 1,
      openFindings: 1,
      today: "2026-10-15",
    });
    expect(one.line).toMatch(/1 finding still open/);
    for (const o of [sameDay, overdue, one])
      expect(lintText(o.line, { block: true }), o.line).toEqual([]);
  });
});

describe("the findings (FR-9, AC-7)", () => {
  it("two no answers make two improvement rows with the self-check source, the note kept and a due date 30 days out", () => {
    const rows = findingsFrom(
      {
        incidents: { answer: "no", note: "Two from September are on paper." },
        hazards: { answer: "no", note: "" },
        decisions: { answer: "yes", note: "" },
      },
      "2026-10-15",
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.source_kind)).toEqual([
      "self-check",
      "self-check",
    ]);
    expect(rows.every((r) => r.due_on === "2026-11-14")).toBe(true);
    expect(rows.every((r) => r.source_ref === "Check 2026-10-15")).toBe(true);
    expect(rows.every((r) => r.owner_role === "Owner")).toBe(true);
    // In the walk's order: the hazard register before the incidents.
    expect(rows[0].learned).toBe(
      "Hazard register: the self-check answer was no.",
    );
    expect(rows[1].learned).toBe(
      "Incident register: the self-check answer was no. Two from September are on paper.",
    );
    for (const r of rows)
      for (const t of [r.learned, r.changed])
        expect(lintText(t, { block: true }), t).toEqual([]);
    expect(SELF_CHECK_FINDING_DAYS).toBe(30);
  });

  it("all yes makes nothing; an unanswered record is not a finding", () => {
    expect(
      findingsFrom({ incidents: { answer: "yes", note: "" } }, "2026-10-15"),
    ).toEqual([]);
    expect(findingsFrom({}, "2026-10-15")).toEqual([]);
  });

  it("the closing line counts the findings and names the next date", () => {
    expect(walkSummary(0, "2026-10-15")).toBe(
      "No findings. The next check is due 2027-01-15.",
    );
    expect(walkSummary(1, "2026-10-15")).toBe(
      "1 finding is in your improvement register, due in 30 days. The next check is due 2027-01-15.",
    );
    expect(walkSummary(2, "2026-10-15")).toMatch(/^2 findings are/);
  });
});

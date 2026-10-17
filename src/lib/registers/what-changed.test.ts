import { describe, expect, it } from "vitest";
import type { Period } from "./period";
import {
  THIS_PERIOD_TITLE,
  WHAT_CHANGED_COLUMNS,
  WHAT_CHANGED_TITLE,
  changesSummaryLine,
  whatChanged,
  whatChangedFileName,
  whatChangedRows,
  whatChangedWhy,
  workerSummaryLine,
  type WhatChangedInput,
} from "./what-changed";

/**
 * REQ-023 Session B, FR-6 and AC-4: three documents reviewed in the period and
 * one due before the period ends, one incident on each side of the last-audit
 * date, one worker check added in the period; the screen's object and the
 * pack's rows read the same counts, dates and codes.
 */
const since: Period = {
  kind: "since-last-audit",
  from: "2027-03-01",
  to: null,
};

const titleOf = (typeId: string, title: string) =>
  typeId === "other" ? title : `Title of ${typeId}`;

const fixture: WhatChangedInput = {
  period: since,
  periodStartsOn: "2026-03-01",
  periodEndsOn: "2029-03-01",
  lastAuditOn: "2027-03-01",
  today: "2027-06-15",
  incidents: [
    {
      status: "closed",
      notification_status: "closed",
      occurred_on: "2027-02-10",
      reportable_notified_on: null,
    },
    {
      status: "open",
      notification_status: "notified",
      occurred_on: "2027-04-02",
      reportable_notified_on: "2027-04-03",
    },
  ],
  complaints: [
    { status: "resolved", received_on: "2026-12-01" },
    { status: "received", received_on: "2027-05-01" },
    { status: "escalated-to-commission", received_on: "2027-05-20" },
  ],
  checks: [
    {
      worker_ref: "W-1",
      clearance_kind: "ndis-worker-screening",
      issued_on: "2027-04-10",
      expires_on: "2032-04-10",
    },
    // Before the period: not counted as added.
    {
      worker_ref: "W-2",
      clearance_kind: "first-aid",
      issued_on: "2026-09-01",
      expires_on: "2029-09-01",
    },
    // A pending application has no date and is nothing here.
    {
      worker_ref: "W-3",
      clearance_kind: "ndis-worker-screening",
      issued_on: null,
      expires_on: null,
    },
  ],
  reviews: [
    {
      document_type_id: "a",
      title: "",
      adopted_on: "2026-05-01",
      last_reviewed_on: "2027-03-15",
      next_review_on: "2028-03-15",
    },
    {
      document_type_id: "b",
      title: "",
      adopted_on: "2026-05-01",
      last_reviewed_on: "2027-04-01",
      next_review_on: "2030-04-01",
    },
    {
      document_type_id: "other",
      title: "Fire plan",
      adopted_on: "2026-05-01",
      last_reviewed_on: "2027-06-01",
      next_review_on: "2030-06-01",
    },
    // Not adopted: no dates, in no list.
    {
      document_type_id: "d",
      title: "",
      adopted_on: null,
      last_reviewed_on: null,
      next_review_on: null,
    },
    // Reviewed before the period: not listed, and its next review is after the period ends.
    {
      document_type_id: "e",
      title: "",
      adopted_on: "2026-04-01",
      last_reviewed_on: "2026-04-01",
      next_review_on: "2029-04-01",
    },
  ],
  titleOf,
};

describe("whatChanged (REQ-023 FR-6, AC-4)", () => {
  const w = whatChanged(fixture);

  it("counts the incident after the last-audit date alone, with its states", () => {
    const incidents = w.registers.find((r) => r.id === "incidents")!;
    expect(incidents).toMatchObject({
      entries: 1,
      open: 1,
      overdue: 0,
      notified: 1,
      href: "/registers/incidents?period=since-last-audit",
    });
  });

  it("counts the complaints in the period, open and escalated, with no overdue state", () => {
    const complaints = w.registers.find((r) => r.id === "complaints")!;
    expect(complaints).toMatchObject({
      entries: 2,
      open: 2,
      overdue: null,
      notified: 1,
    });
  });

  it("lists the three documents reviewed in the period with their dates, oldest first", () => {
    expect(w.documents.map((d) => [d.title, d.event, d.date])).toEqual([
      ["Title of a", "reviewed", "2027-03-15"],
      ["Title of b", "reviewed", "2027-04-01"],
      ["Fire plan", "reviewed", "2027-06-01"],
    ]);
    expect(w.documents[0].href).toBe(
      "/registers/policy-reviews?period=since-last-audit",
    );
  });

  it("lists the one document due for review before the registration period ends", () => {
    expect(w.due.map((d) => [d.title, d.nextReviewOn])).toEqual([
      ["Title of a", "2028-03-15"],
    ]);
  });

  it("lists the worker check added in the period by code, and counts it", () => {
    expect(w.workers).toEqual([
      {
        code: "W-1",
        kind: "ndis-worker-screening",
        event: "added",
        date: "2027-04-10",
        href: "/registers/worker-checks?period=since-last-audit",
      },
    ]);
    expect(w.workerCounts).toEqual({ added: 1, renewed: 0, expired: 0 });
    expect(workerSummaryLine(w)).toBe("Checks 1 added (W-1).");
    expect(w.registers.find((r) => r.id === "worker-checks")).toMatchObject({
      entries: 1,
      overdue: 0,
    });
  });

  it("reads a second check for the same worker and kind as a renewal, and an expiry in the period as expired", () => {
    const again = whatChanged({
      ...fixture,
      checks: [
        ...fixture.checks,
        {
          worker_ref: "W-2",
          clearance_kind: "first-aid",
          issued_on: "2027-05-05",
          expires_on: "2030-05-05",
        },
        {
          worker_ref: "W-4",
          clearance_kind: "working-with-children",
          issued_on: "2022-04-01",
          expires_on: "2027-04-01",
        },
      ],
    });
    expect(again.workers.map((x) => [x.code, x.event, x.date])).toEqual([
      ["W-4", "expired", "2027-04-01"],
      ["W-1", "added", "2027-04-10"],
      ["W-2", "renewed", "2027-05-05"],
    ]);
    expect(workerSummaryLine(again)).toBe(
      "Checks 1 added (W-1); 1 renewed (W-2); 1 expired (W-4).",
    );
  });

  it("is titled for the last audit, and for the whole period with the reason when there is no last-audit date", () => {
    expect(w.title).toBe(WHAT_CHANGED_TITLE);
    expect(w.why).toBeNull();
    const whole = whatChanged({
      ...fixture,
      lastAuditOn: null,
      period: { kind: "period", from: "2026-03-01", to: null },
    });
    expect(whole.title).toBe(THIS_PERIOD_TITLE);
    expect(whole.why).toBe(whatChangedWhy("2026-03-01"));
    expect(whole.why).toContain("from 1 March 2026");
    // The whole period takes in the earlier incident and the earlier review.
    expect(whole.registers.find((r) => r.id === "incidents")!.entries).toBe(2);
    expect(whole.documents).toHaveLength(4);
    expect(whatChangedFileName(true)).toBe("since-last-audit.csv");
    expect(whatChangedFileName(false)).toBe("this-registration-period.csv");
  });

  it("writes the pack's rows from the same object, one flat sheet", () => {
    const rows = whatChangedRows(w);
    expect(WHAT_CHANGED_COLUMNS).toEqual(["section", "item", "detail", "date"]);
    expect(rows).toContainEqual({
      section: "registers",
      item: "Incident register",
      detail: "entries 1; open 1; overdue 0; notified 1",
      date: "",
    });
    expect(rows).toContainEqual({
      section: "registers",
      item: "Complaints register",
      detail: "entries 2; open 2; overdue n/a; notified 1",
      date: "",
    });
    expect(rows).toContainEqual({
      section: "documents",
      item: "Fire plan",
      detail: "reviewed in the period; next review 2030-06-01",
      date: "2027-06-01",
    });
    expect(rows).toContainEqual({
      section: "documents-due",
      item: "Title of a",
      detail: "due for review before the registration period ends",
      date: "2028-03-15",
    });
    expect(rows).toContainEqual({
      section: "workers",
      item: "W-1",
      detail: "ndis-worker-screening added",
      date: "2027-04-10",
    });
    expect(rows.filter((r) => r.section === "documents")).toHaveLength(3);
    expect(JSON.stringify(rows)).not.toMatch(/W-3|Title of d|Title of e/);
  });

  // REQ-023 Session D (FR-6's last line, FR-10): the changes notified and the variations applied for in the period.
  it("counts the changes notified and the variations applied for in the period, with the register's link and the sheet's row", () => {
    const withChanges = whatChanged({
      ...fixture,
      changes: [
        { kind: "notification", notified_on: "2027-04-20", applied_on: null },
        { kind: "notification", notified_on: "2027-01-10", applied_on: null },
        { kind: "notification", notified_on: null, applied_on: null },
        { kind: "variation", notified_on: null, applied_on: "2027-05-02" },
        { kind: "variation", notified_on: null, applied_on: null },
      ],
    });
    expect(withChanges.changes).toEqual({
      notified: 1,
      applied: 1,
      href: "/registers/commission-changes",
    });
    expect(changesSummaryLine(withChanges)).toBe(
      "1 change notified to the Commission; 1 variation applied for.",
    );
    expect(whatChangedRows(withChanges)).toContainEqual({
      section: "commission-changes",
      item: "Changes we told the Commission",
      detail: "notified 1; variations applied for 1",
      date: "",
    });
    // Without the register's rows the line reads zero, never absent.
    expect(changesSummaryLine(w)).toBe(
      "0 changes notified to the Commission; 0 variations applied for.",
    );
  });
});

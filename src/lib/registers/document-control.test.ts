// @vitest-environment node
/**
 * The document control register (REQ-018 FR-13, FR-14, AC-5; D-1906): a
 * newly adopted pack gives a complete row per document with a next review
 * twelve months from adoption and the adopter's role; re-adopting one
 * document updates only its row; a circulation counts only when it is on
 * or after the current version's day; the gaps and the sentence read
 * right.
 */
import { describe, expect, it } from "vitest";
import {
  documentControlGaps,
  documentControlRows,
  documentControlSentence,
} from "./document-control";

const TODAY = "2026-10-14";
const docs = [
  {
    document_type_id: "governance-policy",
    title: "Governance policy",
    version: 2,
    created_at: "2026-10-10T03:00:00Z",
  },
  {
    document_type_id: "complaints-management-policy-and-register",
    title: "Complaints management policy and register",
    version: 1,
    created_at: "2026-10-09T03:00:00Z",
  },
];

describe("document control register (REQ-018 FR-13)", () => {
  it("a newly adopted pack has no empty cell and a next review 12 months after adoption (AC-5)", () => {
    const rows = documentControlRows(
      {
        documents: docs,
        reviews: docs.map((d) => ({
          document_type_id: d.document_type_id,
          adopted_on: "2026-10-12",
          review_cycle_months: 12,
          last_reviewed_on: null,
          next_review_on: null,
        })),
        circulations: docs.map((d) => ({
          document_type_id: d.document_type_id,
          circulated_on: "2026-10-12",
          worker_refs: "W-1 W-2",
        })),
        adoptedByRole: "Owner",
      },
      TODAY,
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.adopted_on).toBe("2026-10-12");
      expect(r.adopted_by).toBe("Owner");
      expect(r.next_review_on).toBe("2027-10-12");
      expect(r.circulated).toEqual({ on: "2026-10-12", workers: 2 });
      expect(r.state).toBe("adopted");
    }
    expect(documentControlGaps(rows)).toEqual([]);
    expect(documentControlSentence(rows)).toBe(
      "2 of 2 adopted, 2 circulated to workers.",
    );
  });

  it("re-adopting one document updates only its row; the database's own next review date wins when present", () => {
    const rows = documentControlRows(
      {
        documents: docs,
        reviews: [
          {
            document_type_id: "governance-policy",
            adopted_on: "2026-10-12",
            review_cycle_months: 12,
            last_reviewed_on: "2026-10-13",
            next_review_on: "2027-10-13",
          },
          {
            document_type_id: "complaints-management-policy-and-register",
            adopted_on: "2026-10-12",
            review_cycle_months: 3,
            last_reviewed_on: null,
            next_review_on: null,
          },
        ],
        circulations: [],
        adoptedByRole: null,
      },
      TODAY,
    );
    expect(rows[0].next_review_on).toBe("2027-10-13");
    expect(rows[1].next_review_on).toBe("2027-01-12");
    expect(rows[0].adopted_by).toBe("Owner");
    expect(documentControlGaps(rows)).toEqual([
      "Governance policy: not circulated to workers",
      "Complaints management policy and register: not circulated to workers",
    ]);
  });

  it("a document that is not adopted has an empty adopted cell, no review date and the not-adopted state; an overdue review is flagged", () => {
    const rows = documentControlRows(
      {
        documents: docs,
        reviews: [
          {
            document_type_id: "governance-policy",
            adopted_on: "2025-01-01",
            review_cycle_months: 12,
            last_reviewed_on: null,
            next_review_on: "2026-01-01",
          },
        ],
        circulations: [],
        adoptedByRole: "Director",
      },
      TODAY,
    );
    expect(rows[0].state).toBe("overdue");
    expect(rows[1]).toMatchObject({
      adopted_on: null,
      adopted_by: "",
      next_review_on: null,
      state: "not-adopted",
    });
    expect(documentControlGaps(rows)).toEqual([
      "Governance policy: not circulated to workers",
      "Complaints management policy and register: not adopted",
    ]);
    expect(documentControlSentence(rows)).toBe(
      "1 of 2 adopted, 0 circulated to workers, 1 review overdue.",
    );
    expect(documentControlSentence([])).toBe("No documents yet.");
  });

  it("a circulation before the current version's day does not count; the newest one after it does (FR-14)", () => {
    const rows = documentControlRows(
      {
        documents: [docs[0]],
        reviews: [],
        circulations: [
          {
            document_type_id: "governance-policy",
            circulated_on: "2026-10-01",
            worker_refs: "W-1",
          },
          {
            document_type_id: "governance-policy",
            circulated_on: "2026-10-11",
            worker_refs: "W-1 W-2 KP-1",
          },
          {
            document_type_id: "governance-policy",
            circulated_on: "2026-10-10",
            worker_refs: "W-3",
          },
        ],
        adoptedByRole: "Owner",
      },
      TODAY,
    );
    expect(rows[0].circulated).toEqual({ on: "2026-10-11", workers: 3 });
  });
});

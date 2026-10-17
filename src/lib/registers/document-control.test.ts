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
  adoptedBy,
  documentControlGaps,
  documentControlRows,
  documentControlSentence,
  newVersionsAsk,
} from "./document-control";

const TODAY = "2026-10-14";
// REQ-024 A0 (D-2427): adoption is the version's own column; the policy
// review row is the mirror for the review date alone. Each fixture document
// carries the day its latest version was adopted.
const docs = [
  {
    document_type_id: "governance-policy",
    title: "Governance policy",
    version: 2,
    created_at: "2026-10-10T03:00:00Z",
    adopted_on: "2026-10-12",
  },
  {
    document_type_id: "complaints-management-policy-and-register",
    title: "Complaints management policy and register",
    version: 1,
    created_at: "2026-10-09T03:00:00Z",
    adopted_on: "2026-10-12",
  },
];
const unadopted = docs.map((d) => ({ ...d, adopted_on: null }));

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
    // Retro finding 114 (D-2244): "by whom" names the person who adopted, with the role when there is one.
    expect(
      adoptedBy({ adoptedByRole: "Director", adoptedByName: "Jane Citizen" }),
    ).toBe("Jane Citizen, Director");
    expect(
      adoptedBy({ adoptedByRole: null, adoptedByName: "Jane Citizen" }),
    ).toBe("Jane Citizen");
    expect(adoptedBy({ adoptedByRole: " Owner ", adoptedByName: "  " })).toBe(
      "Owner",
    );
    expect(documentControlGaps(rows)).toEqual([
      "Governance policy: not circulated to workers",
      "Complaints management policy and register: not circulated to workers",
    ]);
  });

  it("a document that is not adopted has an empty adopted cell, no review date and the not-adopted state; an overdue review is flagged", () => {
    const rows = documentControlRows(
      {
        documents: [{ ...docs[0], adopted_on: "2025-01-01" }, unadopted[1]],
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

  it("the version column is the truth: a review row with a date does not adopt a version without one (REQ-024 A0, D-2427)", () => {
    const rows = documentControlRows(
      {
        documents: unadopted,
        reviews: docs.map((d) => ({
          document_type_id: d.document_type_id,
          adopted_on: "2026-10-12",
          review_cycle_months: 12,
          last_reviewed_on: null,
          next_review_on: "2027-10-12",
        })),
        circulations: [],
        adoptedByRole: "Owner",
      },
      TODAY,
    );
    expect(rows.every((r) => r.state === "not-adopted")).toBe(true);
    expect(rows.every((r) => r.adopted_on === null)).toBe(true);
    expect(documentControlSentence(rows)).toBe(
      "0 of 2 adopted, 0 circulated to workers.",
    );
  });
});

/** REQ-024 A0 (D-2436, finding 217): the sixth state and the cells of its row. */
describe("new version to adopt (REQ-024 A0, D-2436)", () => {
  const reviews = docs.map((d) => ({
    document_type_id: d.document_type_id,
    adopted_on: "2026-10-12",
    review_cycle_months: 12,
    last_reviewed_on: null,
    next_review_on: "2027-10-12",
  }));
  const circulations = docs.map((d) => ({
    document_type_id: d.document_type_id,
    circulated_on: "2026-10-12",
    worker_refs: "W-1",
  }));

  it("a latest version without a date whose type has an older adopted version reads new-version, with the older date, the adopter and the type's review date", () => {
    const rows = documentControlRows(
      {
        documents: [
          {
            ...docs[0],
            version: 3,
            created_at: "2026-10-13T03:00:00Z",
            adopted_on: null,
            older_adopted_on: "2026-10-12",
          },
          docs[1],
        ],
        reviews,
        circulations,
        adoptedByRole: "Director",
        adoptedByName: "Jane Citizen",
      },
      TODAY,
    );
    expect(rows[0]).toMatchObject({
      state: "new-version",
      version: "3",
      adopted_on: "2026-10-12",
      adopted_by: "Jane Citizen, Director",
      next_review_on: "2027-10-12",
    });
    expect(rows[1].state).toBe("adopted");
    // The sentence keeps its leading "N of T adopted" and appends the clause.
    expect(documentControlSentence(rows)).toBe(
      "2 of 2 adopted, 1 circulated to workers, 1 with a new version to adopt.",
    );
    expect(documentControlSentence(rows)).toMatch(/^\d+ of \d+ adopted/);
    expect(documentControlGaps(rows)).toEqual([
      "Governance policy: new version to adopt",
    ]);
    expect(newVersionsAsk(rows)).toBe("1 document has a new version to adopt");
  });

  it("a regenerated set reads new-version on every row; a type never adopted reads not-adopted; no new versions gives no ask", () => {
    const regenerated = documentControlRows(
      {
        documents: unadopted.map((d) => ({
          ...d,
          version: 1,
          older_adopted_on: "2026-10-12",
        })),
        reviews,
        circulations: [],
        adoptedByRole: "Owner",
      },
      TODAY,
    );
    expect(regenerated.every((r) => r.state === "new-version")).toBe(true);
    expect(newVersionsAsk(regenerated)).toBe(
      "2 documents have a new version to adopt",
    );
    const fresh = documentControlRows(
      {
        documents: unadopted.map((d) => ({ ...d, older_adopted_on: null })),
        reviews: [],
        circulations: [],
        adoptedByRole: "Owner",
      },
      TODAY,
    );
    expect(fresh.every((r) => r.state === "not-adopted")).toBe(true);
    expect(newVersionsAsk(fresh)).toBeNull();
  });
});

/** Backlog 8 (D-551): an adopted document drafted before a rule change it does not carry is "review needed" until re-generated or checked. */
describe("living policies in the document control register (backlog 8)", () => {
  const change = {
    id: "wc-2026-10-14-01",
    appliedOn: "2026-10-14",
    where: "brief" as const,
    documentTypeIds: ["governance-policy"],
    sectionId: "policy-statement",
    oldSentence: null,
    newSentence:
      "We tell the Commission about changes and events in its approved form as soon as we know they will happen.",
    why: "Provider Registration Rules s 13A.",
    source: "https://example.test/s13a",
    watchReport: "test",
  };
  const base = {
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
      worker_refs: "W-1",
    })),
    adoptedByRole: "Owner",
    changes: [change],
  };
  const withText = (text: string) =>
    docs.map((d) => ({
      ...d,
      version_id: `v-${d.document_type_id}`,
      sections: [{ id: "policy-statement", text }],
    }));

  it("flags the adopted governance policy drafted before the change, with the sentences, and the sentence and gaps say so", () => {
    const rows = documentControlRows(
      { ...base, documents: withText("What we do: we keep records.") },
      TODAY,
    );
    const gov = rows.find((r) => r.document_type_id === "governance-policy")!;
    expect(gov.state).toBe("review-needed");
    expect(gov.version_id).toBe("v-governance-policy");
    expect(gov.reviewNeeded).toHaveLength(1);
    expect(gov.reviewNeeded[0]).toMatchObject({
      changeId: change.id,
      sectionId: "policy-statement",
      certainty: "likely",
      newSentence: change.newSentence,
    });
    const complaints = rows.find(
      (r) => r.document_type_id !== "governance-policy",
    )!;
    expect(complaints.state).toBe("adopted");
    expect(documentControlSentence(rows)).toBe(
      "2 of 2 adopted, 2 circulated to workers, 1 to check after a rule change.",
    );
    expect(documentControlGaps(rows)).toEqual([
      "Governance policy: a rule changed since it was drafted",
    ]);
  });

  it("is cleared by a version that carries the sentence, by a version drafted after the change, or by the owner's check; a document not adopted is never flagged", () => {
    const carries = documentControlRows(
      { ...base, documents: withText(`What we do. ${change.newSentence}`) },
      TODAY,
    );
    expect(carries.every((r) => r.state === "adopted")).toBe(true);
    const later = documentControlRows(
      {
        ...base,
        documents: withText("x").map((d) => ({
          ...d,
          created_at: "2026-10-15T03:00:00Z",
        })),
      },
      TODAY,
    );
    expect(later.every((r) => r.state === "adopted")).toBe(true);
    const checked = documentControlRows(
      {
        ...base,
        documents: withText("x"),
        changeReviews: [
          { document_type_id: "governance-policy", change_id: change.id },
        ],
      },
      TODAY,
    );
    expect(checked.every((r) => r.state === "adopted")).toBe(true);
    const notAdopted = documentControlRows(
      {
        ...base,
        documents: withText("x").map((d) => ({ ...d, adopted_on: null })),
        reviews: base.reviews.map((r) => ({ ...r, adopted_on: null })),
      },
      TODAY,
    );
    expect(
      notAdopted.every(
        (r) => r.state === "not-adopted" && r.reviewNeeded.length === 0,
      ),
    ).toBe(true);
  });
});

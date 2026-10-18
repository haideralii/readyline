/** REQ-029 D-2855: the register's "by whom" reads the version's approver snapshot before the account's facts. */
import { describe, expect, it } from "vitest";
import { documentControlRows } from "./document-control";

const TODAY = "2026-10-18";

describe("document control: by whom from the adoption snapshot (REQ-029 FR-5, D-2855)", () => {
  const doc = (
    id: string,
    approver: { approver_name: string | null; approver_role: string | null },
  ) => ({
    document_type_id: id,
    title: id,
    version: 1,
    created_at: "2026-10-10T00:00:00Z",
    adopted_on: "2026-10-12",
    ...approver,
  });
  const review = (id: string) => ({
    document_type_id: id,
    adopted_on: "2026-10-12",
    review_cycle_months: 12,
    last_reviewed_on: null,
    next_review_on: null,
  });

  it("names the snapshot's person and role, falls back to the facts for a version without one, and never the live name over a snapshot", () => {
    const rows = documentControlRows(
      {
        documents: [
          doc("a", { approver_name: "Jane Citizen", approver_role: "Owner" }),
          doc("b", { approver_name: null, approver_role: null }),
          doc("c", { approver_name: "Jane Citizen", approver_role: null }),
        ],
        reviews: [review("a"), review("b"), review("c")],
        circulations: [],
        adoptedByRole: "Director",
        adoptedByName: "Someone Else",
      },
      TODAY,
    );
    const by = Object.fromEntries(
      rows.map((r) => [r.document_type_id, r.adopted_by]),
    );
    expect(by).toEqual({
      a: "Jane Citizen, Owner",
      b: "Someone Else, Director",
      c: "Jane Citizen, Director",
    });
  });
});

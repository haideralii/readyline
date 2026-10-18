/** REQ-029 D-2855: the register's "by whom" reads the version's approver snapshot before the account's facts. */
import { describe, expect, it } from "vitest";
import { contactUpdatedOn, documentControlRows } from "./document-control";

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

describe("the contact line (REQ-029 D-2856)", () => {
  it("names the Sydney day the contact detail changed when that is after the adoption day, and nothing otherwise", () => {
    expect(contactUpdatedOn("2026-10-12", "2026-10-16T22:30:00Z")).toBe(
      "2026-10-17",
    );
    expect(contactUpdatedOn("2026-10-12", "2026-10-12T01:00:00Z")).toBeNull();
    expect(contactUpdatedOn("2026-10-12", "2026-10-11T23:00:00Z")).toBeNull();
    expect(contactUpdatedOn(null, "2026-10-16T22:30:00Z")).toBeNull();
    expect(contactUpdatedOn("2026-10-12", null)).toBeNull();
  });
  it("rides the register row and the pack's CSV column, empty on a draft", () => {
    const rows = documentControlRows(
      {
        documents: [
          {
            document_type_id: "a",
            title: "a",
            version: 1,
            created_at: "2026-10-10T00:00:00Z",
            adopted_on: "2026-10-12",
            approver_name: "Jane Citizen",
            approver_role: "Owner",
          },
          {
            document_type_id: "b",
            title: "b",
            version: 1,
            created_at: "2026-10-10T00:00:00Z",
            adopted_on: null,
          },
        ],
        reviews: [
          {
            document_type_id: "a",
            adopted_on: "2026-10-12",
            review_cycle_months: 12,
            last_reviewed_on: null,
            next_review_on: null,
          },
        ],
        circulations: [],
        adoptedByRole: null,
        contactUpdatedAt: "2026-10-16T22:30:00Z",
      },
      "2026-10-18",
    );
    expect(rows.map((r) => r.contact_updated_on)).toEqual(["2026-10-17", null]);
  });
});

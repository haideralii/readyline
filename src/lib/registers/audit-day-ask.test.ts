// @vitest-environment node
/**
 * "What the auditor will ask to see" (REQ-018 FR-11, AC-4; D-1907): twelve
 * lines, each with a live state and a tap, in plain words that pass the
 * copy lint; a missing register says so and offers the add; an overdue one
 * says fix it.
 */
import { describe, expect, it } from "vitest";
import { findProhibitedClaims } from "@/lib/claims";
import { lintText } from "@/lib/copy-lint/rules";
import type { AuditDayOverview } from "@/server/registers/audit-day-queries";
import { ASK_COUNT, auditDayAskList } from "./audit-day-ask";
import { AUDIT_DAY_SLUGS } from "./audit-day-forms";

const empty = Object.fromEntries(
  AUDIT_DAY_SLUGS.map((s) => [
    s,
    { total: 0, attention: 0, attentionLabel: "Nothing recorded" },
  ]),
) as AuditDayOverview;

const registersEmpty = {
  incidents: { total: 0, open: 0, overdueNotification: 0 },
  complaints: { total: 0, unresolved: 0 },
  workerChecks: { total: 0, expiring: 0, expired: 0 },
  policyReviews: { total: 0, dueSoon: 0, overdue: 0, notAdopted: 0 },
};

/** REQ-024 A0 (D-2436, finding 217): a set whose rows carry new versions and nothing missing names them and sends the owner to the path. */
describe("the document control line with a new version to adopt (REQ-024 A0)", () => {
  const row = {
    document_type_id: "governance-policy",
    title: "Governance policy",
    version: "2",
    adopted_on: "2026-10-12",
    adopted_by: "Owner",
    next_review_on: "2027-10-12",
    circulated: { on: "2026-10-12", workers: 1 },
    state: "new-version" as const,
    version_id: null,
    reviewNeeded: [],
  };
  it("reads the sentence then the count, offers Adopt the new versions, and stays filled", () => {
    const lines = auditDayAskList({
      registers: registersEmpty,
      auditDay: empty,
      documentControl: [
        row,
        { ...row, document_type_id: "x", state: "adopted" },
      ],
    });
    const dc = lines.find((l) => l.id === "document-control")!;
    expect(dc).toMatchObject({
      state: "filled",
      word: "2 of 2 adopted, 2 circulated to workers, 1 with a new version to adopt. 1 document has a new version to adopt.",
      href: "/path/adopt",
      action: "Adopt the new versions",
    });
    expect(lintText(dc.word, { block: true })).toEqual([]);
    expect(findProhibitedClaims(dc.word)).toEqual([]);
  });
  it("a row not adopted at all still reads missing with the adopt action", () => {
    const lines = auditDayAskList({
      registers: registersEmpty,
      auditDay: empty,
      documentControl: [
        row,
        {
          ...row,
          document_type_id: "x",
          adopted_on: null,
          state: "not-adopted",
        },
      ],
    });
    expect(lines.find((l) => l.id === "document-control")).toMatchObject({
      state: "missing",
      action: "Adopt your documents",
    });
  });
});

describe("audit-day ask list (REQ-018 FR-11)", () => {
  it("lists the twelve items with a tap each, all missing on an empty account, every word plain", () => {
    const lines = auditDayAskList({
      registers: registersEmpty,
      auditDay: empty,
      documentControl: [],
    });
    expect(lines).toHaveLength(ASK_COUNT);
    expect(new Set(lines.map((l) => l.id)).size).toBe(ASK_COUNT);
    for (const l of lines) {
      expect(l.state, l.id).toBe("missing");
      expect(l.href, l.id).toMatch(/^\/registers\//);
      expect(l.action.length, l.id).toBeGreaterThan(2);
      for (const t of [l.ask, l.word, l.action]) {
        expect(lintText(t, { block: true }), `${l.id}: ${t}`).toEqual([]);
        expect(findProhibitedClaims(t), `${l.id}: ${t}`).toEqual([]);
      }
    }
  });

  it("a filled register reads as filled, an overdue one as overdue with Fix it, and the document control line follows its rows", () => {
    const lines = auditDayAskList({
      registers: {
        ...registersEmpty,
        incidents: { total: 3, open: 1, overdueNotification: 1 },
        complaints: { total: 2, unresolved: 0 },
      },
      auditDay: {
        ...empty,
        decisions: { total: 4, attention: 0, attentionLabel: "All current" },
        insurances: { total: 3, attention: 1, attentionLabel: "1 overdue" },
      },
      documentControl: [
        {
          document_type_id: "governance-policy",
          title: "Governance policy",
          version: "1",
          adopted_on: "2026-10-12",
          adopted_by: "Owner",
          next_review_on: "2027-10-12",
          circulated: { on: "2026-10-12", workers: 1 },
          state: "adopted",
          version_id: null,
          reviewNeeded: [],
        },
      ],
    });
    const by = (id: string) => lines.find((l) => l.id === id)!;
    expect(by("decisions")).toMatchObject({
      state: "filled",
      word: "4 entries; all current.",
      action: "Open",
    });
    expect(by("insurances")).toMatchObject({
      state: "overdue",
      action: "Fix it",
    });
    expect(by("incidents")).toMatchObject({
      state: "overdue",
      word: "1 overdue to notify the Commission.",
    });
    expect(by("complaints")).toMatchObject({
      state: "filled",
      word: "2 entries; 0 unresolved.",
    });
    expect(by("document-control")).toMatchObject({
      state: "filled",
      word: "1 of 1 adopted, 1 circulated to workers.",
      href: "/registers/document-control",
    });
  });
});

describe("the two tiers and the paper marks (batch 45, REQ-018-gated item)", () => {
  it("every line carries its tier from the one list, six and eight, and only the two paper records are marked", () => {
    const lines = auditDayAskList({
      registers: registersEmpty,
      auditDay: empty,
      documentControl: [],
    });
    expect(lines.filter((l) => l.tier === "named").map((l) => l.id)).toEqual([
      "document-control",
      "corporate-risks",
      "insurances",
      "staff-matrix",
      "incidents",
      "complaints",
    ]);
    // REQ-020 FR-7: the hazard register joins the practice tier after the delegations.
    expect(lines.filter((l) => l.tier === "practice").map((l) => l.id)).toEqual(
      [
        "decisions",
        "participant-risks",
        "conflicts-of-interest",
        "delegations",
        "hazards",
        // REQ-023 FR-10 (Session D): the changes register joins after the hazards.
        "commission-changes",
        "improvements",
        "onboarding",
      ],
    );
    expect(lines.filter((l) => l.paper).map((l) => l.id)).toEqual([
      "insurances",
      "onboarding",
    ]);
  });
});

describe("the hazard register on the list (REQ-020 FR-7, AC-6)", () => {
  it("is missing on an empty account with a tap to add, filled with its count, overdue when a review is past", () => {
    const missing = auditDayAskList({
      registers: registersEmpty,
      auditDay: empty,
      documentControl: [],
    }).find((l) => l.id === "hazards")!;
    expect(missing).toMatchObject({
      state: "missing",
      href: "/registers/hazards",
      tier: "practice",
    });
    const filled = auditDayAskList({
      registers: registersEmpty,
      auditDay: {
        ...empty,
        hazards: { total: 2, attention: 0, attentionLabel: "All current" },
      },
      documentControl: [],
    }).find((l) => l.id === "hazards")!;
    expect(filled).toMatchObject({
      state: "filled",
      word: "2 entries; all current.",
    });
    const overdue = auditDayAskList({
      registers: registersEmpty,
      auditDay: {
        ...empty,
        hazards: { total: 2, attention: 1, attentionLabel: "1 overdue" },
      },
      documentControl: [],
    }).find((l) => l.id === "hazards")!;
    expect(overdue).toMatchObject({ state: "overdue", action: "Fix it" });
  });
});

import { describe, expect, it } from "vitest";
import { AUDIT_DAY_META, AUDIT_DAY_SLUGS } from "./audit-day-forms";
import {
  ALL_COLUMN_LISTS,
  COMPLAINT_COLUMNS,
  INCIDENT_COLUMNS,
  NARRATIVE_KEYS,
  NARRATIVE_TITLE_SLUGS,
  cellsFor,
  linkNameFor,
  formatShortDateAu,
  tableColumns,
  type ColumnSpec,
} from "./table-columns";

/**
 * REQ-028 FR-8 (D-2814, D-2804, D-2815): every register's columns are a
 * code, a date, a fixed word, the status or one of the short typed fields,
 * never narrative; a name planted in every narrative field reaches no cell.
 */
const NAME = "Jordan Example";
const DAY = "2026-10-17";

/** One row per register with the planted name in every free-text field it has. */
const SAMPLE: Record<string, Record<string, unknown>> = {
  incidents: {
    id: "i1",
    reference: "INC-0001",
    occurred_on: DAY,
    reported_on: DAY,
    category: "near-miss",
    severity: "low",
    participant_ref: "P-014",
    worker_ref: "W-001",
    summary: `${NAME} tripped`,
    actions_taken: `Spoke with ${NAME}`,
    reportable: false,
    reportable_notified_on: null,
    commission_reference: "",
    notify_by: null,
    status: "open",
    closed_on: null,
    reported_via: "owner",
    logged_by_ref: null,
    rejected_reason: NAME,
    aware_at: `${DAY}T00:00:00Z`,
    aware_on: DAY,
  },
  complaints: {
    id: "c1",
    reference: "CMP-0001",
    received_on: DAY,
    channel: "phone",
    from_ref: "P-014",
    summary: `${NAME} called`,
    outcome: `Apologised to ${NAME}`,
    acknowledged_on: null,
    resolved_on: null,
    status: "open",
  },
  "worker-checks": {
    id: "w1",
    worker_ref: "W-001",
    role_label: "Support worker",
    clearance_kind: "ndis-worker-screening",
    clearance_number: "123",
    application_number: "",
    issued_on: DAY,
    expires_on: null,
    verified_in_database_on: null,
    decision_code: null,
    decision_on: null,
    state: "NSW",
    note: NAME,
    status: "valid",
  },
  "policy-reviews": {
    id: "p1",
    document_type_id: "other",
    title: "Our own procedure",
    adopted_on: null,
    next_review_on: DAY,
    review_cycle_months: 12,
    note: NAME,
    status: "not-adopted",
  },
  "corporate-risks": {
    id: "r1",
    area: "workforce",
    what_could_happen: `${NAME} leaves`,
    likelihood: "medium",
    controls: `Talk to ${NAME}`,
    owner_role: "Owner",
    review_on: DAY,
    starter: false,
    status: "current",
  },
  hazards: {
    id: "h1",
    site_ref: "S-01",
    hazard: `${NAME}'s loose rail`,
    harm_to: "participant",
    likelihood: "low",
    severity: "high",
    controls: NAME,
    due_on: DAY,
    done_on: null,
    review_on: DAY,
    status: "current",
  },
  "participant-risks": {
    id: "pr1",
    participant_ref: "P-014",
    risk: `${NAME} falls`,
    controls: NAME,
    review_on: DAY,
    support_plan_review_on: null,
    status: "current",
  },
  "conflicts-of-interest": {
    id: "k1",
    who_ref: "W-002",
    conflict: `Related to ${NAME}`,
    managed_by: `${NAME} steps out`,
    declared_on: DAY,
    review_on: DAY,
    status: "current",
  },
  delegations: {
    id: "d1",
    role: "other",
    role_label: "Rostering",
    holder_ref: "W-001",
    backup_ref: null,
    backup_may: `Ask ${NAME}`,
  },
  insurances: {
    id: "n1",
    kind: "public-liability",
    label: "Example Insurer",
    policy_number: "PL-77",
    expires_on: DAY,
    note: NAME,
    status: "current",
  },
  improvements: {
    id: "m1",
    source_kind: "incident",
    source_ref: "INC-0001",
    learned: `${NAME} said`,
    changed: `Told ${NAME}`,
    owner_role: "Team leader",
    due_on: DAY,
    done_on: null,
    status: "open",
  },
  decisions: {
    id: "x1",
    decided_on: DAY,
    decision: `Hire ${NAME}`,
    decided_by: "Owner",
    note: NAME,
  },
  "staff-matrix": {
    id: "s1",
    worker_ref: "W-001",
    role_label: "Support worker",
    qualifications: `${NAME} Cert III`,
    risk_assessed: true,
    started_on: DAY,
    last_supervision_on: null,
    last_appraisal_on: null,
    onboarding_signed_on: null,
    note: NAME,
    role: "support-worker",
    states: ["NSW"],
    works_with_children: false,
    may_use_restrictive_practice: false,
    ended_on: null,
    role_ref: null,
    risk_assessed_from: null,
    risk_paragraph: NAME,
    status: "current",
  },
  onboarding: {
    id: "o1",
    kind: "worker",
    subject_ref: "W-003",
    started_on: DAY,
    completed_on: null,
    status: "in-progress",
  },
};

describe("the register columns (REQ-028 FR-8, D-2814)", () => {
  it("every list is codes, dates, fixed words, typed fields and one status column; the record of decisions has none", () => {
    for (const [name, list] of Object.entries(ALL_COLUMN_LISTS)) {
      if (name === "decisions") {
        expect(list).toEqual([]);
        continue;
      }
      expect(list.length, name).toBeGreaterThanOrEqual(3);
      expect(
        list.filter((c) => c.kind === "status").length,
        `${name} status column`,
      ).toBe(1);
      for (const c of list)
        expect(["code", "date", "word", "field", "status"], c.label).toContain(
          c.kind,
        );
    }
  });

  it("no column reads a narrative key (D-2804)", () => {
    const offenders: string[] = [];
    for (const [name, list] of Object.entries(ALL_COLUMN_LISTS))
      for (const c of list)
        for (const k of c.reads)
          if ((NARRATIVE_KEYS as readonly string[]).includes(k))
            offenders.push(`${name}: ${c.label} reads ${k}`);
    expect(offenders).toEqual([]);
  });

  it("a name planted in every narrative field reaches no cell (D-2815)", () => {
    for (const [name, list] of Object.entries(ALL_COLUMN_LISTS)) {
      const row = SAMPLE[name];
      expect(row, `sample for ${name}`).toBeDefined();
      const cells = cellsFor(
        list as readonly ColumnSpec<Record<string, unknown>>[],
        row,
      );
      for (const cell of cells)
        expect(cell ?? "", `${name}: ${cell}`).not.toContain(NAME);
      // Every non-status cell either has a value or an empty word to show.
      const cols = tableColumns(list);
      cells.forEach((cell, i) => {
        if (cols[i].kind !== "status")
          expect(cell ?? cols[i].empty).toBeTruthy();
      });
    }
  });

  it("formats dates for the grid and leaves a null for the empty word", () => {
    expect(formatShortDateAu("2026-10-17")).toBe("17 Oct 2026");
    const cells = cellsFor(COMPLAINT_COLUMNS, SAMPLE.complaints as never);
    expect(cells).toEqual(["CMP-0001", "17 Oct 2026", null, null]);
    expect(tableColumns(COMPLAINT_COLUMNS).map((c) => c.empty)).toEqual([
      "—",
      "—",
      "Not yet",
      "—",
    ]);
    // D-2814 puts the incidents' status before "Notify by".
    expect(INCIDENT_COLUMNS.map((c) => c.label)).toEqual([
      "Ref",
      "Occurred",
      "Category",
      "Status",
      "Notify by",
    ]);
  });

  it("names the table link by the code on the six narrative-title registers and by the title elsewhere (PO 18:55)", () => {
    for (const slug of NARRATIVE_TITLE_SLUGS) {
      const name = linkNameFor(slug, SAMPLE[slug]);
      expect(name, slug).toBeTruthy();
      expect(name).not.toContain(NAME);
    }
    expect(linkNameFor("complaints", SAMPLE.complaints)).toBe("CMP-0001");
    expect(linkNameFor("improvements", SAMPLE.improvements)).toBe(
      "An incident INC-0001",
    );
    for (const slug of [
      "incidents",
      "worker-checks",
      "policy-reviews",
      "onboarding",
      "staff-matrix",
      "delegations",
      "insurances",
      "decisions",
    ])
      expect(linkNameFor(slug, SAMPLE[slug]), slug).toBeNull();
  });

  it("every audit-day register's meta carries its list", () => {
    for (const slug of AUDIT_DAY_SLUGS)
      expect(AUDIT_DAY_META[slug].columns, slug).toBe(ALL_COLUMN_LISTS[slug]);
  });
});

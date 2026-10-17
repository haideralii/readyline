import { documentTitle } from "@/lib/questionnaire/content";
import {
  DELEGATION_ROLE_LABELS,
  HARM_TO_LABELS,
  IMPROVEMENT_SOURCE_LABELS,
  INSURANCE_KIND_LABELS,
  RISK_AREA_LABELS,
  type ConflictOfInterestRow,
  type CorporateRiskRow,
  type DecisionRow,
  type DelegationRow,
  type HazardRow,
  type ImprovementRow,
  type InsuranceItemRow,
  type OnboardingChecklistRow,
  type ParticipantRiskRow,
  type StaffMatrixRow,
} from "./audit-day-types";
import { CATEGORY_LABELS, CLEARANCE_LABELS } from "./labels";
import { WORKER_ROLE_LABELS, type WorkerRole } from "./onboarding-items";
import type {
  ComplaintRow,
  IncidentRow,
  PolicyReviewRow,
  WorkerClearanceRow,
} from "./types";

/**
 * REQ-028 FR-8 (D-2814, D-2804): the columns of every register table, as
 * data. Each column is a code, a date, a fixed-vocabulary word, the status,
 * or one of the eight short typed fields an auditor samples by name; no
 * column ever reads a narrative field (what happened, the controls, a note,
 * a summary), which stays on the entry's own page. `reads` names the row
 * keys a cell touches so the unit test can hold every list to that rule
 * without running the cells, and the planted-name test runs them too.
 * The status column is placed where D-2814 puts it; the table draws the
 * register's own `Tag` there.
 */
export type ColumnKind = "code" | "date" | "word" | "field" | "status";

export type ColumnSpec<Row> = {
  label: string;
  kind: ColumnKind;
  /** The row keys the cell reads (empty for the status column). */
  reads: readonly string[];
  /** The cell's raw value: an ISO day for a date, a code, a label, a short typed field; null when the row has none. */
  cell: (row: Row) => string | null;
  /** What a null cell shows; a dash unless the register says otherwise. */
  empty?: string;
};

/** What the table receives: serialisable, so a server page can hand it to the client list. */
export type TableColumn = {
  label: string;
  kind: ColumnKind;
  empty: string;
};

export const EMPTY_CELL = "—";

export const STATUS_COLUMN: ColumnSpec<unknown> = {
  label: "Status",
  kind: "status",
  reads: [],
  cell: () => null,
};

/** The row keys no column may read (D-2804): narrative, never a grid's. */
export const NARRATIVE_KEYS = [
  "summary",
  "note",
  "actions_taken",
  "what_could_happen",
  "controls",
  "hazard",
  "risk",
  "conflict",
  "managed_by",
  "backup_may",
  "learned",
  "changed",
  "decision",
  "outcome",
  "qualifications",
  "risk_paragraph",
  "rejected_reason",
  "description",
] as const;

/** A date for a grid: "17 Oct 2026", the Sydney day as the ISO value names it. */
export function formatShortDateAu(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(`${iso}T03:00:00Z`));
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function tableColumns<Row>(
  specs: readonly ColumnSpec<Row>[],
): TableColumn[] {
  return specs.map((s) => ({
    label: s.label,
    kind: s.kind,
    empty: s.empty ?? EMPTY_CELL,
  }));
}

/** The cells of one row in column order, dates formatted, the status column's cell null (the table draws the tag). */
export function cellsFor<Row>(
  specs: readonly ColumnSpec<Row>[],
  row: Row,
): (string | null)[] {
  return specs.map((s) => {
    if (s.kind === "status") return null;
    const v = s.cell(row);
    if (v === null || v === "") return null;
    return s.kind === "date" ? formatShortDateAu(v) : v;
  });
}

const status = <Row>() => STATUS_COLUMN as ColumnSpec<Row>;

// The four named registers (REQ-009), whose rows come from `queries.ts`.

export const INCIDENT_COLUMNS: readonly ColumnSpec<IncidentRow>[] = [
  {
    label: "Ref",
    kind: "code",
    reads: ["reference"],
    cell: (r) => r.reference,
  },
  {
    label: "Occurred",
    kind: "date",
    reads: ["occurred_on"],
    cell: (r) => r.occurred_on,
  },
  {
    label: "Category",
    kind: "word",
    reads: ["category"],
    cell: (r) => CATEGORY_LABELS[r.category],
  },
  status<IncidentRow>(),
  {
    label: "Notify by",
    kind: "date",
    reads: ["notify_by"],
    cell: (r) => r.notify_by,
    empty: "Not reportable",
  },
];

export const COMPLAINT_COLUMNS: readonly ColumnSpec<ComplaintRow>[] = [
  {
    label: "Ref",
    kind: "code",
    reads: ["reference"],
    cell: (r) => r.reference,
  },
  {
    label: "Received",
    kind: "date",
    reads: ["received_on"],
    cell: (r) => r.received_on,
  },
  {
    label: "Acknowledged",
    kind: "date",
    reads: ["acknowledged_on"],
    cell: (r) => r.acknowledged_on,
    empty: "Not yet",
  },
  status<ComplaintRow>(),
];

export const WORKER_CHECK_COLUMNS: readonly ColumnSpec<WorkerClearanceRow>[] = [
  {
    label: "Worker code",
    kind: "code",
    reads: ["worker_ref"],
    cell: (r) => r.worker_ref,
  },
  {
    label: "Check",
    kind: "word",
    reads: ["clearance_kind"],
    cell: (r) => CLEARANCE_LABELS[r.clearance_kind],
  },
  {
    label: "Issued",
    kind: "date",
    reads: ["issued_on"],
    cell: (r) => r.issued_on,
    empty: "Pending",
  },
  {
    label: "Expires",
    kind: "date",
    reads: ["expires_on"],
    cell: (r) => r.expires_on,
    empty: "No expiry",
  },
  status<WorkerClearanceRow>(),
];

export const POLICY_REVIEW_COLUMNS: readonly ColumnSpec<PolicyReviewRow>[] = [
  {
    label: "Document",
    kind: "field",
    reads: ["document_type_id", "title"],
    cell: (r) =>
      r.document_type_id === "other"
        ? r.title
        : documentTitle(r.document_type_id) || r.title || r.document_type_id,
  },
  {
    label: "Adopted",
    kind: "date",
    reads: ["adopted_on"],
    cell: (r) => r.adopted_on,
    empty: "Not yet",
  },
  {
    label: "Next review",
    kind: "date",
    reads: ["next_review_on"],
    cell: (r) => r.next_review_on,
  },
  status<PolicyReviewRow>(),
];

// The ten audit-day registers (REQ-020, REQ-024), whose rows the meta describes.

export const CORPORATE_RISK_COLUMNS: readonly ColumnSpec<CorporateRiskRow>[] = [
  {
    label: "Area",
    kind: "word",
    reads: ["area"],
    cell: (r) => RISK_AREA_LABELS[r.area],
  },
  {
    label: "How likely",
    kind: "word",
    reads: ["likelihood"],
    cell: (r) => cap(r.likelihood),
  },
  {
    label: "Owner (role)",
    kind: "field",
    reads: ["owner_role"],
    cell: (r) => r.owner_role,
  },
  {
    label: "Review by",
    kind: "date",
    reads: ["review_on"],
    cell: (r) => r.review_on,
  },
  status<CorporateRiskRow>(),
];

export const HAZARD_COLUMNS: readonly ColumnSpec<HazardRow>[] = [
  {
    label: "Where",
    kind: "code",
    reads: ["site_ref"],
    cell: (r) => r.site_ref,
  },
  {
    label: "Who it could harm",
    kind: "word",
    reads: ["harm_to"],
    cell: (r) => HARM_TO_LABELS[r.harm_to],
  },
  {
    label: "How serious",
    kind: "word",
    reads: ["severity"],
    cell: (r) => cap(r.severity),
  },
  { label: "Done by", kind: "date", reads: ["due_on"], cell: (r) => r.due_on },
  status<HazardRow>(),
];

export const PARTICIPANT_RISK_COLUMNS: readonly ColumnSpec<ParticipantRiskRow>[] =
  [
    {
      label: "Participant code",
      kind: "code",
      reads: ["participant_ref"],
      cell: (r) => r.participant_ref,
    },
    {
      label: "Review by",
      kind: "date",
      reads: ["review_on"],
      cell: (r) => r.review_on,
    },
    {
      label: "Support plan review",
      kind: "date",
      reads: ["support_plan_review_on"],
      cell: (r) => r.support_plan_review_on,
      empty: "No date yet",
    },
    status<ParticipantRiskRow>(),
  ];

export const CONFLICT_COLUMNS: readonly ColumnSpec<ConflictOfInterestRow>[] = [
  { label: "Who", kind: "code", reads: ["who_ref"], cell: (r) => r.who_ref },
  {
    label: "Declared on",
    kind: "date",
    reads: ["declared_on"],
    cell: (r) => r.declared_on,
  },
  {
    label: "Review by",
    kind: "date",
    reads: ["review_on"],
    cell: (r) => r.review_on,
  },
  status<ConflictOfInterestRow>(),
];

export const DELEGATION_COLUMNS: readonly ColumnSpec<DelegationRow>[] = [
  {
    label: "Role",
    kind: "word",
    reads: ["role", "role_label"],
    cell: (r) =>
      r.role === "other" ? r.role_label : DELEGATION_ROLE_LABELS[r.role],
  },
  {
    label: "Holder",
    kind: "code",
    reads: ["holder_ref"],
    cell: (r) => r.holder_ref,
  },
  {
    label: "Backup",
    kind: "code",
    reads: ["backup_ref"],
    cell: (r) => r.backup_ref,
    empty: "None",
  },
  status<DelegationRow>(),
];

export const INSURANCE_COLUMNS: readonly ColumnSpec<InsuranceItemRow>[] = [
  {
    label: "Kind",
    kind: "word",
    reads: ["kind"],
    cell: (r) => INSURANCE_KIND_LABELS[r.kind],
  },
  {
    label: "Insurer, vehicle or driver",
    kind: "field",
    reads: ["label"],
    cell: (r) => r.label,
  },
  {
    label: "Policy number",
    kind: "field",
    reads: ["policy_number"],
    cell: (r) => r.policy_number,
  },
  {
    label: "Expires",
    kind: "date",
    reads: ["expires_on"],
    cell: (r) => r.expires_on,
  },
  status<InsuranceItemRow>(),
];

export const IMPROVEMENT_COLUMNS: readonly ColumnSpec<ImprovementRow>[] = [
  {
    label: "Learned from",
    kind: "word",
    reads: ["source_kind"],
    cell: (r) => IMPROVEMENT_SOURCE_LABELS[r.source_kind],
  },
  {
    label: "Reference",
    kind: "code",
    reads: ["source_ref"],
    cell: (r) => r.source_ref,
  },
  {
    label: "Who does it (role)",
    kind: "field",
    reads: ["owner_role"],
    cell: (r) => r.owner_role,
  },
  { label: "Done by", kind: "date", reads: ["due_on"], cell: (r) => r.due_on },
  status<ImprovementRow>(),
];

export const STAFF_MATRIX_COLUMNS: readonly ColumnSpec<StaffMatrixRow>[] = [
  {
    label: "Worker code",
    kind: "code",
    reads: ["worker_ref"],
    cell: (r) => r.worker_ref,
  },
  {
    label: "Role",
    kind: "word",
    reads: ["role", "role_label"],
    cell: (r) =>
      r.role && r.role in WORKER_ROLE_LABELS
        ? WORKER_ROLE_LABELS[r.role as WorkerRole]
        : r.role_label,
  },
  {
    label: "Started",
    kind: "date",
    reads: ["started_on"],
    cell: (r) => r.started_on,
  },
  {
    label: "Last supervision",
    kind: "date",
    reads: ["last_supervision_on"],
    cell: (r) => r.last_supervision_on,
    empty: "None recorded",
  },
  status<StaffMatrixRow>(),
];

export const ONBOARDING_COLUMNS: readonly ColumnSpec<OnboardingChecklistRow>[] =
  [
    {
      label: "Checklist for",
      kind: "word",
      reads: ["kind"],
      cell: (r) => (r.kind === "worker" ? "New worker" : "New participant"),
    },
    {
      label: "Code",
      kind: "code",
      reads: ["subject_ref"],
      cell: (r) => r.subject_ref,
    },
    {
      label: "Started on",
      kind: "date",
      reads: ["started_on"],
      cell: (r) => r.started_on,
    },
    status<OnboardingChecklistRow>(),
  ];

/** D-2814: one free-text line and a date make no grid; the record of decisions keeps the list at every width. */
export const DECISION_COLUMNS: readonly ColumnSpec<DecisionRow>[] = [];

/** Every list, by the name the page or the meta uses; the unit test walks this. */
export const ALL_COLUMN_LISTS: Record<string, readonly ColumnSpec<never>[]> = {
  incidents: INCIDENT_COLUMNS as readonly ColumnSpec<never>[],
  complaints: COMPLAINT_COLUMNS as readonly ColumnSpec<never>[],
  "worker-checks": WORKER_CHECK_COLUMNS as readonly ColumnSpec<never>[],
  "policy-reviews": POLICY_REVIEW_COLUMNS as readonly ColumnSpec<never>[],
  "corporate-risks": CORPORATE_RISK_COLUMNS as readonly ColumnSpec<never>[],
  hazards: HAZARD_COLUMNS as readonly ColumnSpec<never>[],
  "participant-risks": PARTICIPANT_RISK_COLUMNS as readonly ColumnSpec<never>[],
  "conflicts-of-interest": CONFLICT_COLUMNS as readonly ColumnSpec<never>[],
  delegations: DELEGATION_COLUMNS as readonly ColumnSpec<never>[],
  insurances: INSURANCE_COLUMNS as readonly ColumnSpec<never>[],
  improvements: IMPROVEMENT_COLUMNS as readonly ColumnSpec<never>[],
  decisions: DECISION_COLUMNS as readonly ColumnSpec<never>[],
  "staff-matrix": STAFF_MATRIX_COLUMNS as readonly ColumnSpec<never>[],
  onboarding: ONBOARDING_COLUMNS as readonly ColumnSpec<never>[],
};

/**
 * Plain labels for the register vocabularies and the row-to-form mappers
 * (REQ-009 Session B). Pure and importable from server pages and client
 * forms alike; the forms themselves are client modules and nothing on the
 * server may call into them.
 */
import type {
  ComplaintFormValues,
  IncidentFormValues,
  PolicyReviewFormValues,
  WorkerCheckFormValues,
} from "./forms";
import type {
  CLEARANCE_KINDS,
  COMPLAINT_CHANNELS,
  COMPLAINT_STATUSES,
  ComplaintRow,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  IncidentRow,
  PolicyReviewRow,
  WorkerClearanceRow,
} from "./types";
import { OWNER_INCIDENT_STATUSES } from "./types";

/** Plain labels for the Commission's categories (PO answer 1). */
export const CATEGORY_LABELS: Record<
  (typeof INCIDENT_CATEGORIES)[number],
  string
> = {
  death: "Death of a participant",
  "serious-injury": "Serious injury of a participant",
  "abuse-or-neglect": "Abuse or neglect of a participant",
  "unlawful-sexual-or-physical-contact":
    "Unlawful sexual or physical contact with, or assault of, a participant",
  "sexual-misconduct": "Sexual misconduct towards a participant",
  "restrictive-practice-unauthorised":
    "Restrictive practice used without authorisation or outside a plan",
  "near-miss": "Near miss (no harm)",
  medication: "Medication error",
  "property-or-environment": "Property or environment (damage, hazard)",
  other: "Other",
};

export const SEVERITY_LABELS: Record<
  (typeof INCIDENT_SEVERITIES)[number],
  string
> = {
  low: "Low (no harm)",
  medium: "Medium (some harm)",
  high: "High (serious harm)",
};

/** Every status the view can show; the owner's form offers the three in `OWNER_INCIDENT_STATUSES` (REQ-020 Session B). */
export const INCIDENT_STATUS_LABELS: Record<
  (typeof INCIDENT_STATUSES)[number],
  string
> = {
  draft: "To confirm",
  open: "Open",
  "under-review": "Under review",
  closed: "Closed",
  rejected: "Rejected",
};

export const CHANNEL_LABELS: Record<
  (typeof COMPLAINT_CHANNELS)[number],
  string
> = {
  phone: "Phone",
  email: "Email",
  "in-person": "In person",
  form: "Written form or letter",
  advocate: "Through an advocate",
  other: "Other",
};

export const COMPLAINT_STATUS_LABELS: Record<
  (typeof COMPLAINT_STATUSES)[number],
  string
> = {
  received: "Received",
  acknowledged: "Acknowledged",
  "in-progress": "In progress",
  resolved: "Resolved",
  "escalated-to-commission": "Escalated to the Commission",
  withdrawn: "Withdrawn",
};

export const CLEARANCE_LABELS: Record<
  (typeof CLEARANCE_KINDS)[number],
  string
> = {
  "ndis-worker-screening": "NDIS Worker Screening Check",
  wwcc: "Working with Children Check",
  "police-check": "Police check",
  "first-aid": "First aid certificate",
  "ndis-worker-orientation-module":
    "NDIS Worker Orientation Module (no expiry)",
  "manual-handling": "Manual handling training",
  medication: "Medication training",
  cpr: "CPR certificate",
  "driver-licence": "Driver licence",
  other: "Other",
};

export function fromIncidentRow(row: IncidentRow): IncidentFormValues {
  return {
    occurredOn: row.occurred_on,
    awareOn: row.aware_on,
    reportedOn: row.reported_on,
    category: row.category,
    severity: row.severity,
    participantRef: row.participant_ref ?? "",
    workerRef: row.worker_ref ?? "",
    summary: row.summary,
    actionsTaken: row.actions_taken,
    reportable: row.reportable,
    reportableNotifiedOn: row.reportable_notified_on ?? "",
    // A draft or rejected row never reaches the form (its pages redirect); the type still needs a home.
    status: (OWNER_INCIDENT_STATUSES as readonly string[]).includes(row.status)
      ? (row.status as (typeof OWNER_INCIDENT_STATUSES)[number])
      : "open",
    closedOn: row.closed_on ?? "",
  };
}

export function fromComplaintRow(row: ComplaintRow): ComplaintFormValues {
  return {
    receivedOn: row.received_on,
    channel: row.channel,
    fromRef: row.from_ref ?? "",
    summary: row.summary,
    outcome: row.outcome,
    acknowledgedOn: row.acknowledged_on ?? "",
    resolvedOn: row.resolved_on ?? "",
    status: row.status,
  };
}

export function fromWorkerCheckRow(
  row: WorkerClearanceRow,
): WorkerCheckFormValues {
  return {
    workerRef: row.worker_ref,
    roleLabel: row.role_label,
    clearanceKind: row.clearance_kind,
    clearanceNumber: row.clearance_number ?? "",
    applicationNumber: row.application_number ?? "",
    issuedOn: row.issued_on ?? "",
    expiresOn: row.expires_on ?? "",
    verifiedInDatabaseOn: row.verified_in_database_on ?? "",
    state: row.state ?? "",
    note: row.note,
  };
}

export function fromPolicyReviewRow(
  row: PolicyReviewRow,
): PolicyReviewFormValues {
  return {
    documentTypeId: row.document_type_id,
    title: row.title,
    adoptedOn: row.adopted_on ?? "",
    reviewCycleMonths: String(row.review_cycle_months),
    lastReviewedOn: row.last_reviewed_on ?? "",
    reviewerRef: row.reviewer_ref ?? "",
    note: row.note,
  };
}

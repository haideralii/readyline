/**
 * Row types and vocabularies for the four registers (REQ-009 Session A,
 * FR-1; PO answers of 13 Oct 2026). These mirror
 * supabase/migrations/20261013000000_registers.sql column for column; the
 * CHECK constraints there are the source of truth and the integration test
 * exercises them. Dates are ISO `YYYY-MM-DD` strings as PostgREST returns
 * them; timestamps are ISO strings with an offset.
 *
 * Nothing here can hold a participant's name, date of birth, NDIS number,
 * address or health detail (CLAUDE.md 4.5): people are reference codes.
 */

/** The Commission's six reportable kinds first, then Readyline's own. */
export const INCIDENT_CATEGORIES = [
  "death",
  "serious-injury",
  "abuse-or-neglect",
  "unlawful-sexual-or-physical-contact",
  "sexual-misconduct",
  "restrictive-practice-unauthorised",
  "near-miss",
  "medication",
  "property-or-environment",
  "other",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

/** Reportable kinds notified within 24 hours (Rules s 20). */
export const INCIDENT_CATEGORIES_24H: readonly IncidentCategory[] = [
  "death",
  "serious-injury",
  "abuse-or-neglect",
  "unlawful-sexual-or-physical-contact",
  "sexual-misconduct",
];
/** Reportable kinds notified within 5 business days (Rules s 21), or 24 hours when the use caused harm (severity medium or high, D-902). */
export const INCIDENT_CATEGORIES_5BD: readonly IncidentCategory[] = [
  "restrictive-practice-unauthorised",
];

export const INCIDENT_SEVERITIES = ["low", "medium", "high"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

/** REQ-020 Session B: a report through the link or by a worker starts as a draft; the owner confirms or rejects it. */
export const INCIDENT_STATUSES = [
  "draft",
  "open",
  "under-review",
  "closed",
  "rejected",
] as const;
/** The statuses the owner's form may set (a draft is confirmed on its own screen). */
export const OWNER_INCIDENT_STATUSES = [
  "open",
  "under-review",
  "closed",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_EVENT_KINDS = [
  "created",
  "note",
  "status-change",
  "reportable-flagged",
  "notified",
  // REQ-020 Session B: the report link's trail.
  "reported",
  "confirmed",
  "rejected",
] as const;
export type IncidentEventKind = (typeof INCIDENT_EVENT_KINDS)[number];

export const COMPLAINT_CHANNELS = [
  "phone",
  "email",
  "in-person",
  "form",
  "advocate",
  "other",
] as const;
export type ComplaintChannel = (typeof COMPLAINT_CHANNELS)[number];

export const COMPLAINT_STATUSES = [
  "received",
  "acknowledged",
  "in-progress",
  "resolved",
  "escalated-to-commission",
  "withdrawn",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_EVENT_KINDS = [
  "created",
  "note",
  "status-change",
  "acknowledged",
  "resolved",
] as const;
export type ComplaintEventKind = (typeof COMPLAINT_EVENT_KINDS)[number];

/** Who raised a complaint, by code prefix (PO answer 1). */
export const COMPLAINT_FROM_PREFIXES = {
  P: "participant",
  FAM: "family member",
  ADV: "advocate",
  W: "worker",
  OTH: "other",
} as const;

export const CLEARANCE_KINDS = [
  "ndis-worker-screening",
  "wwcc",
  "police-check",
  "first-aid",
  "ndis-worker-orientation-module",
  // REQ-018 FR-8: the two mandatory-training kinds.
  "manual-handling",
  "medication",
  // REQ-024 A1 (FR-5, finding 128): CPR and the driver licence for transport supports.
  "cpr",
  "driver-licence",
  "other",
] as const;
export type ClearanceKind = (typeof CLEARANCE_KINDS)[number];

export const AU_STATES = [
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "ACT",
  "NT",
] as const;
export type AuState = (typeof AU_STATES)[number];

export const REMINDER_KINDS = [
  "clearance-expiry",
  "policy-review",
  // REQ-023 Session A (FR-3): the five timeline kinds, from the registration
  // period; `mid-term-audit` and `renewal` stay in the database CHECK for
  // the rows already sent and are no longer produced (finding 59).
  "midterm-prepare",
  "midterm-start-by",
  "renewal-window",
  "renewal-apply-by",
  "renewal-last-call",
  "incident-open",
  "complaint-unacknowledged",
  "reportable-not-notified",
  // REQ-018 Session C (FR-5, FR-8, FR-10; D-1905).
  "insurance-expiry",
  "supervision-due",
  "appraisal-due",
  "support-plan-review",
  "emergency-drill",
  "register-review",
  // REQ-020 Session B: the owner is nudged while a report waits.
  "report-to-confirm",
  // REQ-024 A1 (D-2416): a risk assessed role a current worker holds, unassessed, at 10 and 20 business days.
  "role-assessment-due",
] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** The tables a reminder can point at, the same list as the database CHECK. */
export const REMINDER_SUBJECT_TABLES = [
  "incidents",
  "complaints",
  "worker_clearances",
  "policy_reviews",
  "accounts",
  "insurance_items",
  "staff_matrix",
  "participant_risks",
  "corporate_risks",
  "conflicts_of_interest",
  // REQ-020 FR-7: the hazard register's review date.
  "hazards",
  // REQ-024 A1: the s 17 list's roles.
  "risk_assessed_roles",
  // REQ-023 FR-3: the five timeline kinds point at the period row (finding 58).
  "registration_periods",
] as const;
export type ReminderSubjectTable = (typeof REMINDER_SUBJECT_TABLES)[number];

export const REGISTRATION_KINDS = ["certification", "verification"] as const;
export type RegistrationKind = (typeof REGISTRATION_KINDS)[number];

/** Reference-code patterns, the same as the database CHECKs (SR-1). */
export const REF_PATTERNS = {
  /** P-014, PT-1: a participant or other person, never a name. */
  participant: /^[A-Z]{1,3}-?[0-9]{1,6}$/,
  /** W-003: a worker. */
  worker: /^W-?[0-9]{1,6}$/,
  /** P-, FAM-, ADV-, W-, OTH- followed by digits. */
  complaintFrom: /^(P|FAM|ADV|W|OTH)-?[0-9]{1,6}$/,
  /** Generated by the database: INC-0001. */
  incidentReference: /^INC-[0-9]{4,}$/,
  /** Generated by the database: CMP-0001. */
  complaintReference: /^CMP-[0-9]{4,}$/,
} as const;

/** Free-text caps, the same as the database CHECKs. */
export const TEXT_CAPS = {
  summary: 500,
  actionsTaken: 2000,
  outcome: 2000,
  eventNote: 1000,
  note: 500,
  roleLabel: 80,
  title: 120,
} as const;

/** The shape of an NDIS participant number (nine digits starting 43), rejected by every free-text CHECK. */
export const NDIS_NUMBER_SHAPE = /(^|[^0-9])43[0-9]{7}([^0-9]|$)/;

export type IncidentRow = {
  id: string;
  account_id: string;
  reference: string;
  occurred_on: string;
  reported_on: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  participant_ref: string | null;
  worker_ref: string | null;
  summary: string;
  actions_taken: string;
  reportable: boolean;
  reportable_notified_on: string | null;
  /** The reference the Commission gives back when told; "" until then (batch 45, REQ-018-gated item). */
  commission_reference: string;
  /** Generated: 24 hours or 5 business days after the later of `occurred_on` and `aware_on`, by category, when reportable; else null. */
  notify_by: string | null;
  status: IncidentStatus;
  closed_on: string | null;
  /** REQ-020 Session B: who logged it (owner, a worker, or the report link), the code or role of the reporter, the rejection reason, and when the provider became aware. */
  reported_via: "owner" | "worker" | "link";
  logged_by_ref: string | null;
  rejected_reason: string;
  aware_at: string;
  aware_on: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** What a client sends; the database assigns the reference, creator and timestamps. */
export type IncidentInsert = Omit<
  IncidentRow,
  | "id"
  | "reference"
  | "notify_by"
  | "created_by"
  | "created_at"
  | "updated_at"
  | "reported_on"
  | "actions_taken"
  | "reportable"
  | "reportable_notified_on"
  | "commission_reference"
  | "status"
  | "closed_on"
  | "participant_ref"
  | "worker_ref"
  | "reported_via"
  | "logged_by_ref"
  | "rejected_reason"
  | "aware_at"
  | "aware_on"
> &
  Partial<
    Pick<
      IncidentRow,
      | "reported_on"
      | "actions_taken"
      | "reportable"
      | "reportable_notified_on"
      | "commission_reference"
      | "status"
      | "closed_on"
      | "participant_ref"
      | "worker_ref"
      | "reported_via"
      | "logged_by_ref"
      | "created_by"
    >
  >;

export type IncidentEventRow = {
  id: string;
  incident_id: string;
  account_id: string;
  at: string;
  actor_user_id: string | null;
  kind: IncidentEventKind;
  note: string;
};

export type ComplaintRow = {
  id: string;
  account_id: string;
  reference: string;
  received_on: string;
  channel: ComplaintChannel;
  from_ref: string | null;
  summary: string;
  outcome: string;
  acknowledged_on: string | null;
  resolved_on: string | null;
  status: ComplaintStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplaintInsert = Pick<
  ComplaintRow,
  "account_id" | "received_on" | "channel" | "summary"
> &
  Partial<
    Pick<
      ComplaintRow,
      "from_ref" | "outcome" | "acknowledged_on" | "resolved_on" | "status"
    >
  >;

export type ComplaintEventRow = {
  id: string;
  complaint_id: string;
  account_id: string;
  at: string;
  actor_user_id: string | null;
  kind: ComplaintEventKind;
  note: string;
};

export type WorkerClearanceRow = {
  id: string;
  account_id: string;
  worker_ref: string;
  role_label: string;
  clearance_kind: ClearanceKind;
  /** Batch 45 item 22: the check number; Worker Screening Rules s 18(3)(d)(ii). */
  clearance_number: string;
  /** REQ-024 A1 (D-2419): the application number, s 18(3)(d)(i); a pending application is a row with this and no issue date. */
  application_number: string;
  /** Null while the application is pending (REQ-024 A1, finding 157). */
  issued_on: string | null;
  /** Null means no expiry (the orientation module). */
  expires_on: string | null;
  /** REQ-024 A1: the day the owner checked the row in the NDIS Worker Screening Database (s 15(4)); the owner's alone. */
  verified_in_database_on: string | null;
  state: AuState | null;
  note: string;
  created_at: string;
  updated_at: string;
};

export type WorkerClearanceInsert = Pick<
  WorkerClearanceRow,
  "account_id" | "worker_ref" | "role_label" | "clearance_kind"
> &
  Partial<
    Pick<
      WorkerClearanceRow,
      | "issued_on"
      | "expires_on"
      | "state"
      | "note"
      | "clearance_number"
      | "application_number"
      | "verified_in_database_on"
    >
  >;

export type PolicyReviewRow = {
  id: string;
  account_id: string;
  document_type_id: string;
  title: string;
  adopted_on: string | null;
  review_cycle_months: number;
  last_reviewed_on: string | null;
  /** Generated: the later of adopted and last reviewed, plus the cycle; null until adopted. */
  next_review_on: string | null;
  reviewer_ref: string | null;
  note: string;
  created_at: string;
  updated_at: string;
};

export type PolicyReviewInsert = Pick<
  PolicyReviewRow,
  "account_id" | "document_type_id"
> &
  Partial<
    Pick<
      PolicyReviewRow,
      | "title"
      | "adopted_on"
      | "review_cycle_months"
      | "last_reviewed_on"
      | "reviewer_ref"
      | "note"
    >
  >;

export type ReminderRow = {
  id: string;
  account_id: string;
  kind: ReminderKind;
  subject_table: ReminderSubjectTable;
  subject_id: string;
  due_on: string;
  send_on: string;
  sent_at: string | null;
  channel: "email";
  created_at: string;
};

/** The two FR-4 columns added to `accounts`. */
export type AccountRegistration = {
  registration_date: string | null;
  registration_kind: RegistrationKind | null;
};

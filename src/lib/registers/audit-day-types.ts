/**
 * Vocabularies and row types for the audit-day registers (REQ-018 Session
 * A, FR-1 to FR-9; D-1901). These mirror
 * supabase/migrations/20261014100000_audit_day_registers.sql column for
 * column; the CHECK constraints there are the source of truth and the
 * integration test exercises them. Nothing here can hold a participant's
 * name, date of birth, NDIS number, address or health detail (CLAUDE.md
 * 4.5, SR-2): people are reference codes, free text is capped.
 */

export const RISK_AREAS = [
  "emergency-and-disaster",
  "participant-related",
  "compliance",
  "people-and-staffing",
  "organisational-sustainability",
  "governance",
  "finance",
  "legislation-change",
  "data-and-privacy",
] as const;
export type RiskArea = (typeof RISK_AREAS)[number];

export const RISK_AREA_LABELS: Record<RiskArea, string> = {
  "emergency-and-disaster": "Emergency and disaster",
  "participant-related": "Participants",
  compliance: "Compliance",
  "people-and-staffing": "People and staffing",
  "organisational-sustainability": "Keeping the business going",
  governance: "Governance",
  finance: "Finance",
  "legislation-change": "Changes in the rules",
  "data-and-privacy": "Data and privacy",
};

export const LIKELIHOODS = ["low", "medium", "high"] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

export const DELEGATION_ROLES = [
  "owner-or-director",
  "key-management-personnel",
  "incident-reporter",
  "complaints-contact",
  "finance-approver",
  "worker-screening-checker",
  "other",
] as const;
export type DelegationRole = (typeof DELEGATION_ROLES)[number];

export const DELEGATION_ROLE_LABELS: Record<DelegationRole, string> = {
  "owner-or-director": "Owner or director",
  "key-management-personnel": "Key management personnel",
  "incident-reporter": "Incident reporter",
  "complaints-contact": "Complaints contact",
  "finance-approver": "Finance approver",
  "worker-screening-checker": "Worker screening checker",
  other: "Other role",
};

export const INSURANCE_KINDS = [
  "public-liability",
  "professional-indemnity",
  "workers-compensation",
  "personal-accident",
  "other-insurance",
  "vehicle-registration",
  "vehicle-insurance",
  "driver-licence",
] as const;
export type InsuranceKind = (typeof INSURANCE_KINDS)[number];

export const INSURANCE_KIND_LABELS: Record<InsuranceKind, string> = {
  "public-liability": "Public liability insurance",
  "professional-indemnity": "Professional indemnity insurance",
  "workers-compensation": "Workers compensation insurance",
  "personal-accident": "Personal accident insurance",
  "other-insurance": "Other insurance",
  "vehicle-registration": "Vehicle registration",
  "vehicle-insurance": "Vehicle insurance",
  "driver-licence": "Driver licence",
};

export const IMPROVEMENT_SOURCES = [
  "incident",
  "complaint",
  "feedback",
  "survey",
  "internal-audit",
  "external-audit",
  "other",
  // REQ-020 FR-9: a "no" in the quarterly self-check.
  "self-check",
] as const;
export type ImprovementSource = (typeof IMPROVEMENT_SOURCES)[number];

export const IMPROVEMENT_SOURCE_LABELS: Record<ImprovementSource, string> = {
  incident: "An incident",
  complaint: "A complaint",
  feedback: "Feedback",
  survey: "A survey",
  "internal-audit": "Our own check",
  "external-audit": "The audit",
  other: "Something else",
  "self-check": "Our quarterly self-check",
};

/** REQ-020 FR-7: who a hazard could harm. */
export const HARM_TO = ["participant", "worker", "visitor"] as const;
export type HarmTo = (typeof HARM_TO)[number];
export const HARM_TO_LABELS: Record<HarmTo, string> = {
  participant: "A participant",
  worker: "A worker",
  visitor: "A visitor",
};

export const ONBOARDING_KINDS = ["worker", "participant"] as const;
export type OnboardingKind = (typeof ONBOARDING_KINDS)[number];

export const AUDIT_DAY_REGISTERS = [
  "corporate_risks",
  "participant_risks",
  "conflicts_of_interest",
  "delegations",
  "insurance_items",
  "improvements",
  "staff_matrix",
  "onboarding_checklists",
  // REQ-020 FR-7.
  "hazards",
  // REQ-024 A1 (finding 66): the derived items' state and the s 17 roles.
  "onboarding_items",
  "risk_assessed_roles",
  // REQ-024 A2 (D-2434): the s 14 exception's rows.
  "screening_exceptions",
] as const;
export type AuditDayRegister = (typeof AUDIT_DAY_REGISTERS)[number];

export const REGISTER_EVENT_KINDS = [
  "created",
  "note",
  "reviewed",
  "updated",
  "closed",
  // REQ-020 FR-8: one line per row an import wrote.
  "imported",
  // REQ-024 A1: the owner's confirmation of an item, a role change with its fixed note, a worker ended.
  "confirmed",
  "role-changed",
  "ended",
  // REQ-024 A2 (D-2434): the s 14 exception's start and end, their notes in words, never a uuid.
  "exception-started",
  "exception-ended",
] as const;
export type RegisterEventKind = (typeof REGISTER_EVENT_KINDS)[number];

/** Reference-code patterns, the same as the database CHECKs. */
export const AUDIT_DAY_REF_PATTERNS = {
  /** W- worker, KP- key person, P- participant, FAM- family, OTH- other. */
  person: /^(W|KP|P|FAM|OTH)-?[0-9]{1,6}$/,
  /** W- worker or KP- key person. */
  staff: /^(W|KP)-?[0-9]{1,6}$/,
  /** P-014, PT-1: a participant, never a name. */
  participant: /^[A-Z]{1,3}-?[0-9]{1,6}$/,
  /** W-003: a worker. */
  worker: /^W-?[0-9]{1,6}$/,
} as const;

export const AUDIT_DAY_TEXT_CAPS = {
  short: 500,
  long: 2000,
  role: 80,
  label: 120,
  decision: 300,
  note: 500,
  eventNote: 1000,
  sourceRef: 40,
  policyNumber: 80,
} as const;

/** Review states the status views compute (review_status in the migration). */
export type ReviewState = "no-date" | "overdue" | "due-soon" | "current";
export const REVIEW_DUE_SOON_DAYS = 30;
export const INSURANCE_EXPIRING_DAYS = 30;
export const SUPERVISION_DAYS = 31;
export const APPRAISAL_DAYS = 365;

export type CorporateRiskRow = {
  id: string;
  account_id: string;
  area: RiskArea;
  what_could_happen: string;
  likelihood: Likelihood;
  controls: string;
  owner_role: string;
  review_on: string;
  starter: boolean;
  created_at: string;
  updated_at: string;
};

export type ParticipantRiskRow = {
  id: string;
  account_id: string;
  participant_ref: string;
  risk: string;
  controls: string;
  review_on: string;
  support_plan_review_on: string | null;
  created_at: string;
  updated_at: string;
};

export type ConflictOfInterestRow = {
  id: string;
  account_id: string;
  who_ref: string;
  conflict: string;
  managed_by: string;
  declared_on: string;
  review_on: string;
  created_at: string;
  updated_at: string;
};

export type DelegationRow = {
  id: string;
  account_id: string;
  role: DelegationRole;
  role_label: string;
  holder_ref: string;
  backup_ref: string | null;
  backup_may: string;
  created_at: string;
  updated_at: string;
};

export type InsuranceItemRow = {
  id: string;
  account_id: string;
  kind: InsuranceKind;
  label: string;
  policy_number: string;
  expires_on: string;
  note: string;
  created_at: string;
  updated_at: string;
};

/** REQ-020 FR-7: a hazard, by site or vehicle code. */
export type HazardRow = {
  id: string;
  account_id: string;
  site_ref: string;
  hazard: string;
  harm_to: HarmTo;
  likelihood: Likelihood;
  severity: Likelihood;
  controls: string;
  due_on: string;
  done_on: string | null;
  review_on: string;
  created_at: string;
  updated_at: string;
};

export type ImprovementRow = {
  id: string;
  account_id: string;
  source_kind: ImprovementSource;
  source_ref: string;
  learned: string;
  changed: string;
  owner_role: string;
  due_on: string;
  done_on: string | null;
  created_at: string;
  updated_at: string;
};

export type DecisionRow = {
  id: string;
  account_id: string;
  decided_on: string;
  decision: string;
  decided_by: string;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type StaffMatrixRow = {
  id: string;
  account_id: string;
  worker_ref: string;
  role_label: string;
  qualifications: string;
  risk_assessed: boolean;
  started_on: string | null;
  last_supervision_on: string | null;
  last_appraisal_on: string | null;
  onboarding_signed_on: string | null;
  note: string;
  // REQ-024 A1 (FR-1): the closed role, the states served, the two flags, the end, the s 17 role and the s 20 dates.
  role: string | null;
  states: string[];
  works_with_children: boolean;
  may_use_restrictive_practice: boolean;
  ended_on: string | null;
  role_ref: string | null;
  risk_assessed_from: string | null;
  risk_paragraph: string | null;
  created_at: string;
  updated_at: string;
};

/** REQ-024 A1 (Data): the mutable state of one derived item; numbers and expiries live on the clearance row (D-2419). */
export type OnboardingItemRow = {
  id: string;
  account_id: string;
  checklist_id: string;
  item_id: string;
  owner_role: "owner" | "worker" | "both";
  done_on: string | null;
  confirmed_on: string | null;
  recorded_by_owner: boolean;
  note: string;
  created_at: string;
  updated_at: string;
};

/** REQ-024 A1 (Data, D-2416): one s 17 role; the assessor is a code, the name a fill field. */
export type RiskAssessedRoleRow = {
  id: string;
  account_id: string;
  title: string;
  paragraphs: string[];
  description: string;
  assessed_on: string | null;
  assessor_ref: string | null;
  first_held_on: string | null;
  seed_code: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingChecklistRow = {
  id: string;
  account_id: string;
  kind: OnboardingKind;
  subject_ref: string;
  started_on: string;
  completed_on: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingTickRow = {
  id: string;
  checklist_id: string;
  account_id: string;
  item_id: string;
  ticked_on: string;
  ticked_by_ref: string;
  actor_user_id: string | null;
  created_at: string;
};

export type RegisterEventRow = {
  id: string;
  account_id: string;
  register: AuditDayRegister;
  row_id: string;
  at: string;
  actor_user_id: string | null;
  kind: RegisterEventKind;
  note: string;
};

/** REQ-024 A2 (D-2434): one s 14 exception as the table holds it; the pinned version is an id, the notes carry words. */
export type ScreeningExceptionRow = {
  id: string;
  account_id: string;
  worker_ref: string;
  clearance_id: string | null;
  code: "s14-1a" | "s14-1b" | "s14-1c" | "s14-2a" | "s14-2b";
  part4_state: string | null;
  started_on: string;
  verified_on: string | null;
  notice_seen_on: string | null;
  supervisor_ref: string | null;
  declaration_on: string | null;
  plan_version_id: string | null;
  plan_register_date: string | null;
  ended_on: string | null;
  end_code:
    | "clearance-issued"
    | "excluded"
    | "interim-bar"
    | "supervision-stopped"
    | "plan-stopped"
    | "withdrawn"
    | "closed"
    | "supervisor-clearance-expired"
    | null;
  created_at: string;
  updated_at: string;
};

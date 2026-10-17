/**
 * Form schemas, field specs and list rules for the audit-day registers
 * (REQ-018 Session B, FR-1 to FR-9; D-1904). One generic form and one
 * generic list page serve all nine registers from this data, so a register
 * is a schema, a field list and three small functions. Keys are the
 * database column names; the same patterns and caps as the CHECKs in
 * supabase/migrations/20261014100000_audit_day_registers.sql, validated on
 * the client for instant messages and again in the server action. Every
 * message is plain words (REQ-015 FR-1); people are reference codes and
 * free text refuses an NDIS-number shape (SR-2).
 */
import { z } from "zod";
import { strictObject, text } from "@/lib/validation";
import {
  AUDIT_DAY_REF_PATTERNS,
  AUDIT_DAY_TEXT_CAPS,
  DELEGATION_ROLES,
  DELEGATION_ROLE_LABELS,
  HARM_TO,
  HARM_TO_LABELS,
  type HazardRow,
  IMPROVEMENT_SOURCES,
  IMPROVEMENT_SOURCE_LABELS,
  INSURANCE_KINDS,
  INSURANCE_KIND_LABELS,
  LIKELIHOODS,
  ONBOARDING_KINDS,
  RISK_AREAS,
  RISK_AREA_LABELS,
  type ConflictOfInterestRow,
  type CorporateRiskRow,
  type DecisionRow,
  type DelegationRow,
  type ImprovementRow,
  type InsuranceItemRow,
  type OnboardingChecklistRow,
  type ParticipantRiskRow,
  type StaffMatrixRow,
} from "./audit-day-types";
import {
  RISK_PARAGRAPH_LABELS,
  RISK_PARAGRAPHS,
  WORKER_ROLE_LABELS,
  WORKER_ROLES,
} from "./onboarding-items";
import { AU_STATES, NDIS_NUMBER_SHAPE } from "./types";
import { dateField } from "./forms";
// #74's run 38858109250: a raw ISO date in a list's detail line breaks at its
// hyphen at 360 px (`2027-02-13` read "2027-02-" and "13."), so every date a
// `detailOf` prints is the long form, "13 February 2027".
import { formatLongDate } from "./status";
import {
  CONFLICT_COLUMNS,
  CORPORATE_RISK_COLUMNS,
  DECISION_COLUMNS,
  DELEGATION_COLUMNS,
  HAZARD_COLUMNS,
  IMPROVEMENT_COLUMNS,
  INSURANCE_COLUMNS,
  ONBOARDING_COLUMNS,
  PARTICIPANT_RISK_COLUMNS,
  STAFF_MATRIX_COLUMNS,
  type ColumnSpec,
} from "./table-columns";

const optionalDate = (label: string) =>
  z
    .union([z.literal(""), dateField(label)])
    .transform((v) => (v === "" ? null : v));

const safeText = (max: number, min = 0, required?: string) =>
  text(max, min, required).refine(
    (v) => !NDIS_NUMBER_SHAPE.test(v),
    "This looks like an NDIS participant number. Use a reference code instead.",
  );

const refField = (pattern: RegExp, hint: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(pattern, `Use a code like ${hint}, never a name`);

const optionalRef = (pattern: RegExp, hint: string) =>
  z
    .union([z.literal(""), refField(pattern, hint)])
    .transform((v) => (v === "" ? null : v));

/* ---------- field specs for the generic form ---------- */

export type FieldSpec = {
  name: string;
  label: string;
  kind:
    | "text"
    | "textarea"
    | "date"
    | "ref"
    | "select"
    | "checkbox"
    // REQ-024 A1 (FR-1): the states a worker works in, a checkbox per state, kept as a comma-joined string in the form.
    | "states";
  /** For a ref field: the example code. */
  hint?: string;
  help?: string;
  optional?: boolean;
  maxLength?: number;
  rows?: number;
  options?: { value: string; label: string }[];
};

const opts = <V extends string>(
  values: readonly V[],
  labels: Record<V, string>,
) => values.map((value) => ({ value, label: labels[value] }));

const LIKELIHOOD_LABELS = {
  low: "Low: unlikely",
  medium: "Medium: could happen this year",
  high: "High: likely or has happened",
} as const;

/* ---------- FR-1 corporate risks ---------- */

export const CorporateRiskForm = strictObject({
  area: z.enum(RISK_AREAS, { error: "Choose the risk area" }),
  what_could_happen: safeText(
    AUDIT_DAY_TEXT_CAPS.short,
    1,
    "Say what could happen",
  ),
  likelihood: z.enum(LIKELIHOODS, { error: "Choose how likely it is" }),
  controls: safeText(AUDIT_DAY_TEXT_CAPS.long, 1, "Say what you do about it"),
  owner_role: safeText(
    AUDIT_DAY_TEXT_CAPS.role,
    1,
    "Name the role that owns it",
  ),
  review_on: dateField("review date"),
});
export const CORPORATE_RISK_FIELDS: FieldSpec[] = [
  {
    name: "area",
    label: "Risk area",
    kind: "select",
    options: opts(RISK_AREAS, RISK_AREA_LABELS),
  },
  {
    name: "what_could_happen",
    label: "What could happen",
    kind: "textarea",
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 3,
  },
  {
    name: "likelihood",
    label: "How likely",
    kind: "select",
    options: opts(LIKELIHOODS, LIKELIHOOD_LABELS),
  },
  {
    name: "controls",
    label: "What we do about it",
    kind: "textarea",
    help: "The controls: the policy, the check, the habit that keeps it from happening.",
    maxLength: AUDIT_DAY_TEXT_CAPS.long,
    rows: 4,
  },
  {
    name: "owner_role",
    label: "Who owns this risk",
    kind: "text",
    help: "A role, never a person: Owner, Director, Team leader.",
    maxLength: AUDIT_DAY_TEXT_CAPS.role,
  },
  { name: "review_on", label: "Review by", kind: "date" },
];

/* ---------- REQ-020 FR-7 hazards ---------- */

const SEVERITY_LABELS = {
  low: "Low: first aid at most",
  medium: "Medium: medical treatment or time off",
  high: "High: serious injury or worse",
} as const;

export const HazardForm = strictObject({
  site_ref: refField(/^[A-Z]{1,3}-?[0-9]{1,6}$/, "S-01 or V-02"),
  hazard: safeText(AUDIT_DAY_TEXT_CAPS.short, 1, "Say what the hazard is"),
  harm_to: z.enum(HARM_TO, { error: "Choose who it could harm" }),
  likelihood: z.enum(LIKELIHOODS, { error: "Choose how likely it is" }),
  severity: z.enum(LIKELIHOODS, { error: "Choose how serious it could be" }),
  controls: safeText(AUDIT_DAY_TEXT_CAPS.long, 1, "Say what you did about it"),
  due_on: dateField("done-by date"),
  done_on: optionalDate("date it was done"),
  review_on: dateField("review date"),
});
export const HAZARD_FIELDS: FieldSpec[] = [
  {
    name: "site_ref",
    label: "Where",
    kind: "ref",
    hint: "S-01 or V-02",
    help: "A code for the site or the vehicle, never an address. Keep the list of what each code means in your own records.",
  },
  {
    name: "hazard",
    label: "The hazard",
    kind: "textarea",
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 3,
  },
  {
    name: "harm_to",
    label: "Who it could harm",
    kind: "select",
    options: opts(HARM_TO, HARM_TO_LABELS),
  },
  {
    name: "likelihood",
    label: "How likely",
    kind: "select",
    options: opts(LIKELIHOODS, LIKELIHOOD_LABELS),
  },
  {
    name: "severity",
    label: "How serious",
    kind: "select",
    options: opts(LIKELIHOODS, SEVERITY_LABELS),
  },
  {
    name: "controls",
    label: "What we did",
    kind: "textarea",
    help: "The fix, the sign, the training, the new habit.",
    maxLength: AUDIT_DAY_TEXT_CAPS.long,
    rows: 4,
  },
  { name: "due_on", label: "Done by", kind: "date" },
  { name: "done_on", label: "Done on", kind: "date", optional: true },
  { name: "review_on", label: "Review by", kind: "date" },
];

/* ---------- FR-2 participant risks ---------- */

export const ParticipantRiskForm = strictObject({
  participant_ref: refField(AUDIT_DAY_REF_PATTERNS.participant, "P-014"),
  risk: safeText(AUDIT_DAY_TEXT_CAPS.short, 1, "Say what the risk is"),
  controls: safeText(AUDIT_DAY_TEXT_CAPS.long, 1, "Say what you do about it"),
  review_on: dateField("review date"),
  support_plan_review_on: optionalDate("support plan review date"),
});
export const PARTICIPANT_RISK_FIELDS: FieldSpec[] = [
  {
    name: "participant_ref",
    label: "Participant code",
    kind: "ref",
    hint: "P-014",
    help: "Initials or a code, never a name. Keep the list of codes in your own records.",
  },
  {
    name: "risk",
    label: "The risk",
    kind: "textarea",
    help: "No health details here: say what could happen during a support, not a diagnosis.",
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 3,
  },
  {
    name: "controls",
    label: "What we do about it",
    kind: "textarea",
    maxLength: AUDIT_DAY_TEXT_CAPS.long,
    rows: 3,
  },
  { name: "review_on", label: "Review by", kind: "date" },
  {
    name: "support_plan_review_on",
    label: "Support plan review date",
    kind: "date",
    help: "We remind you before it. Leave blank if there is no plan yet.",
    optional: true,
  },
];

/* ---------- FR-3 conflicts of interest ---------- */

export const ConflictOfInterestForm = strictObject({
  who_ref: refField(AUDIT_DAY_REF_PATTERNS.person, "W-003 or P-014"),
  conflict: safeText(AUDIT_DAY_TEXT_CAPS.short, 1, "Say what the conflict is"),
  managed_by: safeText(AUDIT_DAY_TEXT_CAPS.long, 1, "Say how you manage it"),
  declared_on: dateField("date it was declared"),
  review_on: dateField("review date"),
}).superRefine((v, ctx) => {
  if (v.review_on < v.declared_on)
    ctx.addIssue({
      code: "custom",
      path: ["review_on"],
      message: "The review date cannot be before the declaration",
    });
});
export const CONFLICT_FIELDS: FieldSpec[] = [
  {
    name: "who_ref",
    label: "Who",
    kind: "ref",
    hint: "W-003, KP-1 or P-014",
    help: "A worker (W-), key person (KP-), participant (P-), family member (FAM-) or other (OTH-) code.",
  },
  {
    name: "conflict",
    label: "The conflict, in plain words",
    kind: "textarea",
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 3,
  },
  {
    name: "managed_by",
    label: "How we manage it",
    kind: "textarea",
    maxLength: AUDIT_DAY_TEXT_CAPS.long,
    rows: 3,
  },
  { name: "declared_on", label: "Declared on", kind: "date" },
  { name: "review_on", label: "Review by", kind: "date" },
];

/* ---------- FR-4 delegations ---------- */

export const DelegationForm = strictObject({
  role: z.enum(DELEGATION_ROLES, { error: "Choose the role" }),
  role_label: safeText(AUDIT_DAY_TEXT_CAPS.role),
  holder_ref: refField(AUDIT_DAY_REF_PATTERNS.staff, "KP-1 or W-003"),
  backup_ref: optionalRef(AUDIT_DAY_REF_PATTERNS.staff, "W-004"),
  backup_may: safeText(AUDIT_DAY_TEXT_CAPS.short),
}).superRefine((v, ctx) => {
  if (v.role === "other" && !v.role_label)
    ctx.addIssue({
      code: "custom",
      path: ["role_label"],
      message: "Name the role",
    });
});
export const DELEGATION_FIELDS: FieldSpec[] = [
  {
    name: "role",
    label: "Role",
    kind: "select",
    options: opts(DELEGATION_ROLES, DELEGATION_ROLE_LABELS),
  },
  {
    name: "role_label",
    label: "Name of the role (if other)",
    kind: "text",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.role,
  },
  {
    name: "holder_ref",
    label: "Who holds it",
    kind: "ref",
    hint: "KP-1 or W-003",
  },
  {
    name: "backup_ref",
    label: "Backup",
    kind: "ref",
    hint: "W-004",
    optional: true,
  },
  {
    name: "backup_may",
    label: "What the backup may do when the holder is away",
    kind: "textarea",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 2,
  },
];

/* ---------- FR-5 insurances and vehicles ---------- */

export const InsuranceItemForm = strictObject({
  kind: z.enum(INSURANCE_KINDS, { error: "Choose the kind" }),
  label: safeText(
    AUDIT_DAY_TEXT_CAPS.label,
    1,
    "Name the insurer, the vehicle code or the driver code",
  ),
  policy_number: safeText(AUDIT_DAY_TEXT_CAPS.policyNumber),
  expires_on: dateField("expiry date"),
  note: safeText(AUDIT_DAY_TEXT_CAPS.note),
});
export const INSURANCE_FIELDS: FieldSpec[] = [
  {
    name: "kind",
    label: "Kind",
    kind: "select",
    options: opts(INSURANCE_KINDS, INSURANCE_KIND_LABELS),
  },
  {
    name: "label",
    label: "Insurer, vehicle or driver",
    kind: "text",
    help: "The insurer's name, a vehicle code (V-01) or a driver's worker code (W-003). Never a number plate or a person's name.",
    maxLength: AUDIT_DAY_TEXT_CAPS.label,
  },
  {
    name: "policy_number",
    label: "Policy number",
    kind: "text",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.policyNumber,
  },
  {
    name: "expires_on",
    label: "Expires on",
    kind: "date",
    help: "We remind you 30 and 7 days before.",
  },
  {
    name: "note",
    label: "Note",
    kind: "textarea",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.note,
    rows: 2,
  },
];

/* ---------- FR-6 improvements ---------- */

export const ImprovementForm = strictObject({
  source_kind: z.enum(IMPROVEMENT_SOURCES, {
    error: "Choose where you learned this",
  }),
  source_ref: safeText(AUDIT_DAY_TEXT_CAPS.sourceRef),
  learned: safeText(AUDIT_DAY_TEXT_CAPS.short, 1, "Say what you learned"),
  changed: safeText(AUDIT_DAY_TEXT_CAPS.long, 1, "Say what you changed"),
  owner_role: safeText(AUDIT_DAY_TEXT_CAPS.role, 1, "Name the role doing it"),
  due_on: dateField("done-by date"),
  done_on: optionalDate("date it was done"),
});
export const IMPROVEMENT_FIELDS: FieldSpec[] = [
  {
    name: "source_kind",
    label: "What we learned from",
    kind: "select",
    options: opts(IMPROVEMENT_SOURCES, IMPROVEMENT_SOURCE_LABELS),
  },
  {
    name: "source_ref",
    label: "Reference",
    kind: "text",
    help: "The incident or complaint code, such as INC-0003, if there is one.",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.sourceRef,
  },
  {
    name: "learned",
    label: "What we learned",
    kind: "textarea",
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 3,
  },
  {
    name: "changed",
    label: "What we changed",
    kind: "textarea",
    help: "The policy, the form, the habit. Say it as a change, not a plan.",
    maxLength: AUDIT_DAY_TEXT_CAPS.long,
    rows: 3,
  },
  {
    name: "owner_role",
    label: "Who does it",
    kind: "text",
    maxLength: AUDIT_DAY_TEXT_CAPS.role,
  },
  { name: "due_on", label: "Done by", kind: "date" },
  { name: "done_on", label: "Done on", kind: "date", optional: true },
];

/* ---------- FR-7 decisions (append only) ---------- */

export const DecisionForm = strictObject({
  decided_on: dateField("date of the decision"),
  decision: safeText(AUDIT_DAY_TEXT_CAPS.decision, 1, "Say what was decided"),
  decided_by: safeText(AUDIT_DAY_TEXT_CAPS.role, 1, "Say who decided"),
  note: safeText(AUDIT_DAY_TEXT_CAPS.eventNote),
});
export const DECISION_FIELDS: FieldSpec[] = [
  { name: "decided_on", label: "Decided on", kind: "date" },
  {
    name: "decision",
    label: "The decision, in one line",
    kind: "textarea",
    maxLength: AUDIT_DAY_TEXT_CAPS.decision,
    rows: 2,
  },
  {
    name: "decided_by",
    label: "Who decided",
    kind: "text",
    help: "A code (KP-1) or a body (the board).",
    maxLength: AUDIT_DAY_TEXT_CAPS.role,
  },
  {
    name: "note",
    label: "Note",
    kind: "textarea",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.eventNote,
    rows: 3,
  },
];

/* ---------- FR-8 staff matrix ---------- */

/** REQ-024 A1 (FR-1): the states a worker works in, typed in the form as "NSW,VIC" and stored as an array. */
const StatesField = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  )
  .pipe(
    z.array(z.enum(AU_STATES), {
      error: "Choose the states from the list",
    }),
  );

export const StaffMatrixForm = strictObject({
  worker_ref: refField(AUDIT_DAY_REF_PATTERNS.worker, "W-003"),
  // REQ-024 A1 (FR-1): the closed role beside the free label; "" means not chosen yet (existing rows).
  role: z
    .union([z.literal(""), z.enum(WORKER_ROLES)])
    .default("")
    .transform((v) => (v === "" ? null : v)),
  role_label: safeText(AUDIT_DAY_TEXT_CAPS.role, 1, "Enter the role"),
  qualifications: safeText(AUDIT_DAY_TEXT_CAPS.short),
  risk_assessed: z.boolean(),
  risk_paragraph: z
    .union([z.literal(""), z.enum(RISK_PARAGRAPHS)])
    .default("")
    .transform((v) => (v === "" ? null : v)),
  states: StatesField,
  works_with_children: z.boolean().default(false),
  may_use_restrictive_practice: z.boolean().default(false),
  // FR-1 (finding 64): the owner's own row; the action links the membership to the code through `set_owner_worker_ref`.
  is_me: z.boolean().default(false),
  started_on: optionalDate("start date"),
  ended_on: optionalDate("end date"),
  last_supervision_on: optionalDate("last supervision date"),
  last_appraisal_on: optionalDate("last appraisal date"),
  onboarding_signed_on: optionalDate("onboarding sign-off date"),
  note: safeText(AUDIT_DAY_TEXT_CAPS.note),
});
export const STAFF_MATRIX_FIELDS: FieldSpec[] = [
  {
    name: "worker_ref",
    label: "Worker code",
    kind: "ref",
    hint: "W-003",
    help: "The same code as in the worker checks register, so training and clearance dates line up. Never a name.",
  },
  {
    name: "is_me",
    label: "This row is me",
    kind: "checkbox",
    help: "Tick once for your own row: you are a worker too, and your clearance is checked like everyone's.",
  },
  {
    name: "role",
    label: "Kind of role",
    kind: "select",
    options: opts(WORKER_ROLES, WORKER_ROLE_LABELS),
    optional: true,
    help: "Key personnel are always risk assessed, and so is your own row.",
  },
  {
    name: "role_label",
    label: "Role title",
    kind: "text",
    maxLength: AUDIT_DAY_TEXT_CAPS.role,
  },
  {
    name: "qualifications",
    label: "Qualifications",
    kind: "textarea",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 2,
  },
  {
    name: "risk_assessed",
    label: "Risk-assessed role",
    kind: "checkbox",
    help: "Tick if the role needs an NDIS Worker Screening clearance: key personnel, direct delivery of supports, or more than incidental contact with a participant.",
  },
  {
    name: "risk_paragraph",
    label: "Which paragraph of the definition applies",
    kind: "select",
    options: opts(RISK_PARAGRAPHS, RISK_PARAGRAPH_LABELS),
    optional: true,
    help: "Worker Screening Rules s 5. Delivering equipment with training is more than incidental contact; the back-office accountant is not.",
  },
  {
    name: "states",
    label: "States this worker works in",
    kind: "states",
    help: "The clearance rules differ by state; the worker's list uses these.",
  },
  {
    name: "works_with_children",
    label: "Works with children",
    kind: "checkbox",
    help: "Tick if the role is child-related work; the working with children check joins the list.",
  },
  {
    name: "may_use_restrictive_practice",
    label: "May use a restrictive practice",
    kind: "checkbox",
    help: "Tick if this worker may use one under a behaviour support plan.",
  },
  { name: "started_on", label: "Started on", kind: "date", optional: true },
  {
    name: "ended_on",
    label: "Ended on",
    kind: "date",
    optional: true,
    help: "A worker who has left stays on the list under past workers for seven years.",
  },
  {
    name: "last_supervision_on",
    label: "Last supervision",
    kind: "date",
    // Readyline's suggestion, not a rule: the Practice Standards ask for
    // timely supervision and set no interval (retro review of REQ-018, finding 10).
    help: "We suggest monthly; we remind you when a month has passed.",
    optional: true,
  },
  {
    name: "last_appraisal_on",
    label: "Last appraisal",
    kind: "date",
    help: "We suggest yearly.",
    optional: true,
  },
  {
    name: "onboarding_signed_on",
    label: "Onboarding checklist signed on",
    kind: "date",
    help: "Filled in for you when the worker's onboarding checklist is complete.",
    optional: true,
  },
  {
    name: "note",
    label: "Note",
    kind: "textarea",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.note,
    rows: 2,
  },
];

/* ---------- FR-9 onboarding checklists ---------- */

export const OnboardingChecklistForm = strictObject({
  kind: z.enum(ONBOARDING_KINDS, {
    error: "Choose a worker or a participant checklist",
  }),
  subject_ref: refField(AUDIT_DAY_REF_PATTERNS.participant, "W-003 or P-014"),
  started_on: dateField("start date"),
});
export const ONBOARDING_FIELDS: FieldSpec[] = [
  {
    name: "kind",
    label: "Checklist for",
    kind: "select",
    options: [
      { value: "worker", label: "A new worker" },
      { value: "participant", label: "A new participant" },
    ],
  },
  {
    name: "subject_ref",
    label: "Their code",
    kind: "ref",
    hint: "W-003 or P-014",
  },
  { name: "started_on", label: "Started on", kind: "date" },
];

export const OnboardingTickForm = strictObject({
  checklist_id: z.string().uuid(),
  item_id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  ticked_on: dateField("date"),
  ticked_by_ref: refField(AUDIT_DAY_REF_PATTERNS.staff, "KP-1 or W-003"),
});

/* ---------- the register table ---------- */

export const AUDIT_DAY_SLUGS = [
  "corporate-risks",
  "participant-risks",
  "conflicts-of-interest",
  "delegations",
  "insurances",
  "improvements",
  "decisions",
  "staff-matrix",
  "onboarding",
  // REQ-020 FR-7.
  "hazards",
] as const;
export type AuditDaySlug = (typeof AUDIT_DAY_SLUGS)[number];

export type ListStatus = {
  key: string;
  label: string;
  tone: "moss" | "ochre" | "signal" | "slate";
};

/** The review-date states the status views compute, as a tag. */
export function reviewTag(status: string, reviewOn: string | null): ListStatus {
  if (status === "overdue")
    return {
      key: "overdue",
      label: `Review overdue ${reviewOn}`,
      tone: "signal",
    };
  if (status === "due-soon")
    return { key: "due-soon", label: `Review by ${reviewOn}`, tone: "ochre" };
  if (status === "no-date")
    return { key: "no-date", label: "No review date", tone: "slate" };
  return { key: "current", label: `Reviewed, next ${reviewOn}`, tone: "moss" };
}

const REVIEW_FILTERS = [
  { key: "overdue", label: "Overdue" },
  { key: "due-soon", label: "Due soon" },
  { key: "current", label: "Current" },
];

export type RegisterMeta<Row> = {
  slug: AuditDaySlug;
  table: string;
  /** The status view the list reads, or the table when there is none. */
  view: string;
  title: string;
  singular: string;
  intro: string;
  addLabel: string;
  empty: string;
  /** Append-only registers have no edit page. */
  appendOnly?: boolean;
  fields: FieldSpec[];
  schema: z.ZodType;
  filters: { key: string; label: string }[];
  titleOf: (row: Row) => string;
  detailOf: (row: Row) => string;
  statusOf: (row: Row) => ListStatus;
  orderBy: { column: string; ascending: boolean };
  /** REQ-028 FR-8 (D-2814): the table's columns as data; empty keeps the list form at every width. */
  columns: readonly ColumnSpec<Row>[];
};

type Statused<R> = R & { status: string };

// Typed as the map so every entry carries the optional fields (appendOnly); the row type is checked per entry by `satisfies`.
export const AUDIT_DAY_META: Record<AuditDaySlug, RegisterMeta<never>> = {
  "corporate-risks": {
    slug: "corporate-risks",
    table: "corporate_risks",
    view: "corporate_risks_status",
    title: "Corporate risks",
    singular: "risk",
    intro:
      "One row per risk to the business, with what you do about it and a review date. Auditors look for every area filled and a date on every row. The first rows came from your answers: check each one and change it.",
    addLabel: "Add a risk",
    empty:
      "No risks yet. Open the register once and the nine starter rows appear.",
    fields: CORPORATE_RISK_FIELDS,
    schema: CorporateRiskForm,
    filters: REVIEW_FILTERS,
    titleOf: (r) => `${RISK_AREA_LABELS[r.area]}: ${r.what_could_happen}`,
    detailOf: (r) =>
      `${r.likelihood[0].toUpperCase()}${r.likelihood.slice(1)} likelihood. Owner: ${r.owner_role}.${r.starter ? " Starter row: check this and change it." : ""}`,
    statusOf: (r) => reviewTag(r.status, r.review_on),
    orderBy: { column: "review_on", ascending: true },
    columns: CORPORATE_RISK_COLUMNS,
  } satisfies RegisterMeta<Statused<CorporateRiskRow>>,
  hazards: {
    slug: "hazards",
    table: "hazards",
    view: "hazards_status",
    title: "Hazards",
    singular: "hazard",
    intro:
      "One row per hazard to a participant, a worker or a visitor: where it is (a code for the site or vehicle), what you did about it, by when, and a review date. Auditors look for the fix and the date, not the form. If a hazard was behind an incident, add it from the incident.",
    addLabel: "Add a hazard",
    empty:
      "No hazards yet. Walk your sites and vehicles once and add what you find; a trip hazard, a hot surface, a loose rail.",
    fields: HAZARD_FIELDS,
    schema: HazardForm,
    filters: REVIEW_FILTERS,
    titleOf: (r) => `${r.site_ref}: ${r.hazard}`,
    detailOf: (r) =>
      `Could harm ${HARM_TO_LABELS[r.harm_to].toLowerCase()}. ${r.likelihood[0].toUpperCase()}${r.likelihood.slice(1)} likelihood, ${r.severity} severity. ${r.done_on ? `Done ${formatLongDate(r.done_on)}.` : `Due ${formatLongDate(r.due_on)}.`}`,
    statusOf: (r) => reviewTag(r.status, r.review_on),
    orderBy: { column: "review_on", ascending: true },
    columns: HAZARD_COLUMNS,
  } satisfies RegisterMeta<Statused<HazardRow>>,
  "participant-risks": {
    slug: "participant-risks",
    table: "participant_risks",
    view: "participant_risks_status",
    title: "Participant risks",
    singular: "participant risk",
    intro:
      "One row per participant: the risk, what you do about it and a review date. Codes only, never names or health details; the auditor wants to see that each person's risks are known and reviewed.",
    addLabel: "Add a participant",
    empty:
      "No participant risks yet. Add one row per participant, by code, with the risk and what you do about it.",
    fields: PARTICIPANT_RISK_FIELDS,
    schema: ParticipantRiskForm,
    filters: REVIEW_FILTERS,
    titleOf: (r) => `${r.participant_ref}: ${r.risk}`,
    detailOf: (r) =>
      r.support_plan_review_on
        ? `Support plan review ${formatLongDate(r.support_plan_review_on)}.`
        : "No support plan review date yet.",
    statusOf: (r) => reviewTag(r.status, r.review_on),
    orderBy: { column: "review_on", ascending: true },
    columns: PARTICIPANT_RISK_COLUMNS,
  } satisfies RegisterMeta<Statused<ParticipantRiskRow>>,
  "conflicts-of-interest": {
    slug: "conflicts-of-interest",
    table: "conflicts_of_interest",
    view: "conflicts_of_interest_status",
    title: "Conflicts of interest",
    singular: "conflict",
    intro:
      "Who has a conflict, what it is and how you manage it, for workers and participants alike, with a review date. Your conflict of interest policy says this register exists; this is it.",
    addLabel: "Add a conflict",
    empty:
      "No conflicts recorded. If there are none, that is worth a line in the record of decisions.",
    fields: CONFLICT_FIELDS,
    schema: ConflictOfInterestForm,
    filters: REVIEW_FILTERS,
    titleOf: (r) => `${r.who_ref}: ${r.conflict}`,
    detailOf: (r) =>
      `Declared ${formatLongDate(r.declared_on)}. ${r.managed_by}`,
    statusOf: (r) => reviewTag(r.status, r.review_on),
    orderBy: { column: "review_on", ascending: true },
    columns: CONFLICT_COLUMNS,
  } satisfies RegisterMeta<Statused<ConflictOfInterestRow>>,
  delegations: {
    slug: "delegations",
    table: "delegations",
    view: "delegations",
    title: "Delegations",
    singular: "delegation",
    intro:
      "Each key role, who holds it, who the backup is and what the backup may do when the holder is away. The auditor asks who acts when you cannot.",
    addLabel: "Add a role",
    empty:
      "No delegations yet. Start with the owner and who covers when you are away.",
    fields: DELEGATION_FIELDS,
    schema: DelegationForm,
    filters: [
      { key: "backed-up", label: "Has a backup" },
      { key: "no-backup", label: "No backup" },
    ],
    titleOf: (r) =>
      r.role === "other" ? r.role_label : DELEGATION_ROLE_LABELS[r.role],
    detailOf: (r) =>
      `Held by ${r.holder_ref}.${r.backup_ref ? ` Backup ${r.backup_ref}: ${r.backup_may || "may act in full"}.` : ""}`,
    statusOf: (r) =>
      r.backup_ref
        ? { key: "backed-up", label: "Backup named", tone: "moss" }
        : { key: "no-backup", label: "No backup", tone: "ochre" },
    orderBy: { column: "role", ascending: true },
    columns: DELEGATION_COLUMNS,
  } satisfies RegisterMeta<DelegationRow & { status?: string }>,
  insurances: {
    slug: "insurances",
    table: "insurance_items",
    view: "insurance_items_status",
    title: "Insurances and vehicles",
    singular: "insurance or vehicle item",
    intro:
      "Each insurance policy, vehicle registration, vehicle insurance and driver licence with its expiry. We keep the dates only; the certificates stay in your own files. Reminders go out 30 and 7 days before.",
    addLabel: "Add an item",
    empty:
      "Nothing recorded yet. Add public liability, professional indemnity and workers compensation first, then any vehicle used for participant transport.",
    fields: INSURANCE_FIELDS,
    schema: InsuranceItemForm,
    filters: [
      { key: "expired", label: "Expired" },
      { key: "expiring", label: "Expiring" },
      { key: "current", label: "Current" },
    ],
    titleOf: (r) => `${INSURANCE_KIND_LABELS[r.kind]}: ${r.label}`,
    detailOf: (r) =>
      `${r.policy_number ? `Policy ${r.policy_number}. ` : ""}Expires ${formatLongDate(r.expires_on)}.`,
    statusOf: (r) =>
      r.status === "expired"
        ? { key: "expired", label: `Expired ${r.expires_on}`, tone: "signal" }
        : r.status === "expiring"
          ? { key: "expiring", label: `Expires ${r.expires_on}`, tone: "ochre" }
          : {
              key: "current",
              label: `Current to ${r.expires_on}`,
              tone: "moss",
            },
    orderBy: { column: "expires_on", ascending: true },
    columns: INSURANCE_COLUMNS,
  } satisfies RegisterMeta<Statused<InsuranceItemRow>>,
  improvements: {
    slug: "improvements",
    table: "improvements",
    view: "improvements_status",
    title: "Improvements",
    singular: "improvement",
    intro:
      "What you learned and what you changed, from incidents, complaints, feedback and your own checks. A closed reportable incident or complaint offers one tap to add its row here.",
    addLabel: "Add an improvement",
    empty:
      "Nothing yet. The next closed incident or complaint offers one tap to add its lesson here.",
    fields: IMPROVEMENT_FIELDS,
    schema: ImprovementForm,
    filters: [
      { key: "overdue", label: "Overdue" },
      { key: "open", label: "Open" },
      { key: "done", label: "Done" },
    ],
    titleOf: (r) =>
      `${IMPROVEMENT_SOURCE_LABELS[r.source_kind]}${r.source_ref ? ` ${r.source_ref}` : ""}: ${r.learned}`,
    detailOf: (r) => `${r.changed} (${r.owner_role})`,
    statusOf: (r) =>
      r.status === "done"
        ? { key: "done", label: `Done ${r.done_on}`, tone: "moss" }
        : r.status === "overdue"
          ? {
              key: "overdue",
              label: `Overdue since ${r.due_on}`,
              tone: "signal",
            }
          : { key: "open", label: `Due ${r.due_on}`, tone: "ochre" },
    orderBy: { column: "due_on", ascending: true },
    columns: IMPROVEMENT_COLUMNS,
  } satisfies RegisterMeta<Statused<ImprovementRow>>,
  decisions: {
    slug: "decisions",
    table: "decisions",
    view: "decisions",
    title: "Record of decisions",
    singular: "decision",
    intro:
      "A dated list of decisions and who made them: your governance evidence. A sole trader uses it alone; a board uses it as minutes. A decision is never edited; add a new one if it changes.",
    addLabel: "Add a decision",
    empty:
      "No decisions recorded yet. Start with the day you adopted your policies.",
    appendOnly: true,
    fields: DECISION_FIELDS,
    schema: DecisionForm,
    filters: [],
    titleOf: (r) => r.decision,
    detailOf: (r) =>
      `${formatLongDate(r.decided_on)}, ${r.decided_by}.${r.note ? ` ${r.note}` : ""}`,
    statusOf: (r) => ({
      key: "recorded",
      label: r.decided_on,
      tone: "slate",
    }),
    orderBy: { column: "decided_on", ascending: false },
    columns: DECISION_COLUMNS,
  } satisfies RegisterMeta<DecisionRow & { status?: string }>,
  "staff-matrix": {
    slug: "staff-matrix",
    table: "staff_matrix",
    view: "staff_matrix_status",
    title: "Staff matrix",
    singular: "worker",
    intro:
      "One row per worker: role, qualifications, the risk-assessed flag, supervision, appraisal and onboarding dates. Training and clearance expiries come from the worker checks register by the same code.",
    addLabel: "Add a worker",
    empty:
      "No workers yet. Add one row per worker by code; their checks and training expiries join from the worker checks register.",
    fields: STAFF_MATRIX_FIELDS,
    schema: StaffMatrixForm,
    // REQ-024 A1 (FR-3, D-2411): the list page replaces the status with the derived state; these are its keys.
    filters: [
      { key: "outstanding", label: "Items outstanding" },
      { key: "all-recorded", label: "All before-first-shift items recorded" },
      { key: "check-expiring", label: "A check expiring" },
      { key: "ended", label: "Ended" },
    ],
    titleOf: (r) => `${r.worker_ref}: ${r.role_label}`,
    detailOf: (r) =>
      `${r.risk_assessed ? "Risk-assessed role. " : ""}${r.expired_checks ? `${r.expired_checks} check${r.expired_checks === 1 ? "" : "s"} expired. ` : ""}${r.expiring_checks ? `${r.expiring_checks} expiring. ` : ""}${r.last_supervision_on ? `Supervised ${formatLongDate(r.last_supervision_on)}.` : "No supervision recorded."}`,
    statusOf: (r) =>
      r.status === "supervision-overdue"
        ? {
            key: "supervision-overdue",
            label: "Supervision overdue",
            tone: "signal",
          }
        : r.status === "appraisal-overdue"
          ? {
              key: "appraisal-overdue",
              label: "Appraisal overdue",
              tone: "ochre",
            }
          : { key: "current", label: "Current", tone: "moss" },
    orderBy: { column: "worker_ref", ascending: true },
    columns: STAFF_MATRIX_COLUMNS,
  } satisfies RegisterMeta<
    Statused<StaffMatrixRow> & {
      expired_checks: number;
      expiring_checks: number;
    }
  >,
  onboarding: {
    slug: "onboarding",
    table: "onboarding_checklists",
    view: "onboarding_checklists_status",
    title: "Onboarding checklists",
    singular: "checklist",
    intro:
      "A short checklist for each new worker and each new participant. Each item is ticked with the date and who ticked it; a completed checklist is the signed and dated evidence the auditor asks for.",
    addLabel: "Start a checklist",
    empty:
      "No checklists yet. Start one for each worker and participant you have now.",
    fields: ONBOARDING_FIELDS,
    schema: OnboardingChecklistForm,
    filters: [
      { key: "in-progress", label: "In progress" },
      { key: "complete", label: "Complete" },
    ],
    titleOf: (r) =>
      `${r.kind === "worker" ? "New worker" : "New participant"} ${r.subject_ref}`,
    detailOf: (r) =>
      `Started ${formatLongDate(r.started_on)}. ${r.ticked} ticked.`,
    statusOf: (r) =>
      r.status === "complete"
        ? { key: "complete", label: `Complete ${r.completed_on}`, tone: "moss" }
        : { key: "in-progress", label: "In progress", tone: "ochre" },
    orderBy: { column: "started_on", ascending: false },
    columns: ONBOARDING_COLUMNS,
  } satisfies RegisterMeta<
    Statused<OnboardingChecklistRow> & { ticked: number }
  >,
};

export function metaFor(
  slug: string,
): RegisterMeta<Record<string, unknown>> | null {
  return (AUDIT_DAY_SLUGS as readonly string[]).includes(slug)
    ? (AUDIT_DAY_META[slug as AuditDaySlug] as unknown as RegisterMeta<
        Record<string, unknown>
      >)
    : null;
}

/** The blank values for a new row, in the shape the form keeps (strings and booleans). */
export function blankValues(
  fields: FieldSpec[],
): Record<string, string | boolean> {
  return Object.fromEntries(
    fields.map((f) => [f.name, f.kind === "checkbox" ? false : ""]),
  );
}

/** A stored row as form values: nulls become empty strings. */
export function rowToValues(
  fields: FieldSpec[],
  row: Record<string, unknown>,
): Record<string, string | boolean> {
  return Object.fromEntries(
    fields.map((f) => {
      const v = row[f.name];
      if (f.kind === "checkbox") return [f.name, Boolean(v)];
      // REQ-024 A1: an array column (the worker's states) is the form's comma-joined string.
      if (Array.isArray(v)) return [f.name, v.join(",")];
      return [f.name, v === null || v === undefined ? "" : String(v)];
    }),
  );
}

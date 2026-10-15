/**
 * Form schemas for the four registers (REQ-009 Session B, FR-5; SR-1). The
 * same patterns and caps as the database CHECKs in
 * supabase/migrations/20261013000000_registers.sql, validated on the client
 * for instant messages and again in the server action. Every message is
 * plain words (REQ-015 FR-1); no participant personal data can pass: people
 * are reference codes, free text is capped and refuses an NDIS-number shape.
 */
import { z } from "zod";
import { strictObject, text } from "@/lib/validation";
import {
  AU_STATES,
  CLEARANCE_KINDS,
  COMPLAINT_CHANNELS,
  COMPLAINT_STATUSES,
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  NDIS_NUMBER_SHAPE,
  REF_PATTERNS,
  TEXT_CAPS,
} from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date as the date input gives it. */
export const dateField = (label: string) =>
  z
    .string({ error: `Enter the ${label}` })
    .regex(ISO_DATE, `Enter the ${label} as a date`);

const optionalDate = (label: string) =>
  z
    .union([z.literal(""), dateField(label)])
    .transform((v) => (v === "" ? null : v));

/** Free text that never carries an NDIS number (the database refuses it too). */
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

export const IncidentForm = strictObject({
  occurredOn: dateField("date it happened"),
  reportedOn: dateField("date it was reported"),
  category: z.enum(INCIDENT_CATEGORIES, { error: "Choose what happened" }),
  severity: z.enum(INCIDENT_SEVERITIES, { error: "Choose how serious it was" }),
  participantRef: optionalRef(REF_PATTERNS.participant, "P-014"),
  workerRef: optionalRef(REF_PATTERNS.worker, "W-003"),
  summary: safeText(
    TEXT_CAPS.summary,
    1,
    "Describe what happened in a sentence or two",
  ),
  actionsTaken: safeText(TEXT_CAPS.actionsTaken),
  reportable: z.boolean(),
  reportableNotifiedOn: optionalDate("date you told the Commission"),
  // REQ-018-gated item (batch 45): the reference the Commission gives back
  // when told; letters, digits, spaces, slash and dash, never a participant
  // number (the column's CHECK refuses that shape too).
  commissionReference: z
    .string()
    .trim()
    .max(40, "Use 40 characters or fewer")
    .regex(/^[A-Za-z0-9 /-]*$/, "Letters, digits, spaces, / and - only")
    .refine(
      (s) => !NDIS_NUMBER_SHAPE.test(s),
      "This looks like an NDIS participant number. Use the Commission's reference instead.",
    )
    .default(""),
  status: z.enum(INCIDENT_STATUSES),
  closedOn: optionalDate("date it was closed"),
}).superRefine((v, ctx) => {
  if (v.reportedOn < v.occurredOn)
    ctx.addIssue({
      code: "custom",
      path: ["reportedOn"],
      message: "The report date cannot be before the date it happened",
    });
  if (v.reportableNotifiedOn && !v.reportable)
    ctx.addIssue({
      code: "custom",
      path: ["reportableNotifiedOn"],
      message: "Tick reportable first",
    });
  if (v.commissionReference && !v.reportable)
    ctx.addIssue({
      code: "custom",
      path: ["commissionReference"],
      message: "Tick reportable first",
    });
  if (v.status === "closed" && !v.closedOn)
    ctx.addIssue({
      code: "custom",
      path: ["closedOn"],
      message: "Enter the date it was closed",
    });
  if (v.status !== "closed" && v.closedOn)
    ctx.addIssue({
      code: "custom",
      path: ["closedOn"],
      message: "Set the status to closed, or clear this date",
    });
});
export type IncidentFormValues = z.input<typeof IncidentForm>;

export const ComplaintForm = strictObject({
  receivedOn: dateField("date it was received"),
  channel: z.enum(COMPLAINT_CHANNELS, { error: "Choose how it arrived" }),
  fromRef: optionalRef(REF_PATTERNS.complaintFrom, "P-014, FAM-2 or ADV-1"),
  summary: safeText(
    TEXT_CAPS.summary,
    1,
    "Describe the complaint in a sentence or two",
  ),
  outcome: safeText(TEXT_CAPS.outcome),
  acknowledgedOn: optionalDate("date you acknowledged it"),
  resolvedOn: optionalDate("date it was resolved"),
  status: z.enum(COMPLAINT_STATUSES),
}).superRefine((v, ctx) => {
  if (v.acknowledgedOn && v.acknowledgedOn < v.receivedOn)
    ctx.addIssue({
      code: "custom",
      path: ["acknowledgedOn"],
      message: "Cannot be before the date it was received",
    });
  if (v.resolvedOn && v.resolvedOn < v.receivedOn)
    ctx.addIssue({
      code: "custom",
      path: ["resolvedOn"],
      message: "Cannot be before the date it was received",
    });
  if (v.status === "resolved" && !v.resolvedOn)
    ctx.addIssue({
      code: "custom",
      path: ["resolvedOn"],
      message: "Enter the date it was resolved",
    });
});
export type ComplaintFormValues = z.input<typeof ComplaintForm>;

export const WorkerCheckForm = strictObject({
  workerRef: refField(REF_PATTERNS.worker, "W-003"),
  roleLabel: safeText(
    TEXT_CAPS.roleLabel,
    1,
    "Enter the role, such as support worker",
  ),
  clearanceKind: z.enum(CLEARANCE_KINDS, { error: "Choose the kind of check" }),
  // Batch 45 item 22: the check number the Worker Screening Rules s 18(3)(d) want on the provider's list; optional, never a name.
  clearanceNumber: z
    .string()
    .trim()
    .max(40, "The check number is 40 characters at most")
    .regex(/^[A-Za-z0-9 /-]*$/, "Letters, digits, spaces, / and - only")
    .default(""),
  issuedOn: dateField("date it was issued"),
  expiresOn: optionalDate("expiry date"),
  state: z
    .union([z.literal(""), z.enum(AU_STATES)])
    .transform((v) => (v === "" ? null : v)),
  note: safeText(TEXT_CAPS.note),
}).superRefine((v, ctx) => {
  if (v.expiresOn && v.expiresOn < v.issuedOn)
    ctx.addIssue({
      code: "custom",
      path: ["expiresOn"],
      message: "The expiry cannot be before the issue date",
    });
});
export type WorkerCheckFormValues = z.input<typeof WorkerCheckForm>;

export const PolicyReviewForm = strictObject({
  documentTypeId: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,80}$/, "Choose a document"),
  title: safeText(TEXT_CAPS.title),
  adoptedOn: optionalDate("date it was adopted"),
  reviewCycleMonths: z.coerce
    .number({ error: "Enter the months between reviews" })
    .int()
    .min(1, "At least 1 month")
    .max(36, "At most 36 months"),
  lastReviewedOn: optionalDate("date it was last reviewed"),
  reviewerRef: optionalRef(REF_PATTERNS.worker, "W-001"),
  note: safeText(TEXT_CAPS.note),
}).superRefine((v, ctx) => {
  if (v.documentTypeId === "other" && !v.title)
    ctx.addIssue({
      code: "custom",
      path: ["title"],
      message: "Give the document a title",
    });
  if (v.lastReviewedOn && v.adoptedOn && v.lastReviewedOn < v.adoptedOn)
    ctx.addIssue({
      code: "custom",
      path: ["lastReviewedOn"],
      message: "Cannot be before the date it was adopted",
    });
});
export type PolicyReviewFormValues = z.input<typeof PolicyReviewForm>;

/** Suggested expiry for a new check (PO answer 1): 5 years for NDIS worker screening, none for the orientation module. */
export function suggestedExpiry(
  kind: (typeof CLEARANCE_KINDS)[number],
  issuedOn: string,
): string | null {
  if (!ISO_DATE.test(issuedOn)) return null;
  if (kind === "ndis-worker-orientation-module") return null;
  if (kind !== "ndis-worker-screening") return null;
  const [y, m, d] = issuedOn.split("-").map(Number);
  const dt = new Date(Date.UTC(y + 5, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

/**
 * The worker role, invitations and the report link (REQ-020 FR-4, FR-5,
 * FR-6, FR-11, SR-3), pure: the report form's schema (the incident form's
 * fields minus the Commission-notification fields, plus "who are you" as a
 * worker code or a name-free role and nothing else), the fixed lines, the
 * expiries and the limits. Tokens use the auditor link's helpers.
 */
import { z } from "zod";
import { strictObject, text } from "@/lib/validation";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  NDIS_NUMBER_SHAPE,
  REF_PATTERNS,
  TEXT_CAPS,
} from "./types";

/** The name-free roles a reporter may choose instead of a worker code (PO edit to FR-5). */
export const REPORTER_ROLES = [
  "support worker",
  "casual worker",
  "team leader",
  "volunteer",
  "another person present",
] as const;
export type ReporterRole = (typeof REPORTER_ROLES)[number];

export const INVITATION_DAYS = 7;
export const DRAFT_LIMIT = 10;
export const AWARE_HOURS = 24;

export const EMERGENCY_LINE = "If someone is in danger now, call 000 first.";
export const WORKER_HOME_LINE =
  "You can log incidents and complaints and see what you logged. Your manager sees everything else.";
export const INVITE_LINE =
  "A worker can log incidents and complaints and see what they logged. They cannot see the other registers, the documents, the account or any export.";
export const REPORT_THANKS =
  "Thank you. The owner has been told and will confirm it. If someone is in danger now, call 000.";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const safeText = (max: number, min = 0, required?: string) =>
  text(max, min, required).refine(
    (v) => !NDIS_NUMBER_SHAPE.test(v),
    "This looks like an NDIS participant number. Use a reference code instead.",
  );

const optionalRef = (pattern: RegExp, hint: string) =>
  z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(pattern, `Use a code like ${hint}, never a name`),
    ])
    .transform((v) => (v === "" ? null : v));

/** Who is reporting: a worker code or one of the roles; never free text (SR-3). */
export const ReporterField = z
  .string()
  .trim()
  .refine(
    (v) =>
      REF_PATTERNS.worker.test(v.toUpperCase()) ||
      (REPORTER_ROLES as readonly string[]).includes(v),
    "Choose your worker code or one of the roles",
  )
  .transform((v) =>
    REF_PATTERNS.worker.test(v.toUpperCase()) ? v.toUpperCase() : v,
  );

export const ReportForm = strictObject({
  occurredOn: z
    .string({ error: "Enter the date it happened" })
    .regex(ISO_DATE, "Enter the date it happened as a date"),
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
  reporter: ReporterField,
});
export type ReportFormValues = z.input<typeof ReportForm>;

export const InviteForm = strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter the worker's email address")
    .max(254),
  workerRef: z
    .string()
    .trim()
    .toUpperCase()
    .regex(REF_PATTERNS.worker, "Use a code like W-003, never a name"),
});
export type InviteFormValues = z.input<typeof InviteForm>;

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_DAYS * 86_400_000);
}

export function invitePath(token: string): string {
  return `/invite/${token}`;
}

export function reportPath(token: string): string {
  return `/report/${token}`;
}

/** The sentence on the confirmation screen: when the provider became aware, and the 24-hour mark from it. */
export function awareSentence(awareAt: Date): string {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const by = new Date(awareAt.getTime() + AWARE_HOURS * 3_600_000);
  return `Reported ${fmt.format(awareAt).replace(" at ", ", ")}; if this is a reportable incident the Commission must be told by ${fmt.format(by).replace(" at ", ", ")}.`;
}

/** "1 report to confirm" / "3 reports to confirm", or null. */
export function reportsToConfirmLine(count: number): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? "report" : "reports"} to confirm`;
}

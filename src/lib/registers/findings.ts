/**
 * The audit findings register's words, fields, schema and columns (REQ-033
 * FR-3, FR-5, FR-7, SR-2; D-2929, D-2932, D-2933, D-2935, D-2936). A finding
 * is the provider's own words for a non-conformity or observation from
 * their last audit, against a Practice Standard, with the auditor's severity
 * and date; the status is the provider's record of addressing it and of the
 * auditor's verification, never Readyline's judgement (FR-7). The schema
 * refuses words the participant detector flags (SR-2), with the detector's
 * own message.
 */
import { z } from "zod";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { strictObject, text } from "@/lib/validation";
import type { FieldSpec, ListStatus } from "./audit-day-forms";
import {
  AUDIT_DAY_TEXT_CAPS,
  FINDING_SEVERITIES,
  FINDING_SEVERITY_LABELS,
  FINDING_STATUSES,
  FINDING_STATUS_LABELS,
  type FindingRow,
} from "./audit-day-types";
import { dateField } from "./forms";
import { formatLongDate } from "./status";
import { NDIS_NUMBER_SHAPE } from "./types";

export const FINDINGS_TITLE = "Audit findings";

/** FR-7 (D-2936): the page's intro, the lawyer's words. */
export const FINDINGS_INTRO =
  "Type or paste your auditor's findings in your own words. Readyline shows which document and section in your pack answers each one and keeps the record of what you changed. It does not decide whether a finding is closed; your auditor does.";

export const FINDINGS_EMPTY =
  "No findings recorded yet. Add them from your auditor's report, one at a time or all at once from the report's text.";

/** FR-7: no "resolve", "clear" or "pass" on a button. */
export const FINDINGS_ADD_LABEL = "Add a finding";
export const FINDINGS_IMPORT_LABEL = "Add findings from your report";
export const FINDING_ADDRESS_LABEL = "Mark as addressed";
export const FINDING_VERIFY_LABEL = "Record the auditor's verification";

/** D-2933: a standard no document of the pack carries. */
export const FINDING_NO_DOCUMENT_LINE =
  "No document in your pack carries this standard.";
export const FINDING_UNMAPPED_LABEL = "Not yet mapped to a standard";

const STANDARD_ID = /^[a-z0-9.-]{0,120}$/;

/** The standards as a flat list the select can show, grouped by module in the label (FR-3). */
export function standardOptions(): { value: string; label: string }[] {
  const data = getStandardsDataset();
  const moduleName = new Map(data.modules.map((m) => [m.id, m.name]));
  return [
    { value: "", label: FINDING_UNMAPPED_LABEL },
    ...data.standards.map((s) => ({
      value: s.id,
      label: `${moduleName.get(s.moduleId) ?? s.moduleId}: ${s.name}`,
    })),
  ];
}

/** The standard's name for a row, or the unmapped label. */
export function standardName(standardId: string): string {
  if (!standardId) return FINDING_UNMAPPED_LABEL;
  const s = getStandardsDataset().standards.find((x) => x.id === standardId);
  return s ? s.name : standardId;
}

const optionalDate = (label: string) =>
  z
    .union([z.literal(""), dateField(label)])
    .transform((v) => (v === "" ? null : v));

/** Free text that never carries an NDIS number and, for the finding's words, nothing the participant detector flags (SR-2). */
const guardedText = (max: number, min: number, required: string) =>
  text(max, min, required)
    .refine(
      (v) => !NDIS_NUMBER_SHAPE.test(v),
      "This looks like an NDIS participant number. Use a reference code instead.",
    )
    .superRefine((v, ctx) => {
      const found = detectParticipantData(v);
      if (found.length > 0)
        ctx.addIssue({ code: "custom", message: found[0].message });
    });

export const FindingForm = strictObject({
  standard_id: z
    .string()
    .trim()
    .regex(STANDARD_ID, "Choose a standard from the list"),
  indicator: text(AUDIT_DAY_TEXT_CAPS.short).refine(
    (v) => !NDIS_NUMBER_SHAPE.test(v),
    "This looks like an NDIS participant number. Use a reference code instead.",
  ),
  severity: z.enum(FINDING_SEVERITIES, {
    error: "Choose the severity as the auditor wrote it",
  }),
  finding: guardedText(
    AUDIT_DAY_TEXT_CAPS.short,
    1,
    "Say what the finding was, in your own words",
  ),
  due_on: optionalDate("date the auditor gave"),
  status: z.enum(FINDING_STATUSES, { error: "Choose the status" }),
  addressed_on: optionalDate("date it was addressed"),
  addressed_by_role: text(AUDIT_DAY_TEXT_CAPS.role).refine(
    (v) => !NDIS_NUMBER_SHAPE.test(v),
    "This looks like an NDIS participant number. Use a reference code instead.",
  ),
  verified_on: optionalDate("date the auditor verified it"),
}).superRefine((v, ctx) => {
  if (v.status !== "open" && !v.addressed_on)
    ctx.addIssue({
      code: "custom",
      path: ["addressed_on"],
      message: "Enter the date it was addressed",
    });
  if (v.status === "verified" && !v.verified_on)
    ctx.addIssue({
      code: "custom",
      path: ["verified_on"],
      message: "Enter the date the auditor verified it",
    });
});

export const FINDING_FIELDS: FieldSpec[] = [
  {
    name: "standard_id",
    label: "Practice Standard",
    kind: "select",
    help: "The standard the auditor rated. Pick the closest if the report names an indicator instead.",
    options: standardOptions(),
  },
  {
    name: "severity",
    label: "Severity, as the auditor wrote it",
    kind: "select",
    options: FINDING_SEVERITIES.map((value) => ({
      value,
      label: FINDING_SEVERITY_LABELS[value],
    })),
  },
  {
    name: "finding",
    label: "The finding, in your own words",
    kind: "textarea",
    help: "Never a participant's name, number, date of birth or address; a code such as P-014 if you must refer to someone.",
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 3,
  },
  {
    name: "indicator",
    label: "Quality indicator the report quotes",
    kind: "textarea",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.short,
    rows: 2,
  },
  {
    name: "due_on",
    label: "Date the auditor gave to fix it by",
    kind: "date",
    optional: true,
  },
  {
    name: "status",
    label: "Status",
    kind: "select",
    options: FINDING_STATUSES.map((value) => ({
      value,
      label: FINDING_STATUS_LABELS[value],
    })),
  },
  {
    name: "addressed_on",
    label: "Date it was addressed",
    kind: "date",
    optional: true,
  },
  {
    name: "addressed_by_role",
    label: "Who addressed it (role)",
    kind: "text",
    optional: true,
    maxLength: AUDIT_DAY_TEXT_CAPS.role,
  },
  {
    name: "verified_on",
    label: "Date the auditor verified it",
    kind: "date",
    optional: true,
  },
];

export const FINDING_FILTERS = [
  { key: "overdue", label: "Overdue" },
  { key: "open", label: "Open" },
  { key: "addressed", label: "Addressed" },
  { key: "verified", label: "Verified" },
];

export type FindingListRow = FindingRow & { state: string };

/** The list's status tag from the view's state (FR-3; FR-7: the words name what the provider did, not an outcome). */
export function findingStateTag(r: FindingListRow): ListStatus {
  switch (r.state) {
    case "overdue":
      return {
        key: "overdue",
        label: `Overdue since ${formatLongDate(r.due_on!)}`,
        tone: "signal",
      };
    case "addressed":
      return {
        key: "addressed",
        label: `Addressed ${formatLongDate(r.addressed_on!)}`,
        tone: "moss",
      };
    case "verified":
      return {
        key: "verified",
        label: `Verified by the auditor ${formatLongDate(r.verified_on!)}`,
        tone: "moss",
      };
    default:
      return {
        key: "open",
        label: r.due_on ? `Open, due ${formatLongDate(r.due_on)}` : "Open",
        tone: "ochre",
      };
  }
}

/** FR-6: "Findings from your last audit: 3 open, 2 addressed, 1 verified by the auditor", the zero parts left out. */
export function findingsCardLine(rows: readonly FindingListRow[]): string {
  const count = (state: string) => rows.filter((r) => r.state === state).length;
  const open = count("open") + count("overdue");
  const parts = [
    open ? `${open} open` : "",
    count("addressed") ? `${count("addressed")} addressed` : "",
    count("verified") ? `${count("verified")} verified by the auditor` : "",
  ].filter(Boolean);
  return `Findings from your last audit: ${parts.length ? parts.join(", ") : "none open"}`;
}

export function findingTitle(r: FindingRow): string {
  return `${r.reference}: ${standardName(r.standard_id)}`;
}

export function findingDetail(r: FindingRow): string {
  return `${FINDING_SEVERITY_LABELS[r.severity]}. ${r.finding}`;
}

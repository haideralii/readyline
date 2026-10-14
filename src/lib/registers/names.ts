/**
 * One naming table for every register and record (batch 42 items 2 and 3;
 * D-547): the canonical display name, used by the register page titles,
 * the pack's fixed "Records we keep" text, the self-assessment's "Items to
 * prepare before the audit", the audit-day page's twelve records and the
 * version 2 record-name lint, which accepts only these spellings and offers
 * the fix for a known alias. Pure data.
 */

export type RecordName = {
  /** The register id (REQ-009, REQ-018) or a slug for a record that is not a register. */
  id: string;
  /** The canonical display name, sentence case, as the page title and the pack use it. */
  name: string;
  /** Spellings the pack or the dataset's evidence items have used; the lint maps them to `name`. */
  aliases: string[];
  /** The register page, when the app keeps this record. */
  href?: string;
};

export const RECORD_NAMES: readonly RecordName[] = [
  {
    id: "document-control",
    name: "Document control register",
    aliases: ["document control", "document control table"],
    href: "/registers/document-control",
  },
  {
    id: "incidents",
    name: "Incident register",
    aliases: ["incidents register", "incident management register"],
    href: "/registers/incidents",
  },
  {
    id: "complaints",
    name: "Complaints register",
    aliases: [
      "complaint register",
      "complaints and feedback register",
      "feedback and complaints register",
    ],
    href: "/registers/complaints",
  },
  {
    id: "worker-clearances",
    name: "Worker checks register",
    aliases: [
      "worker screening clearance register",
      "worker clearance register",
      "clearance register",
      "worker screening register",
      "worker check register",
      "screening register",
    ],
    href: "/registers/worker-checks",
  },
  {
    id: "policy-reviews",
    name: "Policy review register",
    aliases: ["policy reviews register", "policy register", "review register"],
    href: "/registers/policy-reviews",
  },
  {
    id: "corporate-risks",
    name: "Corporate risk register",
    aliases: [
      "risk register",
      "business risk register",
      "organisational risk register",
    ],
    href: "/registers/corporate-risks",
  },
  {
    id: "participant-risks",
    name: "Participant risk register",
    aliases: [
      "participant risks register",
      "participant risk assessment register",
    ],
    href: "/registers/participant-risks",
  },
  {
    id: "conflicts-of-interest",
    name: "Conflict of interest register",
    aliases: [
      "conflicts of interest register",
      "conflict register",
      "declarations register",
    ],
    href: "/registers/conflicts-of-interest",
  },
  {
    id: "delegations",
    name: "Delegations register",
    aliases: ["delegation register"],
    href: "/registers/delegations",
  },
  {
    id: "insurances",
    name: "Insurances and vehicles register",
    aliases: [
      "insurance register",
      "insurances register",
      "vehicle register",
      "vehicles register",
    ],
    href: "/registers/insurances",
  },
  {
    id: "improvements",
    name: "Improvement register",
    aliases: [
      "continuous improvement register",
      "improvements register",
      "quality improvement register",
    ],
    href: "/registers/improvements",
  },
  {
    id: "decisions",
    name: "Record of decisions",
    aliases: ["decisions register", "decision register", "minutes"],
    href: "/registers/decisions",
  },
  {
    id: "staff-matrix",
    name: "Staff matrix",
    aliases: ["training matrix", "worker matrix", "skills matrix"],
    href: "/registers/staff-matrix",
  },
  {
    id: "onboarding",
    name: "Onboarding checklist",
    aliases: [
      "onboarding checklists",
      "induction checklist",
      "new worker checklist",
      "new participant checklist",
    ],
    href: "/registers/onboarding",
  },
  {
    id: "training",
    name: "Training register",
    aliases: ["training records", "training log"],
  },
  {
    id: "restrictive-practices",
    name: "Restrictive practice use register",
    aliases: [
      "restrictive practices register",
      "use register",
      "restrictive practice register",
    ],
  },
];

/** Forms and templates the pack provides, by their fixed-text names (not registers). */
export const PACK_FORM_NAMES: readonly string[] = [
  "Service agreement template",
  "Service agreement",
  "Consent form",
  "Conflict of interest declaration form",
  "Declaration form",
  "Code of Conduct acknowledgement",
  "Acknowledgement form",
  "Support plan template",
  "Support plan",
  "Transition checklist",
  "Retention schedule",
  "Emergency contact form",
  "Incident report form",
  "Complaint form",
  "Feedback form",
  "Medication chart",
  "Medication record",
  "Mealtime plan",
  "Risk assessment form",
  "Risk assessment",
  "Easy Read summary",
  "Self-assessment",
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** The canonical spelling for a name or a known alias, or null when the record is not known. */
export function canonicalRecordName(name: string): string | null {
  const n = norm(name);
  for (const r of RECORD_NAMES) {
    if (norm(r.name) === n) return r.name;
    if (r.aliases.some((a) => norm(a) === n)) return r.name;
  }
  for (const f of PACK_FORM_NAMES) if (norm(f) === n) return f;
  return null;
}

/** True when the spelling is already canonical. */
export function isCanonicalRecordName(name: string): boolean {
  const n = norm(name);
  return (
    RECORD_NAMES.some((r) => norm(r.name) === n) ||
    PACK_FORM_NAMES.some((f) => norm(f) === n)
  );
}

export function registerDisplayName(id: string): string {
  return RECORD_NAMES.find((r) => r.id === id)?.name ?? id;
}

/**
 * The twelve records an auditor asks to see (REQ-018 FR-11; the auditor
 * research section B), in the order the audit-day page and the
 * self-assessment's "Items to prepare before the audit" both use.
 */
export const AUDIT_DAY_RECORDS: readonly {
  id: string;
  name: string;
  ask: string;
  href: string;
}[] = [
  {
    id: "document-control",
    name: "Document control register",
    ask: "Your document control register: every policy with its version, when it was adopted, by whom, and when it is next reviewed",
    href: "/registers/document-control",
  },
  {
    id: "decisions",
    name: "Record of decisions",
    ask: "Your record of decisions or meeting minutes",
    href: "/registers/decisions",
  },
  {
    id: "corporate-risks",
    name: "Corporate risk register",
    ask: "Your corporate risk register, every area filled, a review date on every row",
    href: "/registers/corporate-risks",
  },
  {
    id: "participant-risks",
    name: "Participant risk register",
    ask: "Your participant risk register, one line per participant",
    href: "/registers/participant-risks",
  },
  {
    id: "conflicts-of-interest",
    name: "Conflict of interest register",
    ask: "Your conflict of interest register, with review dates",
    href: "/registers/conflicts-of-interest",
  },
  {
    id: "delegations",
    name: "Delegations register",
    ask: "Your delegations register: who acts when you are away",
    href: "/registers/delegations",
  },
  {
    id: "insurances",
    name: "Insurances and vehicles register",
    ask: "Your insurance certificates and, if you drive participants, your vehicle and driver records",
    href: "/registers/insurances",
  },
  {
    id: "improvements",
    name: "Improvement register",
    ask: "Your improvement register, fed by incidents, complaints and feedback",
    href: "/registers/improvements",
  },
  {
    id: "staff-matrix",
    name: "Staff matrix",
    ask: "Your staff matrix: each worker's screening, training, supervision and appraisal",
    href: "/registers/staff-matrix",
  },
  {
    id: "onboarding",
    name: "Onboarding checklist",
    ask: "A signed and dated onboarding checklist for each worker and each participant",
    href: "/registers/onboarding",
  },
  {
    id: "incidents",
    name: "Incident register",
    ask: "Your incident register, with the reportable ones standing out",
    href: "/registers/incidents",
  },
  {
    id: "complaints",
    name: "Complaints register",
    ask: "Your complaints register, separate from feedback, with resolution times",
    href: "/registers/complaints",
  },
];

/** The self-assessment's fixed list (batch 42 item 3): the twelve records in the same order and words, the insurances line pointing at the register. */
export function itemsToPrepareBeforeAudit(): string[] {
  return AUDIT_DAY_RECORDS.map((r) =>
    r.id === "insurances"
      ? "Your insurances and vehicles register: public liability, professional indemnity, workers compensation and any vehicle, with each expiry date"
      : r.ask,
  );
}

/**
 * Batch 45 item 17 (field, auditor and Commission reviews): the columns of
 * the paper incident and complaints registers in the pack and of the app's
 * pages, one list, so the two never drift. Keys are the database columns;
 * values are the words the pages and the paper show. A unit test holds the
 * pack's tables to these lists.
 */
export const INCIDENT_COLUMNS = {
  reference: "Reference",
  occurred_on: "Date it happened",
  reported_on: "Date it was reported",
  category: "What happened",
  severity: "How serious",
  reportable: "Reportable",
  reportable_notified_on: "Commission told on",
  status: "Status",
} as const;

export const INCIDENT_EXAMPLE_ROW: readonly string[] = [
  "INC-0001",
  "[Date]",
  "[Date]",
  "[What happened, in a sentence]",
  "[Low, medium or high]",
  "[Yes or no]",
  "[Date, or not needed]",
  "[Open, under review or closed]",
];

export const COMPLAINT_COLUMNS = {
  reference: "Reference",
  received_on: "Date received",
  from_ref: "Who (code)",
  summary: "What",
  actions: "What we did",
  outcome: "Outcome",
  improvement: "Improvement",
  resolved_on: "Closed on",
} as const;

export const COMPLAINT_EXAMPLE_ROW: readonly string[] = [
  "CMP-0001",
  "[Date]",
  "[Code, never a name]",
  "[The complaint, in a sentence]",
  "[What we did]",
  "[Outcome]",
  "[What we changed]",
  "[Date]",
];

/** Batch 45 item 22: the worker checks register's columns, the app's fields in the app's words. */
export const CLEARANCE_COLUMNS = {
  worker_ref: "Worker code",
  role_label: "Role",
  clearance_kind: "Kind of check",
  clearance_number: "Check number",
  issued_on: "Date issued",
  expires_on: "Expiry date",
  next_check: "Next check",
} as const;

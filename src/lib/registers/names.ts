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
    // REQ-020 FR-7.
    id: "hazards",
    name: "Hazard register",
    aliases: ["hazard and WHS register", "WHS register", "hazards register"],
    href: "/registers/hazards",
  },
  {
    // REQ-023 FR-10 (Session D): what was notified to the Commission and what was applied for as a variation.
    id: "commission-changes",
    name: "Changes we told the Commission",
    aliases: [
      "changes register",
      "notifications to the Commission",
      "register of changes notified to the Commission",
    ],
    href: "/registers/commission-changes",
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
 * Which records the standards and the Rules name, and which auditors ask
 * for in practice (batch 45, the REQ-018-gated item; the guide
 * `registers-an-auditor-asks-for` carries the sources): the Incident and
 * Complaints Rules require the two registers, the Practice Standards expect
 * the policy review record (document control), the risk register, the
 * insurances and the worker screening and training records (staff matrix);
 * the other six are what auditors ask to see.
 */
export type AuditRecordTier = "named" | "practice";

export const AUDIT_RECORD_TIER_TITLES: Record<AuditRecordTier, string> = {
  named: "Records the standards name",
  practice: "Records auditors often ask for",
};

/** The suffix a record kept on paper carries in the lists. */
export const KEPT_ON_PAPER = "kept on paper";

/**
 * The records an auditor asks to see (REQ-018 FR-11; the auditor research
 * section B; REQ-020 FR-7 adds the hazard register, PO 15 Oct 2026), in
 * the order the audit-day page, the self-check and the self-assessment's
 * "Items to prepare before the audit" all use: one list, so the words
 * cannot drift. `tier` splits them in two; `paper` marks the two whose
 * artefact is a signed or issued document the provider keeps on paper,
 * with the register holding the dates.
 */
export const AUDIT_DAY_RECORDS: readonly {
  id: string;
  name: string;
  ask: string;
  href: string;
  tier: AuditRecordTier;
  paper?: true;
}[] = [
  {
    id: "document-control",
    name: "Document control register",
    ask: "Your document control register: every policy with its version, when it was adopted, by whom, and when it is next reviewed",
    href: "/registers/document-control",
    tier: "named",
  },
  {
    id: "decisions",
    name: "Record of decisions",
    ask: "Your record of decisions or meeting minutes",
    href: "/registers/decisions",
    tier: "practice",
  },
  {
    id: "corporate-risks",
    name: "Corporate risk register",
    ask: "Your corporate risk register, every area filled, a review date on every row",
    href: "/registers/corporate-risks",
    tier: "named",
  },
  {
    id: "participant-risks",
    name: "Participant risk register",
    ask: "Your participant risk register, one line per participant",
    href: "/registers/participant-risks",
    tier: "practice",
  },
  {
    id: "conflicts-of-interest",
    name: "Conflict of interest register",
    ask: "Your conflict of interest register, with review dates",
    href: "/registers/conflicts-of-interest",
    tier: "practice",
  },
  {
    id: "delegations",
    name: "Delegations register",
    ask: "Your delegations register: who acts when you are away",
    href: "/registers/delegations",
    tier: "practice",
  },
  {
    // REQ-020 FR-7 (PO, 15 Oct 2026): the thirteenth record, after the delegations.
    id: "hazards",
    name: "Hazard register",
    ask: "Your hazard register: what could hurt someone, what you did, and when you check it again",
    href: "/registers/hazards",
    tier: "practice",
  },
  {
    // REQ-023 FR-10 (Session D): the fourteenth record, after the hazards; the register nobody keeps.
    id: "commission-changes",
    name: "Changes we told the Commission",
    ask: "Your record of the changes you told the Commission about, and the variations you applied for, with the dates",
    href: "/registers/commission-changes",
    tier: "practice",
  },
  {
    id: "insurances",
    name: "Insurances and vehicles register",
    ask: "Your insurance certificates and, if you drive participants, your vehicle and driver records",
    href: "/registers/insurances",
    tier: "named",
    paper: true,
  },
  {
    id: "improvements",
    name: "Improvement register",
    ask: "Your improvement register, fed by incidents, complaints and feedback",
    href: "/registers/improvements",
    tier: "practice",
  },
  {
    id: "staff-matrix",
    name: "Staff matrix",
    ask: "Your staff matrix: each worker's screening, training, supervision and appraisal",
    href: "/registers/staff-matrix",
    tier: "named",
  },
  {
    id: "onboarding",
    name: "Onboarding checklist",
    ask: "A signed and dated onboarding checklist for each worker and each participant",
    href: "/registers/onboarding",
    tier: "practice",
    paper: true,
  },
  {
    id: "incidents",
    name: "Incident register",
    ask: "Your incident register, with the reportable ones standing out",
    href: "/registers/incidents",
    tier: "named",
  },
  {
    id: "complaints",
    name: "Complaints register",
    ask: "Your complaints register, separate from feedback, with resolution times",
    href: "/registers/complaints",
    tier: "named",
  },
];

/** The line one record takes in the self-assessment's list: the ask, the insurances line pointing at the register, the paper mark where it applies. */
function prepareLine(r: (typeof AUDIT_DAY_RECORDS)[number]): string {
  const ask =
    r.id === "insurances"
      ? "Your insurances and vehicles register: public liability, professional indemnity, workers compensation and any vehicle, with each expiry date"
      : r.ask;
  return r.paper ? `${ask} (${KEPT_ON_PAPER})` : ask;
}

/** The self-assessment's fixed list (batch 42 item 3): the records in the same order and words as the audit-day page, the insurances line pointing at the register. */
export function itemsToPrepareBeforeAudit(): string[] {
  return AUDIT_DAY_RECORDS.map(prepareLine);
}

/** The same list in its two tiers (batch 45, REQ-018-gated item), each in the audit-day order. */
export function itemsToPrepareByTier(): Record<AuditRecordTier, string[]> {
  return {
    named: AUDIT_DAY_RECORDS.filter((r) => r.tier === "named").map(prepareLine),
    practice: AUDIT_DAY_RECORDS.filter((r) => r.tier === "practice").map(
      prepareLine,
    ),
  };
}

/** The tier and paper mark of a record by id, for the audit-day page's lines. */
export function auditRecordTier(id: string): {
  tier: AuditRecordTier;
  paper: boolean;
} {
  const r = AUDIT_DAY_RECORDS.find((x) => x.id === id);
  return { tier: r?.tier ?? "practice", paper: Boolean(r?.paper) };
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
  // REQ-018-gated item (batch 45): the reference the Commission gives back.
  commission_reference: "Commission reference",
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
  "[Reference, or not needed]",
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
  // REQ-024 A1 (D-2419): the two numbers s 18(3)(d) asks for, and the day the owner checked the database (s 15(4)).
  application_number: "Application number",
  verified_in_database_on: "Checked in the NDIS Worker Screening Database on",
  issued_on: "Date issued",
  expires_on: "Expiry date",
  next_check: "Next check",
} as const;

/**
 * The changes register, "Changes we told the Commission" (REQ-023 Session D,
 * FR-10; D-2306 as amended, D-2311, D-2341): the one constant that names
 * every change type, its kind (a notification under the Rules' s 13 or
 * s 13A, or a variation under the Act's s 73M), the Rule's own timing words
 * for its helper (R-4), and the row of the governance policy's "Telling the
 * Commission about changes" table it belongs to, so the register's list and
 * the policy's table are built from one place and a test holds them equal.
 * Pure: the states here are the twin of the `commission_changes_status` view.
 */

export const CHANGE_KINDS = ["notification", "variation"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** Which rule gives the type its timing: s 13 (no notify-by), s 13A (the earlier of awareness and the event), s 13A(3) (ownership), s 73M (a variation). */
export type ChangeRule = "s13" | "s13A" | "s13A-ownership" | "s73M";

/** The governance policy table's five rows, in order; several types share one (the words are the fixed text's, byte for byte). */
export const POLICY_ROW_IDS = [
  "contact",
  "scale",
  "condition-or-access",
  "financial-or-governance",
  "suitability",
] as const;
export type PolicyRowId = (typeof POLICY_ROW_IDS)[number];

export type ChangeType = {
  id: string;
  kind: ChangeKind;
  rule: ChangeRule;
  /** The fixed list's label on the form, the table and the sheet. */
  label: string;
  /** The Rule's words on the form (R-4), under the type. */
  helper: string;
  /** The governance policy row the type belongs to; a variation has none. */
  policyRow: PolicyRowId | null;
};

const S13_WORDS =
  'Rules s 13(2)(b): notice "as soon as practicable after the earlier of" when you become aware the change will occur and when it occurs. No day count; the register never reads it as overdue.';
const S13A_WORDS =
  'Rules s 13A(4): notice "by the earlier of" when you become aware the event or change will occur and when it occurs. The day you knew is the notify-by date when it comes first.';

export const CHANGE_TYPES: readonly ChangeType[] = [
  // Rules s 13: contact details, the area, the locations, participant and worker numbers.
  {
    id: "contact-details",
    kind: "notification",
    rule: "s13",
    label: "Contact details (Rules s 13)",
    helper: S13_WORDS,
    policyRow: "contact",
  },
  {
    id: "area",
    kind: "notification",
    rule: "s13",
    label: "The area we work in (Rules s 13)",
    helper: S13_WORDS,
    policyRow: "scale",
  },
  {
    id: "locations",
    kind: "notification",
    rule: "s13",
    label: "The locations we work from (Rules s 13)",
    helper: S13_WORDS,
    policyRow: "scale",
  },
  {
    id: "participant-numbers",
    kind: "notification",
    rule: "s13",
    label: "A significant change in participant numbers (Rules s 13)",
    helper: `${S13_WORDS} The Rules give no figure for "significant"; record in the note why you judged the change significant.`,
    policyRow: "scale",
  },
  {
    id: "worker-numbers",
    kind: "notification",
    rule: "s13",
    label: "A significant change in worker numbers (Rules s 13)",
    helper: `${S13_WORDS} The Rules give no figure for "significant"; record in the note why you judged the change significant.`,
    policyRow: "scale",
  },
  // Rules s 13A: events and changes.
  {
    id: "condition-event",
    kind: "notification",
    rule: "s13A",
    label:
      "An event that significantly affects our ability to meet a condition of registration (Rules s 13A)",
    helper: S13A_WORDS,
    policyRow: "condition-or-access",
  },
  {
    id: "access-change",
    kind: "notification",
    rule: "s13A",
    label:
      "A change that adversely affects a participant's access to our supports (Rules s 13A)",
    helper: S13A_WORDS,
    policyRow: "condition-or-access",
  },
  {
    id: "financial-capacity",
    kind: "notification",
    rule: "s13A",
    label: "An adverse change in our financial capacity (Rules s 13A)",
    helper: S13A_WORDS,
    policyRow: "financial-or-governance",
  },
  {
    id: "organisation-governance",
    kind: "notification",
    rule: "s13A",
    label:
      "A significant change in our organisation or governance (Rules s 13A(1)(d))",
    helper: S13A_WORDS,
    policyRow: "financial-or-governance",
  },
  {
    id: "key-personnel-change",
    kind: "notification",
    rule: "s13A",
    label: "Key personnel joined or left (Rules s 13A(1)(d))",
    helper: `${S13A_WORDS} A director or manager joining or leaving is, if significant, a change in organisation or governance arrangements; the Commission's notify page lists "your key personnel (such as a new CEO or company director)".`,
    policyRow: "financial-or-governance",
  },
  {
    id: "change-of-ownership",
    kind: "notification",
    rule: "s13A-ownership",
    label: "Change of ownership (Rules s 13A(3))",
    // D-2849: the copy lint reads this file; the helper is one paragraph under sixty words, the Rule's words kept.
    helper:
      'Rules s 13A(3): notice "by the earlier of" when you become aware the change will occur and when a necessary first step occurs; type the day of that first step as the day it happened. A certification provider\'s audit must start within 3 months (s 13BA), unless a mid-term audit is under way or the registration ends first.',
    policyRow: "financial-or-governance",
  },
  {
    id: "key-personnel-suitability",
    kind: "notification",
    rule: "s13A",
    label: "Key personnel suitability event (Rules s 13A(1)(f))",
    helper: `${S13A_WORDS} An event about the suitability of the business or of your key personnel of the kind the Commission would weigh for an applicant.`,
    policyRow: "suitability",
  },
  // NDIS Act s 73M: a variation of the supports or services registered (s 73L(3)(c)).
  {
    id: "supports-registered",
    kind: "variation",
    rule: "s73M",
    label: "The supports or services we are registered for (NDIS Act s 73M)",
    helper:
      "A change of the supports or services registered is a variation of your registration: an application under s 73M, decided under s 73L(3)(c). It takes effect on the day the Commissioner's notice names (s 73L(6)), with a varied certificate. A varied condition or a varied period is not a register row; change the dates on your registration form instead.",
    policyRow: null,
  },
];

export const CHANGE_TYPE_IDS = CHANGE_TYPES.map((t) => t.id);
export const NOTIFICATION_TYPE_IDS = CHANGE_TYPES.filter(
  (t) => t.kind === "notification",
).map((t) => t.id);
export const VARIATION_TYPE_IDS = CHANGE_TYPES.filter(
  (t) => t.kind === "variation",
).map((t) => t.id);
/** The s 13 types: no notify-by, never overdue (D-2306). */
export const S13_TYPE_IDS = CHANGE_TYPES.filter((t) => t.rule === "s13").map(
  (t) => t.id,
);

export function changeType(id: string): ChangeType | undefined {
  return CHANGE_TYPES.find((t) => t.id === id);
}

export const CHANGE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CHANGE_TYPES.map((t) => [t.id, t.label]),
);

/** The governance policy's table (fixed-extras `telling-the-commission`), built from the types' rows; the words are the fixed text's. */
export const POLICY_ROW_WORDS: Record<PolicyRowId, [string, string]> = {
  contact: [
    "A change to our contact details (Rules s 13)",
    "As soon as practicable after we know it will happen, or after it happens, whichever is earlier",
  ],
  scale: [
    "A change in our scale: the area or the locations we work from, or a significant rise or fall in the number of participants or workers (Rules s 13)",
    "As soon as practicable after we know it will happen, or after it happens, whichever is earlier",
  ],
  "condition-or-access": [
    "An event that significantly affects our ability to meet a condition of registration, or a change that adversely affects a participant's access to our supports (Rules s 13A)",
    "When we become aware it will occur, or when it occurs, whichever is earlier",
  ],
  "financial-or-governance": [
    "An adverse change in our financial capacity, or a significant change in our organisation or governance, including a change of ownership (Rules s 13A)",
    "For a change of ownership: when we become aware it will occur, or when a necessary step toward it occurs, whichever is earlier; otherwise as the row above",
  ],
  suitability: [
    "An event about the suitability of the business or of our key personnel of the kind the Commission would weigh for an applicant (Rules s 13A)",
    "When we become aware it will occur, or when it occurs, whichever is earlier",
  ],
};

/** The table's rows in order: every policy row that at least one notification type belongs to. */
export function tellingTheCommissionRows(): string[][] {
  return POLICY_ROW_IDS.filter((row) =>
    CHANGE_TYPES.some((t) => t.policyRow === row),
  ).map((row) => [...POLICY_ROW_WORDS[row]]);
}

export const CHANNELS = ["portal", "email", "other"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = {
  portal: "The registered providers portal",
  email: "Email",
  other: "Another way",
};

export const APPROVED_FORM_ANSWERS = ["yes", "no", "unsure"] as const;
export type ApprovedForm = (typeof APPROVED_FORM_ANSWERS)[number];
export const APPROVED_FORM_LABELS: Record<ApprovedForm, string> = {
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
};

/** The states as FR-10 and D-2311 word them; the view computes the same. */
export const CHANGE_STATES = [
  "to notify",
  "overdue",
  "notified",
  "told, form not confirmed",
  "to apply",
  "applied",
  "decided",
] as const;
export type ChangeState = (typeof CHANGE_STATES)[number];

export type CommissionChangeRow = {
  id: string;
  account_id: string;
  reference: string;
  kind: ChangeKind;
  change_type: string;
  happened_on: string;
  aware_on: string | null;
  notified_on: string | null;
  channel: Channel | null;
  approved_form: ApprovedForm | null;
  applied_on: string | null;
  decided_on: string | null;
  effective_on: string | null;
  commission_reference: string;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** The notify-by date (D-2306): null for a variation or a s 13 type; else the earlier of the day known and the day it happened (for ownership, the first necessary step). */
export function notifyBy(
  row: Pick<
    CommissionChangeRow,
    "kind" | "change_type" | "aware_on" | "happened_on"
  >,
): string | null {
  if (row.kind === "variation") return null;
  if (S13_TYPE_IDS.includes(row.change_type)) return null;
  return row.aware_on && row.aware_on < row.happened_on
    ? row.aware_on
    : row.happened_on;
}

/** The state (FR-10, D-2311), the twin of the view's `state` with the Sydney day. */
export function changeState(
  row: Pick<
    CommissionChangeRow,
    | "kind"
    | "change_type"
    | "aware_on"
    | "happened_on"
    | "notified_on"
    | "approved_form"
    | "applied_on"
    | "decided_on"
  >,
  today: string,
): ChangeState {
  if (row.kind === "variation") {
    if (row.decided_on) return "decided";
    if (row.applied_on) return "applied";
    return "to apply";
  }
  if (row.notified_on)
    return row.approved_form === "yes"
      ? "notified"
      : "told, form not confirmed";
  const by = notifyBy(row);
  if (by && by < today) return "overdue";
  return "to notify";
}

/** The helper under the variation's decided date (finding 35). */
export const EFFECTIVE_ON_HELP =
  "You may deliver the added supports from the date in the Commissioner's notice, not from the day you applied.";
/** The helper under the applied date (R-4, finding 73; the page is to be re-read when this register ships). */
export const APPLIED_ON_HELP =
  'The Commission emails the "Application for Variation of Registration" form on request (its manage-your-registration page, read 16 October 2026); the outcome is a notice of decision and an updated certificate if applicable.';
/** The helper under the approved-form answer (finding 34, R-4, finding 69). */
export const APPROVED_FORM_HELP =
  "Notices are given in the form the Commissioner approves (Rules s 13(2)(a), s 13A(2)); the Commission's notify page names the registered providers portal as that form.";
/** The register's one line about what a decided variation changes elsewhere (FR-7's line). */
export const DECIDED_LINE =
  "Enter the dates from your varied certificate on the account page.";
/** PO 18 Oct 00:45: "to apply" is the provider's own step, a plan and not a duty with a date; the row says so. */
export const TO_APPLY_LINE =
  "Applying is your own step; the Rules set no date for it.";

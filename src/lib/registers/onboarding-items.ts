/**
 * The two onboarding checklists (REQ-018 FR-9; D-1904), in the same
 * instruction voice as the readiness checklist: what to do, where to
 * record it. REQ-024 Session A1 (FR-2, D-2402): the worker's list is
 * derived, never typed, from the worker's role, states and flags and the
 * account's modules, for each applicable item from W-1 to W-10: who does it
 * (owner, worker, both), what counts as done, the plain-words ask and a
 * source line. The ids are the W form (`w1-clearance` to `w10-other-checks`,
 * finding 189) and the map from the eight REQ-018 ids is fixed below
 * (finding 68). The participant checklist is unchanged. Pure data and pure
 * functions; the copy lint runs over every line.
 */
import type { OnboardingKind } from "./audit-day-types";
import {
  CHECK_YOUR_UNIT,
  screeningFactsFor,
  STATE_FILE,
  type FactSource,
} from "./state-facts";

export type OnboardingItem = { id: string; text: string };

export type ItemWho = "owner" | "worker" | "both";
/** What counts as done: a date, a number on the clearance row, an expiry on a clearance row, or a tick with a date. */
export type ItemCounts = "date" | "number" | "expiry" | "tick";
export type ItemSource = {
  title: string;
  url?: string;
  status: "verified" | "unverified";
};

export type WorkerOnboardingItem = OnboardingItem & {
  who: ItemWho;
  counts: ItemCounts;
  /** FR-4: the item must be done and confirmed before the worker's first shift. */
  beforeFirstShift: boolean;
  /** The plain-words ask an auditor makes, for the owner's view and the audit-day page. */
  ask: string;
  source: ItemSource;
  /** W-7: named by the module that makes it likely, Readyline's suggestion and not a rule. */
  yourCall?: boolean;
  /** The clearance kind whose row records this item, where one does. */
  clearanceKind?: string;
  /** FR-2a: the state facts under the item, one line per state served (or the "type the states first" line), shown small under the instruction. */
  stateLines?: string[];
};

/** FR-1: the closed role list beside the free `role_label`. */
export const WORKER_ROLES = [
  "support-worker",
  "team-leader",
  "key-personnel",
  "admin",
  "contractor",
  "volunteer",
] as const;
export type WorkerRole = (typeof WORKER_ROLES)[number];
export const WORKER_ROLE_LABELS: Record<WorkerRole, string> = {
  "support-worker": "Support worker",
  "team-leader": "Team leader",
  "key-personnel": "Key personnel",
  admin: "Admin",
  contractor: "Contractor (engaged by you)",
  volunteer: "Volunteer",
};

/** s 5's three paragraphs of "risk assessed role", asked for every row (findings 43 and 75). */
export const RISK_PARAGRAPHS = ["a", "b", "c"] as const;
export type RiskParagraph = (typeof RISK_PARAGRAPHS)[number];
export const RISK_PARAGRAPH_LABELS: Record<RiskParagraph, string> = {
  a: "(a) a key personnel role",
  b: "(b) the normal duties include the direct delivery of specified supports or services",
  c: "(c) the normal duties are likely to require more than incidental contact with a person with disability",
};

/** Finding 68: the REQ-018 ids and the W ids they became; ticks already written keep the old id as dated evidence. */
export const WORKER_ITEM_ID_MAP: Readonly<Record<string, string>> = {
  "screening-clearance-seen": "w1-clearance",
  "other-checks-recorded": "w10-other-checks",
  "orientation-module": "w4-orientation-module",
  "policies-walked-through": "w6-policies",
  "supervision-booked": "w8-supervision",
};

/** The three fixed before-first-shift items every worker keeps under their own ids (finding 68). */
export const FIXED_WORKER_ITEM_IDS = [
  "identity-and-agreement",
  "participant-plans-read",
  "emergency-plan-shown",
] as const;

/** W-6: the mandatory policies, everywhere this REQ says it. */
export const MANDATORY_POLICIES =
  "the Code of Conduct, incident, complaints, privacy and safeguarding policies";

/** FR-5: Readyline's suggestion when a certificate's expiry is left empty; common training-sector practice; no Rule or Standard sets it; the certificate's date wins. */
export const FIRST_AID_SUGGESTED_YEARS = 3;
export const CPR_SUGGESTED_YEARS = 1;

const RULES = {
  title:
    "NDIS (Practice Standards—Worker Screening) Rules 2018, compilation No. 4 (F2021C00788)",
  url: "https://www.legislation.gov.au/F2018L00887/2021-07-31/2021-07-31/text/original/word",
};
const rules = (section: string): ItemSource => ({
  title: `${RULES.title}, ${section}`,
  url: RULES.url,
  status: "verified",
});
const STANDARDS_URL =
  "https://www.ndiscommission.gov.au/rules-and-standards/ndis-practice-standards";

export type WorkerItemContext = {
  role: WorkerRole | null;
  /** The states this worker works in (codes); empty until the owner types them (finding 81). */
  states: readonly string[];
  worksWithChildren: boolean;
  mayUseRestrictivePractice: boolean;
  /** The owner's own row (`memberships.worker_ref` equals the code): W-5 and W-8 are omitted (AC-1). */
  ownerRow: boolean;
  riskAssessed: boolean;
  /** The account's Practice Standards module ids (`core`, `verification`, `hidpa`, `sbs`, `ibsp`, ...). */
  moduleIds: readonly string[];
  /** The request's Sydney day (D-2242), for the state facts' six-month rule. */
  today: string;
};

const stateNames = (codes: readonly string[]) =>
  codes.map((c) => STATE_FILE.states[c]?.name ?? c).join(", ");

const factsFor = (ctx: WorkerItemContext) =>
  ctx.states
    .map((c) => screeningFactsFor(c, ctx.today))
    .filter((f): f is NonNullable<typeof f> => f !== null);

export const TYPE_THE_STATES_LINE =
  "Type the states this worker works in first; the rule on starting before the clearance arrives differs by state.";

function w1(ctx: WorkerItemContext): WorkerOnboardingItem[] {
  const facts = factsFor(ctx);
  const stateLines =
    ctx.states.length === 0
      ? [TYPE_THE_STATES_LINE]
      : facts.map((f) => f.pendingLine);
  return [
    {
      id: "w1-clearance",
      who: "owner",
      counts: "date",
      beforeFirstShift: true,
      clearanceKind: "ndis-worker-screening",
      text: `Check this worker's NDIS Worker Screening clearance in the NDIS Worker Screening Database, the "Eligible to work" field. Type the check number and expiry into the worker checks register and date the day you checked.`,
      stateLines,
      ask: "Show me this worker's clearance and the date you checked it in the database.",
      source: rules(
        "s 13(a) (a worker in a risk assessed role must hold a clearance) and s 15(4) (the provider verifies the application in the database)",
      ),
    },
    {
      id: "w1-application-recorded",
      who: "owner",
      counts: "number",
      beforeFirstShift: false,
      clearanceKind: "ndis-worker-screening",
      text: "Record the application number from the unit's written notice in the worker checks register, with the day you saw the notice, if the clearance is still pending.",
      ask: "Show me the application number and the unit's notice for any worker whose clearance is pending.",
      source: rules(
        "s 15(3) (in the process of obtaining a clearance: the unit's written notice, the provider's confirmation and the application number recorded) and s 18(3)(d)(i)",
      ),
    },
  ];
}

function w2(ctx: WorkerItemContext): WorkerOnboardingItem[] {
  if (!ctx.worksWithChildren) return [];
  const facts = factsFor(ctx);
  const terms = facts
    .filter((f) => f.childrenTermYears !== null)
    .map((f) => `${f.name} ${f.childrenTermYears} years`)
    .join("; ");
  const termLine = terms
    ? `The check's term: ${terms}. Type the expiry from the card.`
    : `The term differs by state; type the expiry from the card, or ${CHECK_YOUR_UNIT}.`;
  const stateLines =
    ctx.states.length === 0
      ? [
          "Type the states this worker works in first; in two states one registration carries both checks.",
        ]
      : [...facts.map((f) => f.combinedLine), termLine];
  return [
    {
      id: "w2-children-check",
      who: "owner",
      counts: "expiry",
      beforeFirstShift: true,
      clearanceKind: "wwcc",
      text: "Record this worker's working with children check in the worker checks register with its expiry, since their role is child-related work.",
      stateLines,
      ask: "Show me this worker's working with children check and its expiry.",
      source: {
        title: `The state's working with children scheme (${stateNames(ctx.states) || "your state"}); data/state-reference.json carries each unit's page and read date`,
        status:
          facts.length > 0 && facts.every((f) => f.combinedScheme !== null)
            ? "verified"
            : "unverified",
      },
    },
  ];
}

const W3: WorkerOnboardingItem = {
  id: "w3-code-of-conduct",
  who: "both",
  counts: "tick",
  beforeFirstShift: true,
  text: "Have the worker sign the NDIS Code of Conduct acknowledgement from your pack and keep the signed copy in their file.",
  ask: "Show me this worker's signed Code of Conduct acknowledgement.",
  source: {
    title:
      "NDIS (Code of Conduct) Rules 2018, s 5(2): persons employed or otherwise engaged by NDIS providers are Code-covered persons (compilation of 19 December 2023)",
    url: "https://www.legislation.gov.au/F2018L00629/latest/text",
    status: "verified",
  },
};

const W4: WorkerOnboardingItem = {
  id: "w4-orientation-module",
  who: "both",
  counts: "tick",
  beforeFirstShift: true,
  text: "Ask the worker to finish the NDIS Worker Orientation Module and keep the completion certificate; the module has no expiry.",
  ask: "Show me this worker's orientation module certificate.",
  source: {
    title:
      'NDIS Practice Standards, core module, human resource management: "completion of the mandatory NDIS worker orientation program"; verification module: "Workers complete mandatory NDIS orientation module" (dataset 1.2.0, verified 11 October 2026)',
    url: STANDARDS_URL,
    status: "verified",
  },
};

function w5(ctx: WorkerItemContext): WorkerOnboardingItem[] {
  if (ctx.ownerRow) return [];
  const vic = ctx.states.includes("VIC");
  return [
    {
      id: "w5-induction",
      who: "both",
      counts: "date",
      beforeFirstShift: true,
      text: "Walk the worker through your induction procedure from the pack and record the date; the worker confirms it on their own home.",
      ask: "Show me the date this worker was inducted and what the induction covered.",
      source: {
        title: `Work health and safety law: the duty to give information, training, instruction or supervision (${vic ? "Occupational Health and Safety Act 2004 (Vic) s 21(2)(e)" : "model Work Health and Safety Act s 19(3)(f)"}; the sections are for the lawyer to confirm)`,
        status: "unverified",
      },
    },
  ];
}

const W6: WorkerOnboardingItem = {
  id: "w6-policies",
  who: "both",
  counts: "tick",
  beforeFirstShift: true,
  text: `Walk the worker through ${MANDATORY_POLICIES}, and have them sign the acknowledgement.`,
  ask: "Show me this worker's signed acknowledgement of the mandatory policies.",
  source: {
    title:
      'NDIS Practice Standards, core module, human resource management: an orientation and induction process "completed by workers" (dataset 1.2.0)',
    url: STANDARDS_URL,
    status: "verified",
  },
};

/** W-7: the training the modules name, keyed by the standard or module id (Dev answer 2); a unit test asserts every id is in the dataset. */
export const TRAINING_BY_MODULE: readonly {
  key: string;
  id: string;
  clearanceKind: string;
  text: string;
  ask: string;
  source: ItemSource;
  yourCall?: boolean;
}[] = [
  {
    key: "core.environment.management-of-medication",
    id: "w7-medication",
    clearanceKind: "medication",
    text: "Record this worker's medication training in the worker checks register with its expiry, if they will administer medication.",
    ask: "Show me this worker's medication training and its expiry.",
    source: {
      title:
        'NDIS Practice Standards, core module, management of medication: "All workers responsible for administering medication understand the effects and side-effects of the medication" (dataset 1.2.0)',
      url: STANDARDS_URL,
      status: "verified",
    },
  },
  {
    key: "hidpa",
    id: "w7-high-intensity",
    clearanceKind: "other",
    text: "Record this worker's training against the high intensity support skills descriptors for each support they deliver, with its expiry.",
    ask: "Show me this worker's high intensity training and its expiry.",
    source: {
      title:
        'NDIS Practice Standards, high intensity daily personal activities module: workers "have the skills and knowledge described in the high intensity support skills descriptors" (dataset 1.2.0)',
      url: STANDARDS_URL,
      status: "verified",
    },
  },
  {
    key: "sbs",
    id: "w7-pbs",
    clearanceKind: "other",
    text: "Record this worker's positive behaviour support capability training with its expiry.",
    ask: "Show me this worker's behaviour support training and its expiry.",
    source: {
      title:
        "NDIS Practice Standards, specialist behaviour support module (dataset 1.2.0)",
      url: STANDARDS_URL,
      status: "verified",
    },
  },
  {
    key: "ibsp",
    id: "w7-pbs",
    clearanceKind: "other",
    text: "Record this worker's training in implementing behaviour support plans, with its expiry.",
    ask: "Show me this worker's behaviour support training and its expiry.",
    source: {
      title:
        "NDIS Practice Standards, implementing behaviour support plans module (dataset 1.2.0)",
      url: STANDARDS_URL,
      status: "verified",
    },
  },
  {
    key: "core",
    id: "w7-first-aid",
    clearanceKind: "first-aid",
    yourCall: true,
    text: `Record this worker's first aid certificate with its expiry. Where the certificate shows none we suggest ${FIRST_AID_SUGGESTED_YEARS} years, Readyline's suggestion, so check the date on the certificate.`,
    ask: "Show me this worker's first aid certificate and its expiry.",
    source: {
      title:
        "Your call: no Rule or Standard sets first aid for every worker; personal care and community access make it likely",
      status: "unverified",
    },
  },
  {
    key: "core",
    id: "w7-cpr",
    clearanceKind: "cpr",
    yourCall: true,
    text: `Record this worker's CPR certificate with its expiry. Where the certificate shows none we suggest ${CPR_SUGGESTED_YEARS} year, Readyline's suggestion, so check the date on the certificate.`,
    ask: "Show me this worker's CPR certificate and its expiry.",
    source: {
      title:
        "Your call: no Rule or Standard sets CPR for every worker; personal care and community access make it likely",
      status: "unverified",
    },
  },
  {
    key: "core",
    id: "w7-manual-handling",
    clearanceKind: "manual-handling",
    yourCall: true,
    text: "Record this worker's manual handling training with its expiry, if they lift, transfer or position people.",
    ask: "Show me this worker's manual handling training and its expiry.",
    source: {
      title:
        "Your call: no Rule or Standard sets manual handling for every worker; personal care makes it likely",
      status: "unverified",
    },
  },
];

function w7(ctx: WorkerItemContext): WorkerOnboardingItem[] {
  const out: WorkerOnboardingItem[] = [];
  const seen = new Set<string>();
  for (const t of TRAINING_BY_MODULE) {
    const applies =
      ctx.moduleIds.includes(t.key) ||
      ctx.moduleIds.some((m) => t.key.startsWith(`${m}.`));
    if (!applies || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({
      id: t.id,
      who: "owner",
      counts: "expiry",
      beforeFirstShift: false,
      clearanceKind: t.clearanceKind,
      text: t.text,
      ask: t.ask,
      source: t.source,
      yourCall: t.yourCall,
    });
  }
  return out;
}

function w8(ctx: WorkerItemContext): WorkerOnboardingItem[] {
  if (ctx.ownerRow) return [];
  return [
    {
      id: "w8-supervision",
      who: "owner",
      counts: "date",
      beforeFirstShift: false,
      text: "Book the first supervision for within a month and type the date into the staff matrix.",
      ask: "Show me when this worker was last supervised.",
      source: {
        title:
          "NDIS Practice Standards, core module, human resource management: timely supervision; the monthly cadence is Readyline's suggestion",
        url: STANDARDS_URL,
        status: "verified",
      },
    },
  ];
}

function w9(ctx: WorkerItemContext): WorkerOnboardingItem[] {
  if (!ctx.mayUseRestrictivePractice) return [];
  const stateLines = ctx.states
    .map((c) => STATE_FILE.states[c])
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => `${s.name}: ${s.restrictivePractice.text}`);
  return [
    {
      id: "w9-restrictive-practice",
      who: "owner",
      counts: "tick",
      beforeFirstShift: false,
      text: "Add your behaviour support arrangements and the state authorisation pathway to this worker's induction, since they may use a restrictive practice.",
      stateLines,
      ask: "Show me how this worker was inducted into your behaviour support arrangements.",
      source: {
        title:
          "NDIS (Restrictive Practices and Behaviour Support) Rules 2018; the state authorisation pathway from data/state-reference.json (D-2223 item 3; VERIFY per state)",
        status: "unverified",
      },
    },
  ];
}

const W10: WorkerOnboardingItem = {
  id: "w10-other-checks",
  who: "owner",
  counts: "expiry",
  beforeFirstShift: false,
  text: "Type any police check or driver licence this worker's role needs into the worker checks register with its expiry.",
  ask: "Show me this worker's police check or driver licence, where the role needs one.",
  source: {
    title:
      "Your own recruitment procedure (REQ-005): a police check and a driver licence for transport supports are what a real provider holds",
    status: "unverified",
  },
};

const FIXED: WorkerOnboardingItem[] = [
  {
    id: "identity-and-agreement",
    who: "owner",
    counts: "tick",
    beforeFirstShift: true,
    text: "Check the worker's identity and sign the employment or contractor agreement; file both.",
    ask: "Show me this worker's agreement and that you saw their identity.",
    source: {
      title:
        "Your own recruitment procedure (REQ-005) and s 19 of the Worker Screening Rules (the personnel contract records are the provider's paper file)",
      url: RULES.url,
      status: "verified",
    },
  },
  {
    id: "participant-plans-read",
    who: "both",
    counts: "tick",
    beforeFirstShift: true,
    text: "Have the worker read the support plan and the risk row for each participant they will support.",
    ask: "How does a new worker learn each participant's plan and risks before their first shift?",
    source: {
      title:
        "NDIS Practice Standards, core module, support planning and responsive support provision (dataset 1.2.0)",
      url: STANDARDS_URL,
      status: "verified",
    },
  },
  {
    id: "emergency-plan-shown",
    who: "owner",
    counts: "tick",
    beforeFirstShift: true,
    text: "Show the worker the emergency and disaster plan and where the first aid kit is.",
    ask: "How does a new worker learn your emergency and disaster plan?",
    source: {
      title:
        "NDIS Practice Standards, core module, emergency and disaster management (dataset 1.2.0)",
      url: STANDARDS_URL,
      status: "verified",
    },
  },
];

/**
 * FR-2: the worker's derived list, in the order an auditor walks it: identity,
 * the clearance (and the pending application), the children's check, the
 * Code of Conduct, the orientation module, induction, the policies, the
 * participant plans, the emergency plan, training, supervision, restrictive
 * practices, other checks. A role that is not risk assessed has no W-1.
 */
export function workerOnboardingItems(
  ctx: WorkerItemContext,
): WorkerOnboardingItem[] {
  return [
    FIXED[0],
    ...(ctx.riskAssessed ? w1(ctx) : []),
    ...w2(ctx),
    W3,
    W4,
    ...w5(ctx),
    W6,
    FIXED[1],
    FIXED[2],
    ...w7(ctx),
    ...w8(ctx),
    ...w9(ctx),
    W10,
  ];
}

/** The before-first-shift items of a derived list (FR-4). */
export function beforeFirstShiftItems(
  items: readonly WorkerOnboardingItem[],
): WorkerOnboardingItem[] {
  return items.filter((i) => i.beforeFirstShift);
}

/** Every W id the derivation can produce, for the migration's statement and the tests (finding 189). */
export const WORKER_ITEM_IDS = [
  "identity-and-agreement",
  "w1-clearance",
  "w1-application-recorded",
  "w2-children-check",
  "w3-code-of-conduct",
  "w4-orientation-module",
  "w5-induction",
  "w6-policies",
  "participant-plans-read",
  "emergency-plan-shown",
  "w7-first-aid",
  "w7-cpr",
  "w7-medication",
  "w7-manual-handling",
  "w7-high-intensity",
  "w7-pbs",
  "w8-supervision",
  "w9-restrictive-practice",
  "w10-other-checks",
] as const;

/** The REQ-018 worker list as it was, for the migration's snapshot and the id map's test; the derived list replaces it on every page. */
export const LEGACY_WORKER_ITEM_IDS = [
  "identity-and-agreement",
  "screening-clearance-seen",
  "other-checks-recorded",
  "orientation-module",
  "policies-walked-through",
  "participant-plans-read",
  "emergency-plan-shown",
  "supervision-booked",
] as const;

export const PARTICIPANT_ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    id: "service-agreement-signed",
    text: "Go through the service agreement in plain words and have the participant or their representative sign it.",
  },
  {
    id: "consent-recorded",
    text: "Record consent to collect and use personal information, and to any recording, on the consent form.",
  },
  {
    id: "support-plan-written",
    text: "Write the support plan with the participant's goals and set its review date in the participant risk register.",
  },
  {
    id: "risk-row-added",
    text: "Add the participant's row to the participant risk register, by code, with what you do about each risk.",
  },
  {
    id: "medical-emergency-list",
    text: "Write the participant's medical emergency list with the agreed action for each item, and keep it with their plan.",
  },
  {
    id: "rights-and-complaints-explained",
    text: "Explain the participant's rights, how to complain to you and to the Commission, and give them the written version.",
  },
  {
    id: "workers-introduced",
    text: "Introduce the workers who will support them and note any preferences about who comes.",
  },
];

/** A worker checklist with no matrix row yet reads the list for a risk assessed worker with nothing typed (finding 81). */
export const UNKNOWN_WORKER_CONTEXT: Omit<WorkerItemContext, "today"> = {
  role: null,
  states: [],
  worksWithChildren: false,
  mayUseRestrictivePractice: false,
  ownerRow: false,
  riskAssessed: true,
  moduleIds: [],
};

/** The checklist's items: the participant list as data, a worker's derived from the worker's context (or the unknown-worker context). */
export function onboardingItemsFor(
  kind: OnboardingKind,
  ctx?: WorkerItemContext,
): OnboardingItem[] {
  if (kind === "participant") return PARTICIPANT_ONBOARDING_ITEMS;
  return workerOnboardingItems(
    ctx ?? { ...UNKNOWN_WORKER_CONTEXT, today: "1970-01-01" },
  );
}

/** The item's source line as one sentence, for the owner's view and the export. */
export function sourceLine(s: ItemSource): string {
  return `${s.status === "unverified" ? "UNVERIFIED: " : ""}${s.title}${s.url ? ` (${s.url})` : ""}.`;
}

export type { FactSource };

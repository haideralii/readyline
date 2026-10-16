/**
 * The readiness checklist (REQ-006 FR-1, FR-2, FR-6), derived from the
 * questionnaire result and answers. Pure: dataset in, items out. Every item
 * cites where it comes from (`sourceRef`) and says why in plain words; an
 * item the Commission's text in the dataset does not state is `unverified`
 * (CLAUDE.md 4.6). Nothing here invents a requirement: the first-aid item
 * the REQ mentions is not derived because no registration group in
 * `standards.json` ties first aid to a class.
 */
import { glossaryMeaning } from "@/lib/questionnaire/content";
import { mustStartBy, type RegistrationPeriod } from "@/lib/registers/timeline";
import type { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import type { StandardsDataset } from "@/lib/standards/schema";

export const CHECKLIST_GROUP_IDS = [
  "documents",
  "registers",
  "people",
  "business",
  "audit",
] as const;
export type ChecklistGroupId = (typeof CHECKLIST_GROUP_IDS)[number];

export const CHECKLIST_GROUP_TITLES: Record<ChecklistGroupId, string> = {
  documents: "Documents",
  registers: "Registers",
  people: "People",
  business: "Business",
  audit: "Audit",
};

/** The statuses a provider sets (FR-3); `drafted` is computed from a generated set, never stored. */
export const CHECKLIST_STATUSES = ["need", "in-progress", "have"] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export type SourceRef =
  | {
      kind: "standard";
      /** A standard id in standards.json; `indicator` is the 1-based quality indicator quoted. */
      id: string;
      indicator?: number;
      title: string;
      url: string;
    }
  | { kind: "rule"; id: "midTermAudit"; title: string; url: string }
  | { kind: "source"; id: string; title: string; url: string }
  | { kind: "content"; id: "document-sets"; title: string };

/**
 * One tap to do the item where the app can (REQ-017 step 6): an in-app
 * route, never an external site. A document item's link needs the set id,
 * which the page adds; `documentTypeId` marks it.
 */
export type ChecklistAction = { label: string; href: string };

export type ChecklistItem = {
  /** Stable across derivations: "<group>:<slug>"; the persistence key. */
  id: string;
  group: ChecklistGroupId;
  /** An instruction in the customer's voice: what to do, where to type it. */
  title: string;
  /** What the auditor says on the day (batch 45 item 4), never the provider's instruction. */
  ask: string;
  action?: ChecklistAction;
  /** One line, plain words. */
  why: string;
  sourceRef: SourceRef;
  /** True when the dataset's Commission text does not state the requirement. */
  unverified: boolean;
  /** From the "already have" answers (FR-2). */
  initialStatus: ChecklistStatus;
  /** REQ-025 D-2216: the one line a pre-ticked document or register carries in its detail. */
  haveNote?: string;
  /** For People items: how many people the item covers. */
  count?: number;
  /** For Documents: the document type id, so a generated set can mark it drafted. */
  documentTypeId?: string;
  /** REQ-023 FR-4: a dated audit item; the provider records the date it happened, which sets the status (finding 80). */
  dated?: boolean;
  /** REQ-023 FR-4: the date the item is measured against, shown beside it. */
  dueDate?: string;
};

/** REQ-023 FR-4: what the checklist needs from the current registration period (finding 62). */
export type ChecklistPeriod = {
  midtermApplies: boolean;
  /** The must-start-by date (Rules s 13B, or the override), when the mid-term audit applies. */
  mustStartBy: string;
  periodEndsOn: string;
};

export type ChecklistGroup = {
  id: ChecklistGroupId;
  title: string;
  items: ChecklistItem[];
};

export type Checklist = {
  groups: ChecklistGroup[];
  items: ChecklistItem[];
  total: number;
};

function sourceUrl(dataset: StandardsDataset, sourceId: string): string {
  return dataset.sources.find((s) => s.id === sourceId)?.url ?? "";
}

function sourceTitle(dataset: StandardsDataset, sourceId: string): string {
  return dataset.sources.find((s) => s.id === sourceId)?.title ?? sourceId;
}

function standardRef(
  dataset: StandardsDataset,
  id: string,
  indicator?: number,
): SourceRef {
  const s = dataset.standards.find((x) => x.id === id);
  if (!s) throw new Error(`checklist: unknown standard ${id}`);
  return {
    kind: "standard",
    id,
    indicator,
    title: s.name,
    url: sourceUrl(dataset, s.sourceId),
  };
}

function sourceRef(dataset: StandardsDataset, sourceId: string): SourceRef {
  return {
    kind: "source",
    id: sourceId,
    title: sourceTitle(dataset, sourceId),
    url: sourceUrl(dataset, sourceId),
  };
}

// REQ-015 FR-2: the customer never sees a file path; the reason is the plain fact.
const CONTENT_REF: SourceRef = {
  kind: "content",
  id: "document-sets",
  title: "Every registered provider needs this",
};

/** REQ-017 step 6: each register item as the thing to do, in the customer's words. */
const REGISTER_INSTRUCTIONS: Record<string, string> = {
  incidents:
    "Start your incident register and record each incident on the day it happens",
  complaints:
    "Start your complaints register and record each complaint on the day it comes in",
  "worker-clearances":
    "Type each worker's screening clearance and its expiry date into your clearance register",
  "policy-reviews":
    "Start your policy review register and note when each policy is next due",
  training:
    "Start your training register and note each worker's training and when it expires",
  "restrictive-practices":
    "Start your restrictive practice use register and record every use on the day",
};

/** The register pages the app has; a register without a page gets no tap. */
const REGISTER_ROUTES: Record<string, string> = {
  incidents: "/registers/incidents",
  complaints: "/registers/complaints",
  "worker-clearances": "/registers/worker-checks",
  "policy-reviews": "/registers/policy-reviews",
};

/** The standard that names a register as evidence, within the applicable modules. */
function registerStandardRef(
  dataset: StandardsDataset,
  moduleIds: readonly string[],
  registerId: string,
): SourceRef | null {
  const wanted = `register.${registerId}`;
  // "incidents" -> "incident": the standard named for the register wins over
  // one that merely samples it (the abuse-and-neglect standard also reads the
  // incident register).
  const stem = registerId.split("-")[0].replace(/s$/, "");
  for (const moduleId of moduleIds) {
    const candidates = dataset.standards.filter(
      (x) =>
        x.moduleId === moduleId &&
        x.evidence.some((e) => e.documentTypeId === wanted),
    );
    const s = candidates.find((x) => x.id.includes(stem)) ?? candidates[0];
    if (s) return standardRef(dataset, s.id);
  }
  return null;
}

/** The HR-management standard in scope: verification's for a verification audit, the core one otherwise. */
function hrStandard(moduleIds: readonly string[]): {
  id: string;
  orientationIndicator: number;
} {
  return moduleIds.includes("core")
    ? {
        id: "core.governance.human-resource-management",
        orientationIndicator: 3,
      }
    : { id: "verification.human-resource-management", orientationIndicator: 2 };
}

function riskStandard(moduleIds: readonly string[]): {
  id: string;
  insuranceIndicator: number;
} {
  return moduleIds.includes("core")
    ? { id: "core.governance.risk-management", insuranceIndicator: 6 }
    : { id: "verification.risk-management", insuranceIndicator: 2 };
}

function have(answer: "yes" | "no" | "not-sure" | "unknown"): ChecklistStatus {
  return answer === "yes" ? "have" : "need";
}

/**
 * REQ-025 D-2216: "already have" means review, not skip. A step-5 "Yes"
 * pre-ticks the item and adds this line to it; the pack drafts the full set
 * regardless, for documents and registers alike.
 */
export const ALREADY_HAVE_LINE =
  "You said you have this. Compare it with the draft and keep one: an auditor needs it tailored, understood and followed.";

function haveNote(answer: "yes" | "no" | "not-sure" | "unknown") {
  return answer === "yes" ? ALREADY_HAVE_LINE : undefined;
}

/** REQ-023 FR-4: what the checklist reads from the current period, or nothing without one. */
export function checklistPeriod(
  period: RegistrationPeriod | null | undefined,
): ChecklistPeriod | undefined {
  if (!period) return undefined;
  return {
    midtermApplies: period.midterm_applies,
    mustStartBy: mustStartBy(period),
    periodEndsOn: period.period_ends_on,
  };
}

export function deriveChecklist(
  result: QuestionnaireResult,
  answers: QuestionnaireAnswers,
  dataset: StandardsDataset,
  period?: ChecklistPeriod,
): Checklist {
  const moduleIds = result.modules.map((m) => m.id);
  const moduleNames = new Map(result.modules.map((m) => [m.id, m.name]));
  const items: ChecklistItem[] = [];

  // Documents: one per document in the set (FR-1), pre-filled from "already have" (FR-2).
  for (const d of result.documents) {
    const from = d.fromModules.map((id) => moduleNames.get(id) ?? id);
    items.push({
      id: `documents:${d.id}`,
      group: "documents",
      title: `Read your ${d.title} and adopt it`,
      ask: `Show me your ${d.title}, adopted and dated.`,
      why:
        from.length === 0
          ? "Every provider's set includes this; auditors ask to see it."
          : `Brought in by the ${from.join(" and ")} module${from.length === 1 ? "" : "s"}; auditors ask to see it.`,
      sourceRef: CONTENT_REF,
      unverified: false,
      initialStatus: have(d.have),
      haveNote: haveNote(d.have),
      documentTypeId: d.id,
    });
  }

  // Registers: one per register, cited to the standard whose evidence names it.
  for (const r of result.registers) {
    const ref = registerStandardRef(dataset, moduleIds, r.id);
    const route = REGISTER_ROUTES[r.id];
    items.push({
      id: `registers:${r.id}`,
      group: "registers",
      title:
        REGISTER_INSTRUCTIONS[r.id] ??
        `Start your ${r.title.toLowerCase()} and keep it up to date`,
      ask: `Show me your ${r.title.toLowerCase()}, with the entries up to date.`,
      action: route
        ? { label: `Open the ${r.title.toLowerCase()}`, href: route }
        : undefined,
      why: ref
        ? `Auditors sample this register as evidence for the ${ref.title} standard, and you keep it after registration.`
        : "Kept after registration so policy reviews are on time; auditors ask how reviews are tracked.",
      sourceRef: ref ?? CONTENT_REF,
      unverified: false,
      initialStatus: have(r.have),
      haveNote: haveNote(r.have),
    });
  }

  // People.
  const hr = hrStandard(moduleIds);
  const w = answers.workforce;
  const screeningCount = w.hasRiskAssessedRoles
    ? Math.max(w.keyPersonnelCount, 1)
    : w.keyPersonnelCount;
  const keyPeople = `${w.keyPersonnelCount} key ${w.keyPersonnelCount === 1 ? "person" : "personnel"}`;
  items.push({
    id: "people:worker-screening-clearances",
    group: "people",
    title: w.hasRiskAssessedRoles
      ? `Ask your ${keyPeople} and every worker in a risk-assessed role for their NDIS Worker Screening clearance, and type each expiry date here`
      : `Ask your ${keyPeople} for their NDIS Worker Screening clearance, and type each expiry date here`,
    ask: w.hasRiskAssessedRoles
      ? "Show me a current NDIS Worker Screening clearance for each key person and each worker in a risk-assessed role."
      : "Show me a current NDIS Worker Screening clearance for each key person.",
    action: { label: "Add a clearance", href: "/registers/worker-checks/new" },
    why: "Auditors sample worker files for a current clearance and check the clearance register's expiry dates.",
    sourceRef: standardRef(dataset, hr.id),
    // The Worker Screening Rules are not in the dataset; the evidence item is Readyline's.
    unverified: true,
    initialStatus: w.allRiskAssessedScreened === "yes" ? "have" : "need",
    count: screeningCount,
  });
  items.push({
    id: "people:worker-orientation-module",
    group: "people",
    title: `Ask all ${w.workerCount} worker${w.workerCount === 1 ? "" : "s"} to complete the NDIS Worker Orientation Module and keep each certificate`,
    ask: "Show me each worker's NDIS Worker Orientation Module certificate.",
    why: "The Practice Standards require every worker to complete the Commission's orientation module as part of induction; keep the certificates.",
    sourceRef: standardRef(dataset, hr.id, hr.orientationIndicator),
    unverified: false,
    initialStatus: "need",
    count: w.workerCount,
  });

  // Business.
  items.push({
    id: "business:abn",
    group: "business",
    title: "Get an ABN for the business and type it on your account page",
    ask: "What is your ABN, and is it in the business name you registered under?",
    action: { label: "Open your account page", href: "/account" },
    why: "The registration rules say an applicant must have an ABN; the application form asks for it first.",
    sourceRef: sourceRef(dataset, "legislation-rules-toc"),
    unverified: false,
    initialStatus: answers.business.abn?.trim() ? "have" : "need",
  });
  const risk = riskStandard(moduleIds);
  const insurances: [string, string, string][] = [
    [
      "public-liability",
      "Get public liability insurance and keep the certificate of currency",
      "public liability",
    ],
    [
      "professional-indemnity",
      "Get professional indemnity insurance and keep the certificate of currency",
      "professional indemnity",
    ],
    [
      "personal-accident",
      "Get personal accident insurance and keep the certificate of currency",
      "personal accident",
    ],
  ];
  for (const [slug, title, kind] of insurances) {
    items.push({
      id: `business:insurance-${slug}`,
      group: "business",
      title,
      ask: `Show me your current ${kind} insurance certificate.`,
      why: "The risk management standard says appropriate insurance is in place, naming professional indemnity, public liability and accident insurance; auditors ask for current certificates.",
      sourceRef: standardRef(dataset, risk.id, risk.insuranceIndicator),
      unverified: false,
      initialStatus: have(answers.existing.insuranceCertificate),
    });
  }
  if (w.workerCount > 1 || answers.business.structure === "company") {
    items.push({
      id: "business:insurance-workers-compensation",
      group: "business",
      title:
        "Get workers compensation insurance for your workers and keep the certificate",
      ask: "Show me your current workers compensation certificate.",
      why: "A state or territory requirement for employers, not a Commission requirement; auditors commonly ask for it alongside the other certificates.",
      sourceRef: CONTENT_REF,
      unverified: true,
      initialStatus: "need",
    });
  }

  // Audit (FR-6).
  const audits = sourceRef(dataset, "types-of-audits");
  const certification = result.pathway === "certification";
  items.push({
    id: "audit:choose-auditor",
    group: "audit",
    title:
      "Choose an approved quality auditor from the Commission's list and ask for a quote",
    ask: "Which approved quality auditor are you using, and what did they quote?",
    why: "Registration needs an audit against the Practice Standards by an approved quality auditor from the Commission's list. Readyline takes no fee or commission from any auditor.",
    sourceRef: audits,
    unverified: false,
    initialStatus: "need",
  });
  // REQ-023 FR-4 (finding 62): with a registration period the first-audit
  // booking item and the mid-term calendar item give way to the dated items
  // at the end; without one, both stay, because the applicant still has a
  // first audit to book.
  if (!period)
    items.push({
      id: "audit:book-audit",
      group: "audit",
      title: certification
        ? "Book your certification audit with the auditor; it includes a site visit"
        : "Book your verification audit with the auditor; it is a desktop review of your documents",
      ask: certification
        ? "When is the site visit booked, and who will be there?"
        : "When is the desktop review booked, and what will you send?",
      // REQ-025 FR-13: the audit kind's meaning comes from the glossary, the one source.
      why: certification
        ? `Certification audit: ${glossaryMeaning("certification-audit")}; the visit includes participant and worker interviews.`
        : `Verification audit: ${glossaryMeaning("verification-audit")}.`,
      sourceRef: audits,
      unverified: false,
      initialStatus: "need",
    });
  // Batch 45 item 11 (auditor review): a signed service agreement is the first thing sampled from a participant file.
  items.push({
    id: "audit:service-agreements",
    group: "audit",
    title:
      "Keep a signed service agreement for each participant where you can find it on the day",
    ask: "Show me a signed service agreement for each participant.",
    why: "The service agreement standard expects an agreement with each participant; auditors sample participant files for a signed copy.",
    sourceRef: standardRef(
      dataset,
      moduleIds.includes("core")
        ? "core.provision.service-agreements-with-participants"
        : "verification.human-resource-management",
    ),
    unverified: !moduleIds.includes("core"),
    initialStatus: "need",
  });
  if (certification) {
    items.push({
      id: "audit:participant-interview-consent",
      group: "audit",
      title:
        "Ask participants whether they agree to be interviewed by the auditor, and note only that they agreed",
      ask: "Show me that participants agreed to be interviewed, without their health details.",
      why: "The auditor interviews participants during a certification audit; arrange consent in advance and record only that it was given, never health details.",
      sourceRef: audits,
      unverified: false,
      initialStatus: "need",
    });
    items.push({
      id: "audit:worker-interview-availability",
      group: "audit",
      title:
        "Tell your workers the audit days and make sure some are free for an interview",
      ask: "Which workers are free for an interview on the audit days?",
      why: "The auditor interviews workers during a certification audit.",
      sourceRef: audits,
      unverified: false,
      initialStatus: "need",
    });
    if (result.midTermAudit.applies && !period) {
      items.push({
        id: "audit:mid-term-audit-date",
        group: "audit",
        title: `Put your mid-term audit in the calendar: about ${result.midTermAudit.monthsAfterRegistration} months after registration`,
        ask: "When is your mid-term audit due, and what will you have ready for it?",
        why: `Certified providers have a mid-term audit against the governance standards; start preparing from month ${result.midTermAudit.prepareFromMonth}.`,
        sourceRef: {
          kind: "rule",
          id: "midTermAudit",
          title: sourceTitle(dataset, dataset.rules.midTermAudit.sourceId),
          url: sourceUrl(dataset, dataset.rules.midTermAudit.sourceId),
        },
        unverified: false,
        initialStatus: "need",
      });
    }
  }

  // REQ-023 FR-4: the dated audit items once a registration period exists.
  // The change-of-ownership item waits for Session D's changes register,
  // which is the only thing that can say a change of ownership happened.
  if (period) {
    const midTermRef: SourceRef = {
      kind: "rule",
      id: "midTermAudit",
      title: sourceTitle(dataset, dataset.rules.midTermAudit.sourceId),
      url: sourceUrl(dataset, dataset.rules.midTermAudit.sourceId),
    };
    if (period.midtermApplies)
      items.push({
        id: "audit:mid-term-audit-started",
        group: "audit",
        title: `Type the date your mid-term audit started; it must start by ${period.mustStartBy}`,
        ask: "Which auditing company did your mid-term audit, and on what date did it start?",
        why: "A certification provider's mid-term audit must start within 18 months of the period beginning, or by the date the Commissioner allows (Rules s 13B(4)); an approved quality auditor carries it out (s 13B(2)).",
        sourceRef: midTermRef,
        unverified: false,
        initialStatus: "need",
        dated: true,
        dueDate: period.mustStartBy,
      });
    items.push({
      id: "audit:renewal-application-submitted",
      group: "audit",
      title: "Type the date you applied for renewal in the Commission's portal",
      ask: "When did you apply for renewal, and was it inside the six months before your period ends?",
      why: "An application made within six months before the period ends keeps your registration in force while the Commission decides (NDIS Act s 73K); your period ends on the date your certificate states.",
      sourceRef: audits,
      unverified: false,
      initialStatus: "need",
      dated: true,
      dueDate: period.periodEndsOn,
    });
    items.push({
      id: "audit:renewal-audit-done",
      group: "audit",
      title: "Type the date your renewal audit was done",
      ask: "When was your renewal audit, and which auditing company did it?",
      why: "The renewal follows the same steps as the application: you apply, the Commission sends the scope of audit, an approved quality auditor audits you, and the Commission decides.",
      sourceRef: audits,
      unverified: false,
      initialStatus: "need",
      dated: true,
      dueDate: period.periodEndsOn,
    });
  }

  const groups: ChecklistGroup[] = CHECKLIST_GROUP_IDS.map((id) => ({
    id,
    title: CHECKLIST_GROUP_TITLES[id],
    items: items.filter((i) => i.group === id),
  })).filter((g) => g.items.length > 0);
  return { groups, items, total: items.length };
}

/** "14 of 31 items ready" (FR-3): ready means `have`. */
export function progressLine(ready: number, total: number): string {
  return `${ready} of ${total} item${total === 1 ? "" : "s"} ready`;
}

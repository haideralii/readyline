/**
 * "What the auditor will ask to see" (REQ-018 FR-11, AC-4; D-1907): the
 * twelve records from the evidence list in the auditor research, each
 * with the live state of the matching register (filled, nothing recorded,
 * overdue) and the tap that fixes it. Pure: counts in, lines out; the
 * audit-day page renders them and the test pins the twelve.
 */
import type { AuditDayOverview } from "@/server/registers/audit-day-queries";
import type { RegisterOverview } from "./overview";
import type { DocumentControlRow } from "./document-control";
import { documentControlSentence } from "./document-control";

export type AskLine = {
  id: string;
  /** The auditor's words. */
  ask: string;
  state: "filled" | "missing" | "overdue";
  /** The state in the customer's words. */
  word: string;
  /** Where one tap takes them to fix or fill it. */
  href: string;
  action: string;
};

export const ASK_COUNT = 12;

function fromOverview(
  o: { total: number; attention: number; attentionLabel: string },
  href: string,
  addLabel: string,
): Pick<AskLine, "state" | "word" | "href" | "action"> {
  if (o.total === 0)
    return {
      state: "missing",
      word: "Nothing recorded yet.",
      href,
      action: addLabel,
    };
  if (o.attentionLabel.endsWith("overdue"))
    return {
      state: "overdue",
      word: `${o.attentionLabel}.`,
      href,
      action: "Fix it",
    };
  return {
    state: "filled",
    word: `${o.total} ${o.total === 1 ? "entry" : "entries"}; ${o.attentionLabel.toLowerCase()}.`,
    href,
    action: "Open",
  };
}

export function auditDayAskList(input: {
  registers: RegisterOverview;
  auditDay: AuditDayOverview;
  documentControl: DocumentControlRow[];
}): AskLine[] {
  const { registers: r, auditDay: a, documentControl: dc } = input;
  const dcOverdue = dc.filter((d) => d.state === "overdue").length;
  const dcMissing = dc.length === 0 || dc.some((d) => !d.adopted_on);
  return [
    {
      id: "document-control",
      ask: "Your document control register: every policy with its version, when it was adopted, by whom, and when it is next reviewed",
      state: dcOverdue ? "overdue" : dcMissing ? "missing" : "filled",
      word: documentControlSentence(dc),
      href: "/registers/document-control",
      action: dcMissing ? "Adopt your documents" : "Open",
    },
    {
      id: "decisions",
      ask: "Your record of decisions or meeting minutes",
      ...fromOverview(a.decisions, "/registers/decisions", "Add a decision"),
    },
    {
      id: "corporate-risks",
      ask: "Your corporate risk register, every area filled, a review date on every row",
      ...fromOverview(
        a["corporate-risks"],
        "/registers/corporate-risks",
        "Open the register",
      ),
    },
    {
      id: "participant-risks",
      ask: "Your participant risk register, one line per participant",
      ...fromOverview(
        a["participant-risks"],
        "/registers/participant-risks",
        "Add a participant",
      ),
    },
    {
      id: "conflicts-of-interest",
      ask: "Your conflict of interest register, with review dates",
      ...fromOverview(
        a["conflicts-of-interest"],
        "/registers/conflicts-of-interest",
        "Add a conflict",
      ),
    },
    {
      id: "delegations",
      ask: "Your delegations register: who acts when you are away",
      ...fromOverview(a.delegations, "/registers/delegations", "Add a role"),
    },
    {
      id: "insurances",
      ask: "Your insurance certificates and, if you drive participants, your vehicle and driver records",
      ...fromOverview(a.insurances, "/registers/insurances", "Add an item"),
    },
    {
      id: "improvements",
      ask: "Your continuous improvement register, fed by incidents, complaints and feedback",
      ...fromOverview(
        a.improvements,
        "/registers/improvements",
        "Add an improvement",
      ),
    },
    {
      id: "staff-matrix",
      ask: "Your staff matrix: each worker's screening, training, supervision and appraisal",
      ...fromOverview(
        a["staff-matrix"],
        "/registers/staff-matrix",
        "Add a worker",
      ),
    },
    {
      id: "onboarding",
      ask: "A signed and dated onboarding checklist for each worker and each participant",
      ...fromOverview(
        a.onboarding,
        "/registers/onboarding",
        "Start a checklist",
      ),
    },
    {
      id: "incidents",
      ask: "Your incident register, with the reportable ones standing out",
      ...(r.incidents.total === 0
        ? {
            state: "missing" as const,
            word: "Nothing recorded yet.",
            href: "/registers/incidents",
            action: "Open the register",
          }
        : r.incidents.overdueNotification > 0
          ? {
              state: "overdue" as const,
              word: `${r.incidents.overdueNotification} overdue to notify the Commission.`,
              href: "/registers/incidents",
              action: "Fix it",
            }
          : {
              state: "filled" as const,
              word: `${r.incidents.total} ${r.incidents.total === 1 ? "entry" : "entries"}; ${r.incidents.open} open.`,
              href: "/registers/incidents",
              action: "Open",
            }),
    },
    {
      id: "complaints",
      ask: "Your complaints register, separate from feedback, with resolution times",
      ...(r.complaints.total === 0
        ? {
            state: "missing" as const,
            word: "Nothing recorded yet.",
            href: "/registers/complaints",
            action: "Open the register",
          }
        : {
            state: "filled" as const,
            word: `${r.complaints.total} ${r.complaints.total === 1 ? "entry" : "entries"}; ${r.complaints.unresolved} unresolved.`,
            href: "/registers/complaints",
            action: "Open",
          }),
    },
  ];
}

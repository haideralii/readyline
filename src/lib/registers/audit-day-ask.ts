/**
 * "What the auditor will ask to see" (REQ-018 FR-11, AC-4; D-1907): the
 * twelve records from the evidence list in the auditor research, each
 * with the live state of the matching register (filled, nothing recorded,
 * overdue) and the tap that fixes it. Pure: counts in, lines out; the
 * audit-day page renders them and the test pins the count.
 */
import type { AuditDayOverview } from "@/server/registers/audit-day-queries";
import type { RegisterOverview } from "./overview";
import type { DocumentControlRow } from "./document-control";
import { documentControlSentence, newVersionsAsk } from "./document-control";
import {
  AUDIT_DAY_RECORDS,
  auditRecordTier,
  type AuditRecordTier,
} from "./names";

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
  /** Named by the standards and the Rules, or asked for in practice (batch 45, REQ-018-gated item). */
  tier: AuditRecordTier;
  /** A signed or issued document kept on paper; the register holds its dates. */
  paper: boolean;
};

/** The twelve records of REQ-018 plus the hazard register (REQ-020 FR-7): the one list in names.ts, which the pack's "items to prepare" also reads. */
export const ASK_COUNT = AUDIT_DAY_RECORDS.length;

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
  // REQ-024 A0 (D-2436): a set whose rows carry new versions and nothing missing names them.
  const dcNewVersions = newVersionsAsk(dc);
  const lines: Omit<AskLine, "ask" | "tier" | "paper">[] = [
    {
      id: "document-control",
      state: dcOverdue ? "overdue" : dcMissing ? "missing" : "filled",
      word:
        !dcMissing && dcNewVersions
          ? `${documentControlSentence(dc)} ${dcNewVersions}.`
          : documentControlSentence(dc),
      href: dcNewVersions ? "/path/adopt" : "/registers/document-control",
      action: dcMissing
        ? "Adopt your documents"
        : dcNewVersions
          ? "Adopt the new versions"
          : "Open",
    },
    {
      id: "decisions",
      ...fromOverview(a.decisions, "/registers/decisions", "Add a decision"),
    },
    {
      id: "corporate-risks",
      ...fromOverview(
        a["corporate-risks"],
        "/registers/corporate-risks",
        "Open the register",
      ),
    },
    {
      id: "participant-risks",
      ...fromOverview(
        a["participant-risks"],
        "/registers/participant-risks",
        "Add a participant",
      ),
    },
    {
      id: "conflicts-of-interest",
      ...fromOverview(
        a["conflicts-of-interest"],
        "/registers/conflicts-of-interest",
        "Add a conflict",
      ),
    },
    {
      id: "delegations",
      ...fromOverview(a.delegations, "/registers/delegations", "Add a role"),
    },
    {
      // REQ-020 FR-7: the hazard register, with its live state.
      id: "hazards",
      ...fromOverview(a.hazards, "/registers/hazards", "Add a hazard"),
    },
    {
      id: "insurances",
      ...fromOverview(a.insurances, "/registers/insurances", "Add an item"),
    },
    {
      id: "improvements",
      ...fromOverview(
        a.improvements,
        "/registers/improvements",
        "Add an improvement",
      ),
    },
    {
      id: "staff-matrix",
      ...fromOverview(
        a["staff-matrix"],
        "/registers/staff-matrix",
        "Add a worker",
      ),
    },
    {
      id: "onboarding",
      ...fromOverview(
        a.onboarding,
        "/registers/onboarding",
        "Start a checklist",
      ),
    },
    {
      id: "incidents",
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
  // The auditor's words, the tier and the paper mark come from the one list
  // in names.ts, so the page, the self-assessment and this list can never
  // disagree (PO, 15 Oct 2026).
  const askOf = new Map(AUDIT_DAY_RECORDS.map((r) => [r.id, r.ask]));
  return lines.map((l) => ({
    ...l,
    ask: askOf.get(l.id) ?? "",
    ...auditRecordTier(l.id),
  }));
}

/**
 * "Due soon" on the account page (batch 45 item 5, REQ-009 FR-3): every
 * notify-by and review date inside the window, from the live register rows
 * rather than only the reminder rows the nightly job has inserted, so the
 * page is right on the day something is logged. Pure, so the order and the
 * words are unit-tested: an incident's "Notify by" comes first, then worker
 * checks expiring, then policy reviews due, then the stored reminders for
 * everything else (registration dates, the audit-day registers).
 */
import { notifyByWords, type NotifyByRow } from "./notify-by-line";

export type DueSoonInput = {
  /** ISO date, the account's today. */
  today: string;
  /** Days ahead, inclusive. */
  days: number;
  incidents: readonly ({
    id: string;
    reference: string;
    reportable_notified_on: string | null;
    status: string;
  } & NotifyByRow)[];
  /** REQ-032 FR-2: the account's states, for the holidays that moved a notify-by date (FR-5). */
  states?: readonly string[];
  clearances: readonly {
    id: string;
    worker_ref: string;
    role_label: string;
    expires_on: string | null;
  }[];
  policyReviews: readonly {
    id: string;
    title: string;
    next_review_on: string | null;
  }[];
  /** Reminder rows already stored, with their lines resolved; kinds the live rows cover are dropped. */
  stored: readonly {
    id: string;
    kind: string;
    line: string;
    dueOn: string;
    sent: boolean;
  }[];
};

export type DueSoonLine = {
  id: string;
  line: string;
  dueOn: string;
  sent: boolean;
};

const LIVE_KINDS = new Set([
  "incident-notify",
  "clearance-expiry",
  "policy-review",
]);

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dueSoonLines(input: DueSoonInput): DueSoonLine[] {
  const until = addDays(input.today, input.days);
  const inWindow = (date: string | null): date is string =>
    Boolean(date) && (date as string) <= until;
  const out: DueSoonLine[] = [];
  // Incidents first: a reportable one not yet notified, by its notify-by date (overdue stays listed).
  for (const i of [...input.incidents].sort((a, b) =>
    (a.notify_by ?? "").localeCompare(b.notify_by ?? ""),
  )) {
    if (!i.reportable || i.reportable_notified_on || i.status === "closed")
      continue;
    if (!inWindow(i.notify_by)) continue;
    out.push({
      id: `incident:${i.id}`,
      line: `Notify the Commission about incident ${i.reference} by ${notifyByWords(i, input.states ?? [])}.`,
      dueOn: i.notify_by,
      sent: false,
    });
  }
  for (const c of [...input.clearances].sort((a, b) =>
    (a.expires_on ?? "").localeCompare(b.expires_on ?? ""),
  )) {
    if (!inWindow(c.expires_on)) continue;
    out.push({
      id: `clearance:${c.id}`,
      line: `Worker check for ${c.worker_ref} (${c.role_label}) expires on ${c.expires_on}.`,
      dueOn: c.expires_on,
      sent: false,
    });
  }
  for (const p of [...input.policyReviews].sort((a, b) =>
    (a.next_review_on ?? "").localeCompare(b.next_review_on ?? ""),
  )) {
    if (!inWindow(p.next_review_on)) continue;
    out.push({
      id: `policy:${p.id}`,
      line: `Policy ${p.title} is due for review on ${p.next_review_on}.`,
      dueOn: p.next_review_on,
      sent: false,
    });
  }
  for (const s of [...input.stored].sort((a, b) =>
    a.dueOn.localeCompare(b.dueOn),
  )) {
    if (LIVE_KINDS.has(s.kind)) continue;
    out.push({
      id: `stored:${s.id}`,
      line: s.line,
      dueOn: s.dueOn,
      sent: s.sent,
    });
  }
  return out;
}

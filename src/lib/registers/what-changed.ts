/**
 * "What changed since the last audit" (REQ-023 Session B, FR-6; D-2340),
 * pure over the four REQ-009 registers' rows and one period: counts per
 * register, the documents adopted or reviewed in the period, the documents
 * due for review before the registration period ends, and the workers whose
 * checks were added, renewed or expired in the period, as codes and counts
 * and never a name (SR-1). The screen and the pack's CSV read one object so
 * they cannot disagree (AC-4). The changes notified and variations applied
 * for (FR-10) join this summary in Session D, when that register exists.
 */
import { inPeriod, periodQuery, type Period } from "./period";
import { formatLongDate } from "./status";

export const WHAT_CHANGED_TITLE = "What changed since the last audit";
export const THIS_PERIOD_TITLE = "This registration period";

/** The pack's file name for the summary: by the last-audit date when one exists, else the period's (FR-6). */
export function whatChangedFileName(hasLastAudit: boolean): string {
  return hasLastAudit ? "since-last-audit.csv" : "this-registration-period.csv";
}

/** FR-6: when there is no last-audit date the screen says why it shows the whole period. */
export function whatChangedWhy(periodStartsOn: string): string {
  return `You have not recorded the date of your last audit, so this covers your whole registration period, from ${formatLongDate(periodStartsOn)}. Enter the date on the account page.`;
}

export type WhatChangedIncident = {
  status: string;
  notification_status?: string;
  occurred_on: string;
  reportable_notified_on: string | null;
};
export type WhatChangedComplaint = {
  status: string;
  received_on: string;
};
export type WhatChangedCheck = {
  worker_ref: string;
  clearance_kind: string;
  issued_on: string | null;
  expires_on: string | null;
};
export type WhatChangedReview = {
  document_type_id: string;
  title: string;
  adopted_on: string | null;
  last_reviewed_on: string | null;
  next_review_on: string | null;
};

export type WhatChangedInput = {
  /** The summary's period: since the last audit, or the registration period when no last-audit date exists. */
  period: Period;
  periodStartsOn: string;
  periodEndsOn: string;
  lastAuditOn: string | null;
  today: string;
  /** The incidents an auditor sees (`auditorVisibleIncidents`), unfiltered. */
  incidents: readonly WhatChangedIncident[];
  complaints: readonly WhatChangedComplaint[];
  checks: readonly WhatChangedCheck[];
  reviews: readonly WhatChangedReview[];
  /** The document's title for the register's row (the catalogue's, or the row's own for "other"). */
  titleOf: (typeId: string, title: string) => string;
};

export type RegisterCount = {
  id: "incidents" | "complaints" | "worker-checks" | "policy-reviews";
  name: string;
  href: string;
  entries: number;
  /** Null where the register has no such state; the screen shows a dash. */
  open: number | null;
  overdue: number | null;
  notified: number | null;
};

export type DocumentLine = {
  typeId: string;
  title: string;
  /** Which date put it in the period, and that date. */
  event: "adopted" | "reviewed";
  date: string;
  nextReviewOn: string | null;
  href: string;
};

export type DueLine = {
  typeId: string;
  title: string;
  nextReviewOn: string;
  href: string;
};

export type WorkerEvent = "added" | "renewed" | "expired";
export type WorkerLine = {
  code: string;
  kind: string;
  event: WorkerEvent;
  date: string;
  href: string;
};

export type WhatChanged = {
  title: string;
  why: string | null;
  period: Period;
  registers: RegisterCount[];
  documents: DocumentLine[];
  due: DueLine[];
  workers: WorkerLine[];
  workerCounts: Record<WorkerEvent, number>;
};

const dated = (d: string | null | undefined, p: Period): d is string =>
  Boolean(d) && inPeriod(d, p);

export function whatChanged(input: WhatChangedInput): WhatChanged {
  const p = input.period;
  const q = periodQuery(p);
  const incidents = input.incidents.filter((r) => dated(r.occurred_on, p));
  const complaints = input.complaints.filter((r) => dated(r.received_on, p));
  const issued = input.checks.filter((r) => dated(r.issued_on, p));
  const expired = input.checks.filter(
    (r) => dated(r.expires_on, p) && r.expires_on! < input.today,
  );
  const reviewed = input.reviews.filter(
    (r) => dated(r.adopted_on, p) || dated(r.last_reviewed_on, p),
  );

  const registers: RegisterCount[] = [
    {
      id: "incidents",
      name: "Incident register",
      href: `/registers/incidents${q}`,
      entries: incidents.length,
      open: incidents.filter(
        (r) => r.status === "open" || r.status === "under-review",
      ).length,
      overdue: incidents.filter(
        (r) => r.notification_status === "overdue-notification",
      ).length,
      notified: incidents.filter((r) => r.reportable_notified_on).length,
    },
    {
      id: "complaints",
      name: "Complaints register",
      href: `/registers/complaints${q}`,
      entries: complaints.length,
      open: complaints.filter(
        (r) => !["resolved", "withdrawn"].includes(r.status),
      ).length,
      overdue: null,
      notified: complaints.filter((r) => r.status === "escalated-to-commission")
        .length,
    },
    {
      id: "worker-checks",
      name: "Worker checks register",
      href: `/registers/worker-checks${q}`,
      entries: issued.length,
      open: null,
      overdue: expired.length,
      notified: null,
    },
    {
      id: "policy-reviews",
      name: "Policy review register",
      href: `/registers/policy-reviews${q}`,
      entries: reviewed.length,
      open: null,
      overdue: null,
      notified: null,
    },
  ];

  const documents: DocumentLine[] = reviewed
    .map((r) => {
      const byReview = dated(r.last_reviewed_on, p);
      return {
        typeId: r.document_type_id,
        title: input.titleOf(r.document_type_id, r.title),
        event: (byReview ? "reviewed" : "adopted") as DocumentLine["event"],
        date: byReview ? r.last_reviewed_on! : r.adopted_on!,
        nextReviewOn: r.next_review_on,
        href: `/registers/policy-reviews${q}`,
      };
    })
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    );

  const due: DueLine[] = input.reviews
    .filter((r) => r.next_review_on && r.next_review_on <= input.periodEndsOn)
    .map((r) => ({
      typeId: r.document_type_id,
      title: input.titleOf(r.document_type_id, r.title),
      nextReviewOn: r.next_review_on!,
      href: `/registers/policy-reviews`,
    }))
    .sort(
      (a, b) =>
        a.nextReviewOn.localeCompare(b.nextReviewOn) ||
        a.title.localeCompare(b.title),
    );

  const workerHref = `/registers/worker-checks${q}`;
  const workers: WorkerLine[] = [
    ...issued.map((r) => {
      const earlier = input.checks.some(
        (c) =>
          c.worker_ref === r.worker_ref &&
          c.clearance_kind === r.clearance_kind &&
          c.issued_on !== null &&
          c.issued_on < r.issued_on!,
      );
      return {
        code: r.worker_ref,
        kind: r.clearance_kind,
        event: (earlier ? "renewed" : "added") as WorkerEvent,
        date: r.issued_on!,
        href: workerHref,
      };
    }),
    ...expired.map((r) => ({
      code: r.worker_ref,
      kind: r.clearance_kind,
      event: "expired" as WorkerEvent,
      date: r.expires_on!,
      href: workerHref,
    })),
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code),
  );

  const workerCounts: Record<WorkerEvent, number> = {
    added: workers.filter((w) => w.event === "added").length,
    renewed: workers.filter((w) => w.event === "renewed").length,
    expired: workers.filter((w) => w.event === "expired").length,
  };

  return {
    title: input.lastAuditOn ? WHAT_CHANGED_TITLE : THIS_PERIOD_TITLE,
    why: input.lastAuditOn ? null : whatChangedWhy(input.periodStartsOn),
    period: p,
    registers,
    documents,
    due,
    workers,
    workerCounts,
  };
}

/** The pack's CSV (FR-6, AC-4): one flat sheet the screen's four sections share. */
export const WHAT_CHANGED_COLUMNS = [
  "section",
  "item",
  "detail",
  "date",
] as const;

const count = (n: number | null) => (n === null ? "n/a" : String(n));

export function whatChangedRows(w: WhatChanged): Record<string, unknown>[] {
  return [
    ...w.registers.map((r) => ({
      section: "registers",
      item: r.name,
      detail: `entries ${r.entries}; open ${count(r.open)}; overdue ${count(r.overdue)}; notified ${count(r.notified)}`,
      date: "",
    })),
    ...w.documents.map((d) => ({
      section: "documents",
      item: d.title,
      detail: `${d.event} in the period${d.nextReviewOn ? `; next review ${d.nextReviewOn}` : ""}`,
      date: d.date,
    })),
    ...w.due.map((d) => ({
      section: "documents-due",
      item: d.title,
      detail: "due for review before the registration period ends",
      date: d.nextReviewOn,
    })),
    ...w.workers.map((x) => ({
      section: "workers",
      item: x.code,
      detail: `${x.kind} ${x.event}`,
      date: x.date,
    })),
  ];
}

/** The worker line on the screen: counts and codes, never a name. */
export function workerSummaryLine(w: WhatChanged): string {
  const parts = (["added", "renewed", "expired"] as const)
    .filter((e) => w.workerCounts[e] > 0)
    .map((e) => {
      const codes = [
        ...new Set(w.workers.filter((x) => x.event === e).map((x) => x.code)),
      ];
      return `${w.workerCounts[e]} ${e} (${codes.join(", ")})`;
    });
  return parts.length
    ? `Checks ${parts.join("; ")}.`
    : "No check was added, renewed or expired in the period.";
}

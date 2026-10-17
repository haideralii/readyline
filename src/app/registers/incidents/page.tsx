import type { Metadata } from "next";
import Link from "next/link";
import {
  listIncidents,
  type IncidentListRow,
} from "@/server/registers/queries";
import { CATEGORY_LABELS } from "@/lib/registers/labels";
import { reportsToConfirmLine } from "@/lib/registers/worker";
import {
  INCIDENT_COLUMNS,
  cellsFor,
  tableColumns,
} from "@/lib/registers/table-columns";
import { RegisterList, type ListRow } from "../_components/register-list";
import { RegisterPage, registerContext } from "../_components/shell";

export const metadata: Metadata = { title: "Incidents register" };

/**
 * An unconfirmed report outranks everything (REQ-020 FR-5: the 24 hours run
 * from the report); then an overdue notification; otherwise a closed
 * incident reads as closed even if a notification date is still open. A
 * rejected report keeps its row, marked, and counts nowhere, except one in
 * a reportable category (retro finding 62, Incident Rules s 17): received,
 * not recorded, with its Commission clock until the owner settles it.
 */
export function incidentStatus(r: IncidentListRow): ListRow["status"] {
  if (r.status === "draft")
    return { key: "draft", label: "To confirm", tone: "signal" };
  if (r.status === "rejected") {
    if (r.reportable && r.notification_status === "overdue-notification")
      return {
        key: "received-not-recorded",
        label: "Received, not recorded; overdue to notify",
        tone: "signal",
      };
    if (r.reportable && r.notification_status === "notification-due")
      return {
        key: "received-not-recorded",
        label: `Received, not recorded; notify by ${r.notify_by}`,
        tone: "signal",
      };
    if (r.reportable)
      return {
        key: "received-not-recorded",
        label: "Received, not recorded; Commission told",
        tone: "slate",
      };
    return { key: "rejected", label: "Rejected", tone: "slate" };
  }
  if (r.notification_status === "overdue-notification")
    return {
      key: "overdue-notification",
      label: "Overdue to notify",
      tone: "signal",
    };
  if (r.status === "closed")
    return { key: "closed", label: "Closed", tone: "moss" };
  if (r.notification_status === "notification-due")
    return {
      key: "notification-due",
      label: `Notify by ${r.notify_by}`,
      tone: "ochre",
    };
  if (r.status === "under-review")
    return { key: "under-review", label: "Under review", tone: "slate" };
  return { key: "open", label: "Open", tone: "ochre" };
}

export const INCIDENT_FILTERS = [
  { key: "draft", label: "To confirm" },
  { key: "open", label: "Open" },
  { key: "under-review", label: "Under review" },
  { key: "notification-due", label: "To notify" },
  { key: "overdue-notification", label: "Overdue" },
  { key: "closed", label: "Closed" },
  { key: "received-not-recorded", label: "Received, not recorded" },
  { key: "rejected", label: "Rejected" },
];

/** The row's one line: the date, the participant code, who logged it when it was not the owner, the summary's start. */
export function incidentDetail(r: IncidentListRow): string {
  const who =
    r.reported_via === "link"
      ? ` Reported through your link${r.logged_by_ref ? ` by ${r.logged_by_ref}` : ""}.`
      : r.reported_via === "worker" && r.logged_by_ref
        ? ` Logged by ${r.logged_by_ref}.`
        : "";
  return `${r.occurred_on}${r.participant_ref ? `, ${r.participant_ref}` : ""}.${who} ${r.summary.slice(0, 80)}${r.summary.length > 80 ? "…" : ""}`;
}

export default async function IncidentsPage() {
  const ctx = await registerContext("/registers/incidents");
  const rows = await listIncidents(ctx.supabase, ctx.viewer.account.id);
  const drafts = rows.filter((r) => r.status === "draft");
  const toConfirm = reportsToConfirmLine(drafts.length);
  return (
    <RegisterPage
      title="Incidents"
      intro="Every incident, with what you did and whether the Commission had to be told. People appear as codes, never names."
      canWrite={ctx.canWrite}
      addHref="/registers/incidents/new"
      addLabel="Add an incident"
      exportHref="/registers/incidents/export.zip"
      exportLabel="Download the register and its events (zip of two CSV files)"
      count={rows.length}
      importHref="/registers/incidents/import"
      back={{ href: "/registers", label: "Registers" }}
    >
      {toConfirm ? (
        // REQ-020 FR-5, FR-6: the drafts first, each one tap from its confirmation screen.
        <section
          aria-labelledby="to-confirm-heading"
          className="border-signal mt-5 rounded-md border p-3"
          data-testid="reports-to-confirm"
        >
          <h2 id="to-confirm-heading" className="">
            {toConfirm}
          </h2>
          <p className="text-ink mt-1 text-sm leading-6">
            Read each one and confirm it, or reject it with a reason. Until you
            confirm it, it is not in your register.
          </p>
          <ul className="mt-2">
            {drafts.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/registers/incidents/${r.id}/confirm`}
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                  data-testid="confirm-report-link"
                >
                  Confirm {r.reference}: {CATEGORY_LABELS[r.category]}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <RegisterList
        testId="incidents-list"
        rows={rows.map((r) => ({
          id: r.id,
          href:
            r.status === "draft"
              ? `/registers/incidents/${r.id}/confirm`
              : `/registers/incidents/${r.id}`,
          title: `${r.reference}: ${CATEGORY_LABELS[r.category]}`,
          detail: incidentDetail(r),
          status: incidentStatus(r),
          cells: cellsFor(INCIDENT_COLUMNS, r),
        }))}
        filters={INCIDENT_FILTERS}
        columns={tableColumns(INCIDENT_COLUMNS)}
        emptyAction={
          ctx.canWrite
            ? { href: "/registers/incidents/new", label: "Add an incident" }
            : undefined
        }
        importHref={ctx.canWrite ? "/registers/incidents/import" : undefined}
        empty="No incidents recorded yet. Add one as soon as something happens; the date you record is part of the evidence."
      />
    </RegisterPage>
  );
}

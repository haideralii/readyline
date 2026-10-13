import type { Metadata } from "next";
import {
  listIncidents,
  type IncidentListRow,
} from "@/server/registers/queries";
import { CATEGORY_LABELS } from "@/lib/registers/labels";
import { RegisterList, type ListRow } from "../_components/register-list";
import { RegisterPage, registerContext } from "../_components/shell";

export const metadata: Metadata = { title: "Incidents register" };

/** An overdue notification outranks everything; otherwise a closed incident reads as closed even if a notification date is still open. */
export function incidentStatus(r: IncidentListRow): ListRow["status"] {
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
  { key: "open", label: "Open" },
  { key: "under-review", label: "Under review" },
  { key: "notification-due", label: "To notify" },
  { key: "overdue-notification", label: "Overdue" },
  { key: "closed", label: "Closed" },
];

export default async function IncidentsPage() {
  const ctx = await registerContext("/registers/incidents");
  const rows = await listIncidents(ctx.supabase, ctx.viewer.account.id);
  return (
    <RegisterPage
      title="Incidents"
      intro="Every incident, with what you did and whether the Commission had to be told. People appear as codes, never names."
      canWrite={ctx.canWrite}
      addHref="/registers/incidents/new"
      addLabel="Add an incident"
      exportHref="/registers/incidents/export.zip"
      back={{ href: "/registers", label: "Registers" }}
    >
      <RegisterList
        testId="incidents-list"
        rows={rows.map((r) => ({
          id: r.id,
          href: `/registers/incidents/${r.id}`,
          title: `${r.reference}: ${CATEGORY_LABELS[r.category]}`,
          detail: `${r.occurred_on}${r.participant_ref ? `, ${r.participant_ref}` : ""}. ${r.summary.slice(0, 80)}${r.summary.length > 80 ? "…" : ""}`,
          status: incidentStatus(r),
        }))}
        filters={INCIDENT_FILTERS}
        empty="No incidents recorded yet. Add one as soon as something happens; the date you record is part of the evidence."
      />
    </RegisterPage>
  );
}

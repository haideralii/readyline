import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getIncident } from "@/server/registers/queries";
import { CATEGORY_LABELS } from "@/lib/registers/labels";
import { INCIDENT_COLUMNS } from "@/lib/registers/names";
import { EventsTrail } from "../../_components/events-trail";
import { StatusTag } from "../../_components/register-list";
import { RegisterPage, registerContext } from "../../_components/shell";
import { incidentStatus } from "../page";

export const metadata: Metadata = { title: "Incident" };

const SEVERITY = { low: "Low", medium: "Medium", high: "High" } as const;

export default async function IncidentPage({
  params,
  searchParams,
}: PageProps<"/registers/incidents/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await registerContext(`/registers/incidents/${id}`);
  const found = await getIncident(ctx.supabase, ctx.viewer.account.id, id);
  if (!found) notFound();
  const r = found.row;
  // REQ-020 FR-5, FR-6: a report waiting for the owner has one screen, the confirmation.
  if (r.status === "draft") redirect(`/registers/incidents/${id}/confirm`);
  const rows: [string, string][] = [
    // Batch 45 item 17: the same words as the paper register in the pack (names.ts).
    [INCIDENT_COLUMNS.category, CATEGORY_LABELS[r.category]],
    [INCIDENT_COLUMNS.severity, SEVERITY[r.severity]],
    [INCIDENT_COLUMNS.occurred_on, r.occurred_on],
    [INCIDENT_COLUMNS.reported_on, r.reported_on],
    ["Participant", r.participant_ref ?? "Not recorded"],
    ["Worker", r.worker_ref ?? "Not recorded"],
    // REQ-020 FR-4, FR-5: who logged it, when it was not the owner.
    ...(r.reported_via === "worker"
      ? [["Logged by", r.logged_by_ref ?? "A worker"] as [string, string]]
      : r.reported_via === "link"
        ? [
            [
              "Reported through your link by",
              r.logged_by_ref ?? "Not recorded",
            ] as [string, string],
          ]
        : []),
    ...(r.status === "rejected"
      ? [["Rejected because", r.rejected_reason] as [string, string]]
      : []),
    [INCIDENT_COLUMNS.reportable, r.reportable ? "Yes" : "No"],
    ...(r.notify_by
      ? [["Notify the Commission by", r.notify_by] as [string, string]]
      : []),
    ...(r.reportable_notified_on
      ? [
          [
            INCIDENT_COLUMNS.reportable_notified_on,
            r.reportable_notified_on,
          ] as [string, string],
        ]
      : []),
    ...(r.commission_reference
      ? [
          [INCIDENT_COLUMNS.commission_reference, r.commission_reference] as [
            string,
            string,
          ],
        ]
      : []),
    ...(r.closed_on ? [["Closed on", r.closed_on] as [string, string]] : []),
  ];
  return (
    <RegisterPage
      title={`${r.reference}: ${CATEGORY_LABELS[r.category]}`}
      canWrite={ctx.canWrite}
      back={{ href: "/registers/incidents", label: "Incidents" }}
    >
      {sp.saved ? (
        <p
          role="status"
          className="text-moss mt-3 text-sm"
          data-testid="register-saved"
        >
          ✓ Saved.
        </p>
      ) : null}
      <p className="mt-3">
        <StatusTag status={incidentStatus(r)} />
      </p>
      <dl
        className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2"
        data-testid="incident-facts"
      >
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-zinc-600 dark:text-zinc-400">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-6 text-lg font-semibold">What happened</h2>
      <p className="mt-1 leading-7" data-testid="incident-summary">
        {r.summary}
      </p>
      {r.actions_taken ? (
        <>
          <h2 className="mt-4 text-lg font-semibold">What you did about it</h2>
          <p className="mt-1 leading-7">{r.actions_taken}</p>
        </>
      ) : null}
      {ctx.canWrite && r.status === "closed" ? (
        // REQ-018 FR-6, AC-2: one tap to turn a closed incident into an improvement row, source pre-filled.
        <p
          className="border-ochre mt-5 rounded-md border p-3 text-sm leading-6"
          data-testid="improvement-offer"
        >
          What did you learn from this one?{" "}
          <Link
            href={`/registers/improvements/new?source_kind=incident&source_ref=${encodeURIComponent(r.reference)}`}
            className="underline underline-offset-2"
            data-testid="improvement-link"
          >
            Add it to the improvement register
          </Link>
          .
        </p>
      ) : null}
      {ctx.canWrite && r.status !== "rejected" ? (
        <p className="mt-5">
          <Link
            href={`/registers/incidents/${r.id}/edit`}
            className="btn-secondary"
            data-testid="register-edit"
          >
            Edit this incident
          </Link>
        </p>
      ) : null}
      <EventsTrail
        kind="incident"
        subjectId={r.id}
        events={found.events}
        canWrite={ctx.canWrite}
      />
    </RegisterPage>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CATEGORY_LABELS, SEVERITY_LABELS } from "@/lib/registers/labels";
import { INCIDENT_COLUMNS } from "@/lib/registers/names";
import { awareSentence } from "@/lib/registers/worker";
import { getIncident } from "@/server/registers/queries";
import { RegisterPage, registerContext } from "../../../_components/shell";
import { ConfirmReportForm } from "./confirm-form";

export const metadata: Metadata = { title: "Confirm a report" };

/**
 * The owner's one screen for a report (REQ-020 FR-5, FR-6; PO review 14
 * Oct): what the reporter wrote, read-only; when the provider became aware
 * and the 24-hour mark from it; the two Commission-notification fields; one
 * Confirm button, and Reject with a reason folded under it. A confirmed
 * report becomes an ordinary open row dated from what the reporter gave.
 */
export default async function ConfirmReportPage({
  params,
}: PageProps<"/registers/incidents/[id]/confirm">) {
  const { id } = await params;
  const ctx = await registerContext(`/registers/incidents/${id}/confirm`);
  const found = await getIncident(ctx.supabase, ctx.viewer.account.id, id);
  if (!found) notFound();
  const r = found.row;
  if (r.status !== "draft") redirect(`/registers/incidents/${id}`);
  const facts: [string, string][] = [
    [INCIDENT_COLUMNS.category, CATEGORY_LABELS[r.category]],
    [INCIDENT_COLUMNS.severity, SEVERITY_LABELS[r.severity]],
    [INCIDENT_COLUMNS.occurred_on, r.occurred_on],
    ["Participant", r.participant_ref ?? "Not recorded"],
    ["Worker involved", r.worker_ref ?? "Not recorded"],
    [
      r.reported_via === "link" ? "Reported through your link by" : "Logged by",
      r.logged_by_ref ?? "Not recorded",
    ],
  ];
  return (
    <RegisterPage
      title={`Confirm ${r.reference}`}
      intro="Someone reported this to you. Read it, then confirm it into your register or reject it with a reason. It is not in your register until you confirm it."
      canWrite={ctx.canWrite}
      back={{ href: "/registers/incidents", label: "Incidents" }}
    >
      <p
        className="border-signal mt-5 rounded-md border p-3 text-sm leading-6"
        role="status"
        data-testid="aware-line"
      >
        {awareSentence(
          new Date(r.aware_at),
          { category: r.category, severity: r.severity },
          ctx.viewer.account.states,
        )}
      </p>
      <dl
        className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2"
        data-testid="report-facts"
      >
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-slate">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-6">What happened</h2>
      <p className="mt-1 leading-7" data-testid="report-summary">
        {r.summary}
      </p>
      {r.actions_taken ? (
        <>
          <h2 className="mt-4">What was done straight away</h2>
          <p className="mt-1 leading-7">{r.actions_taken}</p>
        </>
      ) : null}
      {ctx.canWrite ? (
        <ConfirmReportForm id={r.id} category={r.category} />
      ) : null}
    </RegisterPage>
  );
}

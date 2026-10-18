import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { fromIncidentRow } from "@/lib/registers/labels";
import { getIncident } from "@/server/registers/queries";
import { IncidentFormView } from "../../../_components/incident-form";
import { RegisterPage, registerContext } from "../../../_components/shell";

export const metadata: Metadata = { title: "Edit incident" };

export default async function EditIncidentPage({
  params,
}: PageProps<"/registers/incidents/[id]/edit">) {
  const { id } = await params;
  const ctx = await registerContext(`/registers/incidents/${id}/edit`);
  if (!ctx.canWrite) redirect(`/registers/incidents/${id}`);
  const found = await getIncident(ctx.supabase, ctx.viewer.account.id, id);
  if (!found) notFound();
  // REQ-020 FR-5: a draft is confirmed on its own screen; a rejected report is kept as it was.
  if (found.row.status === "draft")
    redirect(`/registers/incidents/${id}/confirm`);
  if (found.row.status === "rejected") redirect(`/registers/incidents/${id}`);
  return (
    <RegisterPage
      title={`Edit ${found.row.reference}`}
      canWrite={ctx.canWrite}
      back={{ href: `/registers/incidents/${id}`, label: found.row.reference }}
    >
      <IncidentFormView
        id={id}
        initial={fromIncidentRow(found.row)}
        states={ctx.viewer.account.states}
      />
    </RegisterPage>
  );
}

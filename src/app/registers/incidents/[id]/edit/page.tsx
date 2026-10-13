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
  return (
    <RegisterPage
      title={`Edit ${found.row.reference}`}
      canWrite={ctx.canWrite}
      back={{ href: `/registers/incidents/${id}`, label: found.row.reference }}
    >
      <IncidentFormView id={id} initial={fromIncidentRow(found.row)} />
    </RegisterPage>
  );
}

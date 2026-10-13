import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { fromComplaintRow } from "@/lib/registers/labels";
import { getComplaint } from "@/server/registers/queries";
import { ComplaintFormView } from "../../../_components/complaint-form";
import { RegisterPage, registerContext } from "../../../_components/shell";

export const metadata: Metadata = { title: "Edit complaint" };

export default async function EditComplaintPage({
  params,
}: PageProps<"/registers/complaints/[id]/edit">) {
  const { id } = await params;
  const ctx = await registerContext(`/registers/complaints/${id}/edit`);
  if (!ctx.canWrite) redirect(`/registers/complaints/${id}`);
  const found = await getComplaint(ctx.supabase, ctx.viewer.account.id, id);
  if (!found) notFound();
  return (
    <RegisterPage
      title={`Edit ${found.row.reference}`}
      canWrite={ctx.canWrite}
      back={{ href: `/registers/complaints/${id}`, label: found.row.reference }}
    >
      <ComplaintFormView id={id} initial={fromComplaintRow(found.row)} />
    </RegisterPage>
  );
}

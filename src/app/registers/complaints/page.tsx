import type { Metadata } from "next";
import type { ComplaintRow } from "@/lib/registers/types";
import { listComplaints } from "@/server/registers/queries";
import { COMPLAINT_STATUS_LABELS } from "@/lib/registers/labels";
import { RegisterList, type ListRow } from "../_components/register-list";
import { RegisterPage, registerContext } from "../_components/shell";

export const metadata: Metadata = { title: "Complaints register" };

export function complaintStatus(r: ComplaintRow): ListRow["status"] {
  const label = COMPLAINT_STATUS_LABELS[r.status];
  if (r.status === "resolved" || r.status === "withdrawn")
    return { key: r.status, label, tone: "moss" };
  if (r.status === "escalated-to-commission")
    return { key: r.status, label, tone: "signal" };
  if (r.status === "received" && !r.acknowledged_on)
    return { key: "received", label: "Not yet acknowledged", tone: "ochre" };
  return { key: r.status, label, tone: "slate" };
}

export const COMPLAINT_FILTERS = [
  { key: "received", label: "Not acknowledged" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "in-progress", label: "In progress" },
  { key: "escalated-to-commission", label: "Escalated" },
  { key: "resolved", label: "Resolved" },
  { key: "withdrawn", label: "Withdrawn" },
];

export default async function ComplaintsPage() {
  const ctx = await registerContext("/registers/complaints");
  const rows = await listComplaints(ctx.supabase, ctx.viewer.account.id);
  return (
    <RegisterPage
      title="Complaints"
      intro="Every complaint, how it arrived, what you did and how it ended. Acknowledge each one quickly; the date is part of the evidence."
      canWrite={ctx.canWrite}
      addHref="/registers/complaints/new"
      addLabel="Add a complaint"
      exportHref="/registers/complaints/export.zip"
      back={{ href: "/registers", label: "Registers" }}
    >
      <RegisterList
        testId="complaints-list"
        rows={rows.map((r) => ({
          id: r.id,
          href: `/registers/complaints/${r.id}`,
          title: `${r.reference}: ${r.summary.slice(0, 60)}${r.summary.length > 60 ? "…" : ""}`,
          detail: `Received ${r.received_on}${r.from_ref ? ` from ${r.from_ref}` : ""}.`,
          status: complaintStatus(r),
        }))}
        filters={COMPLAINT_FILTERS}
        empty="No complaints recorded yet. A complaint is any expression of dissatisfaction; record it even when it is resolved on the spot."
      />
    </RegisterPage>
  );
}

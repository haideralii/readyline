import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getComplaint } from "@/server/registers/queries";
import { COMPLAINT_STATUS_LABELS } from "@/lib/registers/labels";
import { EventsTrail } from "../../_components/events-trail";
import { StatusTag } from "../../_components/register-list";
import { RegisterPage, registerContext } from "../../_components/shell";
import { complaintStatus } from "../page";

export const metadata: Metadata = { title: "Complaint" };

const CHANNEL: Record<string, string> = {
  phone: "Phone",
  email: "Email",
  "in-person": "In person",
  form: "Written form or letter",
  advocate: "Through an advocate",
  other: "Other",
};

export default async function ComplaintPage({
  params,
  searchParams,
}: PageProps<"/registers/complaints/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await registerContext(`/registers/complaints/${id}`);
  const found = await getComplaint(ctx.supabase, ctx.viewer.account.id, id);
  if (!found) notFound();
  const r = found.row;
  const rows: [string, string][] = [
    ["Received", r.received_on],
    ["How it arrived", CHANNEL[r.channel] ?? r.channel],
    ["Raised by", r.from_ref ?? "Not recorded"],
    ["Status", COMPLAINT_STATUS_LABELS[r.status]],
    ["Acknowledged", r.acknowledged_on ?? "Not yet"],
    ["Resolved", r.resolved_on ?? "Not yet"],
  ];
  return (
    <RegisterPage
      title={`${r.reference}`}
      canWrite={ctx.canWrite}
      back={{ href: "/registers/complaints", label: "Complaints" }}
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
        <StatusTag status={complaintStatus(r)} />
      </p>
      <dl
        className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2"
        data-testid="complaint-facts"
      >
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-zinc-600 dark:text-zinc-400">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-6 text-lg font-semibold">The complaint</h2>
      <p className="mt-1 leading-7" data-testid="complaint-summary">
        {r.summary}
      </p>
      {r.outcome ? (
        <>
          <h2 className="mt-4 text-lg font-semibold">
            What you did and the outcome
          </h2>
          <p className="mt-1 leading-7">{r.outcome}</p>
        </>
      ) : null}
      {ctx.canWrite &&
      (r.status === "resolved" || r.status === "escalated-to-commission") ? (
        // REQ-018 FR-6, AC-2: one tap to turn a closed complaint into an improvement row, source pre-filled.
        <p
          className="border-ochre mt-5 rounded-md border p-3 text-sm leading-6"
          data-testid="improvement-offer"
        >
          What did you learn from this one?{" "}
          <Link
            href={`/registers/improvements/new?source_kind=complaint&source_ref=${encodeURIComponent(r.reference)}`}
            className="underline underline-offset-2"
            data-testid="improvement-link"
          >
            Add it to the improvement register
          </Link>
          .
        </p>
      ) : null}
      {ctx.canWrite ? (
        <p className="mt-5">
          <Link
            href={`/registers/complaints/${r.id}/edit`}
            className="btn-secondary"
            data-testid="register-edit"
          >
            Edit this complaint
          </Link>
        </p>
      ) : null}
      <EventsTrail
        kind="complaint"
        subjectId={r.id}
        events={found.events}
        canWrite={ctx.canWrite}
      />
    </RegisterPage>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CLEARANCE_LABELS, fromWorkerCheckRow } from "@/lib/registers/labels";
import { getWorkerCheck } from "@/server/registers/queries";
import { StatusTag } from "../../_components/register-list";
import { RegisterPage, registerContext } from "../../_components/shell";
import { WorkerCheckFormView } from "../../_components/worker-check-form";
import { checkStatus } from "../page";

export const metadata: Metadata = { title: "Worker check" };

/** A check has no trail, so its page is the edit form (read-only facts when writes are frozen). */
export default async function WorkerCheckPage({
  params,
}: PageProps<"/registers/worker-checks/[id]">) {
  const { id } = await params;
  const ctx = await registerContext(`/registers/worker-checks/${id}`);
  const row = await getWorkerCheck(ctx.supabase, ctx.viewer.account.id, id);
  if (!row) notFound();
  return (
    <RegisterPage
      title={`${row.worker_ref}: ${CLEARANCE_LABELS[row.clearance_kind]}`}
      canWrite={ctx.canWrite}
      back={{ href: "/registers/worker-checks", label: "Worker checks" }}
    >
      <p className="mt-3">
        <StatusTag status={checkStatus(row)} />
      </p>
      {ctx.canWrite ? (
        <WorkerCheckFormView id={id} initial={fromWorkerCheckRow(row)} />
      ) : (
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {(
            [
              ["Role", row.role_label],
              ["Check number", row.clearance_number || "Not recorded"],
              ["Application number", row.application_number || "Not recorded"],
              ["Issued", row.issued_on ?? "Pending"],
              ["Expires", row.expires_on ?? "No expiry"],
              [
                "Checked in the NDIS Worker Screening Database",
                row.verified_in_database_on ?? "Not yet",
              ],
              ["State", row.state ?? "Not set"],
              ["Note", row.note || "None"],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-zinc-600 dark:text-zinc-400">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </RegisterPage>
  );
}

import type { Metadata } from "next";
import {
  listWorkerChecks,
  type WorkerCheckListRow,
} from "@/server/registers/queries";
import { RegisterList, type ListRow } from "../_components/register-list";
import { RegisterPage, registerContext } from "../_components/shell";
import { CLEARANCE_LABELS } from "@/lib/registers/labels";

export const metadata: Metadata = { title: "Worker checks register" };

export function checkStatus(r: WorkerCheckListRow): ListRow["status"] {
  if (r.status === "expired")
    return { key: "expired", label: `Expired ${r.expires_on}`, tone: "signal" };
  if (r.status === "expiring")
    return { key: "expiring", label: `Expires ${r.expires_on}`, tone: "ochre" };
  return {
    key: "valid",
    label: r.expires_on ? `Valid to ${r.expires_on}` : "No expiry",
    tone: "moss",
  };
}

export const CHECK_FILTERS = [
  { key: "expired", label: "Expired" },
  { key: "expiring", label: "Expiring" },
  { key: "valid", label: "Current" },
];

export default async function WorkerChecksPage() {
  const ctx = await registerContext("/registers/worker-checks");
  const rows = await listWorkerChecks(ctx.supabase, ctx.viewer.account.id);
  return (
    <RegisterPage
      title="Worker checks"
      intro="Each worker's screening and other checks by code and expiry. We keep the kind, the dates and the check number, never the name."
      canWrite={ctx.canWrite}
      addHref="/registers/worker-checks/new"
      addLabel="Add a check"
      exportHref="/registers/worker-checks/export.csv"
      importHref="/registers/worker-checks/import"
      back={{ href: "/registers", label: "Registers" }}
    >
      <RegisterList
        testId="worker-checks-list"
        rows={rows.map((r) => ({
          id: r.id,
          href: `/registers/worker-checks/${r.id}`,
          title: `${r.worker_ref}: ${CLEARANCE_LABELS[r.clearance_kind]}`,
          detail: `${r.role_label}. Issued ${r.issued_on}${r.state ? `, ${r.state}` : ""}.`,
          status: checkStatus(r),
        }))}
        filters={CHECK_FILTERS}
        empty="No checks recorded yet. Add one row per worker per check: NDIS Worker Screening, Working with Children, first aid and the orientation module."
      />
    </RegisterPage>
  );
}

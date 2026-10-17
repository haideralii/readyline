import type { Metadata } from "next";
import {
  listWorkerChecks,
  type WorkerCheckListRow,
} from "@/server/registers/queries";
import {
  WORKER_CHECK_COLUMNS,
  cellsFor,
  tableColumns,
} from "@/lib/registers/table-columns";
import { periodQuery } from "@/lib/registers/period";
import {
  PeriodEmpty,
  RegisterPeriodBar,
  pagePeriod,
} from "../_components/period-filter";
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

export default async function WorkerChecksPage({
  searchParams,
}: PageProps<"/registers/worker-checks">) {
  const ctx = await registerContext("/registers/worker-checks");
  // REQ-023 FR-5: the period from the URL, "All" by default; a pending application has no issue date and stays (D-2318 A).
  const filter = await pagePeriod(
    ctx.supabase,
    ctx.viewer.account.id,
    searchParams,
  );
  const rows = await listWorkerChecks(
    ctx.supabase,
    ctx.viewer.account.id,
    filter.period,
  );
  const filtered = filter.period.kind !== "all";
  return (
    <RegisterPage
      title="Worker checks"
      intro="Each worker's screening and other checks by code and expiry. We keep the kind, the dates and the check number, never the name. This register is the companion to your own worker list, which holds each worker's name and stays in your own file."
      canWrite={ctx.canWrite}
      addHref="/registers/worker-checks/new"
      addLabel="Add a check"
      exportHref={`/registers/worker-checks/export.csv${periodQuery(filter.period)}`}
      exportLabel="Download as a spreadsheet (CSV)"
      count={filtered ? undefined : rows.length}
      importHref="/registers/worker-checks/import"
      back={{ href: "/registers", label: "Registers" }}
    >
      <RegisterPeriodBar
        basePath="/registers/worker-checks"
        register="worker_clearances"
        rows={rows}
        state={filter}
      />
      {filtered && rows.length === 0 ? (
        <PeriodEmpty
          basePath="/registers/worker-checks"
          testId="worker-checks-list"
        />
      ) : (
        <RegisterList
          testId="worker-checks-list"
          rows={rows.map((r) => ({
            id: r.id,
            href: `/registers/worker-checks/${r.id}`,
            title: `${r.worker_ref}: ${CLEARANCE_LABELS[r.clearance_kind]}`,
            // REQ-024 A1 (finding 157): a pending application has no issue date; it reads pending with its application number.
            detail: `${r.role_label}. ${r.issued_on ? `Issued ${r.issued_on}` : `Pending${r.application_number ? `, application ${r.application_number}` : ""}`}${r.state ? `, ${r.state}` : ""}.`,
            status: checkStatus(r),
            cells: cellsFor(WORKER_CHECK_COLUMNS, r),
          }))}
          filters={CHECK_FILTERS}
          columns={tableColumns(WORKER_CHECK_COLUMNS)}
          emptyAction={
            ctx.canWrite
              ? { href: "/registers/worker-checks/new", label: "Add a check" }
              : undefined
          }
          importHref={
            ctx.canWrite ? "/registers/worker-checks/import" : undefined
          }
          empty="No checks recorded yet. Add one row per worker per check: NDIS Worker Screening, Working with Children, first aid and the orientation module."
        />
      )}
    </RegisterPage>
  );
}

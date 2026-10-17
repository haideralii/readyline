// REQ-023 FR-10 (Session D): the changes register's list, the generic list
// page's shape with one addition the meta cannot carry, the kind as a filter
// chip above the table (D-2317): notifications and variations are one register
// with two routes into it, and the chip, not a column, tells them apart.
import type { Metadata } from "next";
import Link from "next/link";
import { AUDIT_DAY_META } from "@/lib/registers/audit-day-forms";
import {
  CHANGE_KINDS,
  type ChangeKind,
  type CommissionChangeRow,
} from "@/lib/registers/commission-changes";
import {
  cellsFor,
  linkNameFor,
  tableColumns,
} from "@/lib/registers/table-columns";
import { listAuditDayRows } from "@/server/registers/audit-day-queries";
import { RegisterList, type ListRow } from "../_components/register-list";
import { RegisterPage, registerContext } from "../_components/shell";

export const metadata: Metadata = { title: "Changes we told the Commission" };

const SLUG = "commission-changes" as const;
const KIND_CHIPS: { kind: ChangeKind | "all"; label: string }[] = [
  { kind: "all", label: "All" },
  { kind: "notification", label: "Changes we notified" },
  { kind: "variation", label: "Variations we applied for" },
];
const CHIP =
  "inline-flex min-h-11 items-center rounded-md border px-3 text-sm underline-offset-4";

export default async function Page({
  searchParams,
}: PageProps<"/registers/commission-changes">) {
  const sp = await searchParams;
  const meta = AUDIT_DAY_META[SLUG];
  const ctx = await registerContext(`/registers/${SLUG}`);
  const kindParam = typeof sp.kind === "string" ? sp.kind : "all";
  const kind: ChangeKind | "all" = (CHANGE_KINDS as readonly string[]).includes(
    kindParam,
  )
    ? (kindParam as ChangeKind)
    : "all";
  const all = (await listAuditDayRows(
    ctx.supabase,
    ctx.viewer.account.id,
    SLUG,
  )) as unknown as (CommissionChangeRow & {
    state: string;
    notify_by: string | null;
  })[];
  const rows = kind === "all" ? all : all.filter((r) => r.kind === kind);
  const list: ListRow[] = rows.map((r) => ({
    id: r.id,
    href: `/registers/${SLUG}/${r.id}`,
    title: meta.titleOf(r as never),
    detail: meta.detailOf(r as never),
    status: meta.statusOf(r as never),
    cells: cellsFor(meta.columns, r as never),
    name: linkNameFor(SLUG, r) ?? undefined,
  }));
  return (
    <RegisterPage
      title={meta.title}
      intro={meta.intro}
      canWrite={ctx.canWrite}
      addHref={`/registers/${SLUG}/new?kind=notification`}
      addLabel={meta.addLabel}
      importHref={`/registers/${SLUG}/import`}
      back={{ href: "/registers", label: "Registers" }}
      count={all.length}
    >
      {typeof sp.saved === "string" ? (
        <p
          role="status"
          className="text-moss mt-3 text-sm"
          data-testid="register-saved"
        >
          ✓ Saved.
        </p>
      ) : null}
      {ctx.canWrite && all.length > 0 ? (
        <p className="mt-3 text-sm">
          <Link
            href={`/registers/${SLUG}/new?kind=variation`}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
            data-testid="add-variation-link"
          >
            Record a variation we applied for
          </Link>
        </p>
      ) : null}
      {all.length > 0 ? (
        // D-2317: the kind is a chip above the table, never a column.
        <nav aria-label="Kind" className="mt-4" data-testid="kind-chips">
          <ul className="flex flex-wrap gap-2">
            {KIND_CHIPS.map((c) => (
              <li key={c.kind}>
                <Link
                  href={
                    c.kind === "all"
                      ? `/registers/${SLUG}`
                      : `/registers/${SLUG}?kind=${c.kind}`
                  }
                  aria-current={kind === c.kind ? "true" : undefined}
                  className={`${CHIP} ${kind === c.kind ? "border-ink bg-ink text-paper" : "border-line hover:bg-mist"}`}
                  data-testid={`kind-chip-${c.kind}`}
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <RegisterList
        testId={`${SLUG}-list`}
        rows={list}
        filters={meta.filters}
        empty={meta.empty}
        columns={tableColumns(meta.columns)}
        emptyAction={
          ctx.canWrite
            ? {
                href: `/registers/${SLUG}/new?kind=notification`,
                label: meta.addLabel,
              }
            : undefined
        }
        importHref={ctx.canWrite ? `/registers/${SLUG}/import` : undefined}
      />
    </RegisterPage>
  );
}

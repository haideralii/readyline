import Link from "next/link";
import { Tag, type TagVariant } from "./tag";
import type { TableColumn } from "@/lib/registers/table-columns";

/**
 * REQ-028 FR-8 (D-2814, D-2804): the register table from `sm`, beside
 * `DataTable` (which stays strings-only for the auditor page and the
 * sample). It takes the columns a register names as data and the rows'
 * cells already formatted (`cellsFor`), draws the register's own status as
 * the one `Tag` where D-2814 places the column, makes the first column the
 * row's link, keeps the head sticky and the rows 48 px, and never carries a
 * narrative field. Under `sm` the caller renders `RegisterList`'s cards;
 * both are in the DOM and the stylesheet decides (D-2275).
 */
export type RegisterStatus = {
  key: string;
  label: string;
  tone: "moss" | "ochre" | "signal" | "slate";
};

export type RegisterTableRow = {
  id: string;
  href: string;
  /** The card's title; the table's first cell falls back to it when the first column is empty. */
  title: string;
  status: RegisterStatus;
  cells: (string | null)[];
};

/** REQ-028 FR-13 (D-2274): the register tones as the one Tag's variants. */
const TONE_VARIANT: Record<RegisterStatus["tone"], TagVariant> = {
  moss: "done",
  ochre: "doing",
  signal: "error",
  slate: "neutral",
};

export function StatusTag({ status }: { status: RegisterStatus }) {
  return (
    <Tag
      variant={TONE_VARIANT[status.tone]}
      testId="status-tag"
      data-status={status.key}
    >
      {status.label}
    </Tag>
  );
}

const TH =
  "border-rule bg-paper border-b py-2 pr-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase";
const TD = "border-rule border-b py-2 pr-3 align-middle";

export function RegisterTable({
  columns,
  rows,
  testId,
  labelledBy = "register-title",
}: {
  columns: readonly TableColumn[];
  rows: readonly RegisterTableRow[];
  testId: string;
  /** The heading that names the table for assistive technology (the register page's h1). */
  labelledBy?: string;
}) {
  // The first non-status column is the row's link.
  const linkIndex = Math.max(
    0,
    columns.findIndex((c) => c.kind !== "status"),
  );
  return (
    <div
      className="hidden overflow-x-auto sm:block"
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
      data-testid={testId}
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0">
          <tr>
            {columns.map((c, i) => (
              <th key={`${c.label}-${i}`} scope="col" className={TH}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="hover:bg-mist h-12"
              data-testid={`trow-${r.id}`}
            >
              {columns.map((c, i) => {
                if (c.kind === "status")
                  return (
                    <td key={i} className={TD}>
                      <StatusTag status={r.status} />
                    </td>
                  );
                const value = r.cells[i] ?? null;
                const shown = value ?? (i === linkIndex ? r.title : c.empty);
                const muted = value === null && i !== linkIndex;
                // Composed as an array (D-2274 (5)): the Tailwind Prettier plugin trims a template fragment's space.
                const cls = [
                  TD,
                  c.kind === "date" ? "tabular-nums" : null,
                  muted ? "text-slate" : null,
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <td key={i} className={cls}>
                    {i === linkIndex ? (
                      <Link
                        href={r.href}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {shown}
                      </Link>
                    ) : (
                      shown
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";
import { RegisterTable, StatusTag } from "@/components/register-table";
import type { TableColumn } from "@/lib/registers/table-columns";
import Link from "next/link";
import { useState } from "react";

export { StatusTag };

/**
 * One list for all four registers (REQ-009 FR-5; REQ-015 Section C): each
 * row is a link with its title, a line of detail, and a status tag with an
 * icon and text; a filter by status sits above. Tones are the identity's
 * moss (fine), ochre (act soon), signal (overdue) and slate (neutral).
 */
export type ListRow = {
  id: string;
  href: string;
  title: string;
  detail: string;
  /** REQ-028 FR-8: the table's cells in column order (`cellsFor`), when the register has columns. */
  cells?: (string | null)[];
  status: {
    key: string;
    label: string;
    tone: "moss" | "ochre" | "signal" | "slate";
  };
};

export function RegisterList({
  rows,
  filters,
  empty,
  testId,
  columns,
  emptyAction,
  importHref,
}: {
  rows: ListRow[];
  /** The status keys offered as filters, in order, with their labels. */
  filters: { key: string; label: string }[];
  empty: string;
  testId: string;
  /** REQ-028 FR-8 (D-2814): with columns, the table renders from sm and these cards under it. */
  columns?: readonly TableColumn[];
  /** REQ-028 FR-7, FR-8: the empty state's primary, the one way to add the first entry (given only while writes are open). */
  emptyAction?: { href: string; label: string };
  /** The spreadsheet import beside it, where the register has one. */
  importHref?: string;
}) {
  const [filter, setFilter] = useState<string>("all");
  const shown =
    filter === "all" ? rows : rows.filter((r) => r.status.key === filter);
  if (rows.length === 0)
    return (
      <div data-testid={testId}>
        {/* REQ-028 FR-8 (audit 5, 58): one sentence of what the auditor asks for and the primary to add the first entry. */}
        <div className="mt-6" data-testid={`${testId}-empty`}>
          <p className="text-slate leading-7">{empty}</p>
          {emptyAction ? (
            <p className="mt-4 flex flex-wrap items-center gap-4">
              <Link
                href={emptyAction.href}
                className="btn-primary"
                data-testid="register-add"
              >
                {emptyAction.label}
              </Link>
              {importHref ? (
                <Link
                  href={importHref}
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                  data-testid="register-import"
                >
                  Import from a spreadsheet
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    );
  return (
    <div data-testid={testId}>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Show</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {[
            { key: "all", label: `All (${rows.length})` },
            ...filters.map((f) => ({
              ...f,
              label: `${f.label} (${rows.filter((r) => r.status.key === f.key).length})`,
            })),
          ].map((f) => (
            <label
              key={f.key}
              // The radio is invisible, so the label shows its focus (WCAG 2.4.7; backlog 1, D-1508).
              className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${filter === f.key ? "border-ink bg-ink text-paper" : "hover:bg-mist border-line"}`}
            >
              <input
                type="radio"
                name="filter"
                value={f.key}
                checked={filter === f.key}
                onChange={() => setFilter(f.key)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>
      {shown.length === 0 ? (
        <p className="text-slate mt-6" data-testid={`${testId}-empty`}>
          No matches. Try another word, or{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setFilter("all")}
            data-testid={`${testId}-clear`}
          >
            clear the search
          </button>{" "}
          to see every entry.
        </p>
      ) : (
        <div className={columns?.length ? "sm:hidden" : undefined}>
          <ul
            className="divide-rule mt-4 divide-y"
            aria-labelledby="register-title"
          >
            {shown.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="hover:bg-mist -mx-2 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-md px-2 py-3 underline-offset-4"
                  data-testid={`row-${r.id}`}
                >
                  {/* REQ-028 FR-12 (#87 run 1): the title keeps at least 12rem before the
                    tag drops under it, so a long status at 14 px never squeezes a title
                    word into breaking at 360 (the row inherits li's overflow-wrap). */}
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block text-base font-medium">
                      {r.title}
                    </span>
                    <span className="text-slate block text-sm">{r.detail}</span>
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <StatusTag status={r.status} />
                    <span aria-hidden="true" className="text-slate">
                      ›
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {columns?.length && shown.length > 0 ? (
        <div className="mt-4">
          <RegisterTable
            columns={columns}
            rows={shown.map((r) => ({
              id: r.id,
              href: r.href,
              title: r.title,
              status: r.status,
              cells: r.cells ?? [],
            }))}
            testId={`${testId}-table`}
          />
        </div>
      ) : null}
    </div>
  );
}

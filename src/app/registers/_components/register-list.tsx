"use client";
import Link from "next/link";
import { useState } from "react";

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
  status: {
    key: string;
    label: string;
    tone: "moss" | "ochre" | "signal" | "slate";
  };
};

const TONE: Record<ListRow["status"]["tone"], { icon: string; cls: string }> = {
  moss: { icon: "✓", cls: "border-moss text-moss" },
  ochre: { icon: "◐", cls: "border-ochre text-ochre" },
  signal: { icon: "!", cls: "border-signal text-signal" },
  slate: { icon: "○", cls: "border-slate text-slate" },
};

export function StatusTag({ status }: { status: ListRow["status"] }) {
  const t = TONE[status.tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium ${t.cls}`}
      data-testid="status-tag"
      data-status={status.key}
    >
      <span aria-hidden="true">{t.icon}</span>
      {status.label}
    </span>
  );
}

export function RegisterList({
  rows,
  filters,
  empty,
  testId,
}: {
  rows: ListRow[];
  /** The status keys offered as filters, in order, with their labels. */
  filters: { key: string; label: string }[];
  empty: string;
  testId: string;
}) {
  const [filter, setFilter] = useState<string>("all");
  const shown =
    filter === "all" ? rows : rows.filter((r) => r.status.key === filter);
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
          {rows.length === 0 ? empty : "Nothing with that status."}
        </p>
      ) : (
        <ul
          className="divide-rule mt-4 divide-y"
          aria-labelledby="register-title"
        >
          {shown.map((r) => (
            <li key={r.id}>
              <Link
                href={r.href}
                className="flex min-h-14 items-center justify-between gap-3 py-3 underline-offset-4 hover:underline"
                data-testid={`row-${r.id}`}
              >
                <span className="min-w-0">
                  <span className="block text-base font-medium">{r.title}</span>
                  <span className="text-slate block text-sm">{r.detail}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusTag status={r.status} />
                  <span aria-hidden="true" className="text-slate">
                    ›
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

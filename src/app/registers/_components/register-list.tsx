"use client";
import { Tag, type TagVariant } from "@/components/tag";
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

/** REQ-028 FR-13 (D-2274): the register tones as the one Tag's variants. */
const TONE_VARIANT: Record<ListRow["status"]["tone"], TagVariant> = {
  moss: "done",
  ochre: "doing",
  signal: "error",
  slate: "neutral",
};

export function StatusTag({ status }: { status: ListRow["status"] }) {
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
          {rows.length === 0 ? (
            empty
          ) : (
            <>
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
            </>
          )}
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
                className="hover:bg-mist -mx-2 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-md px-2 py-3 underline-offset-4"
                data-testid={`row-${r.id}`}
              >
                {/* REQ-028 FR-12 (#87 run 1): the title keeps at least 12rem before the
                    tag drops under it, so a long status at 14 px never squeezes a title
                    word into breaking at 360 (the row inherits li's overflow-wrap). */}
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block text-base font-medium">{r.title}</span>
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
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * The cost calculator on the cost guide (REQ-011 batch 29 item 3): tick the
 * groups you deliver and see the audit type and our price. The audit rule
 * is the questionnaire's (any certification group makes the whole
 * registration certification); the groups and their audit types come from
 * the standards data on the server, the price from the configured pack
 * price. No account, nothing stored, nothing sent.
 */
export type CalculatorGroup = {
  code: string;
  name: string;
  auditType: "verification" | "certification";
};

export function CostCalculator({
  groups,
  packPrice,
}: {
  groups: CalculatorGroup[];
  packPrice: string | null;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? groups.filter(
          (g) => g.name.toLowerCase().includes(q) || g.code.includes(q),
        )
      : groups;
  }, [groups, query]);
  const chosen = groups.filter((g) => selected.includes(g.code));
  const audit =
    chosen.length === 0
      ? null
      : chosen.some((g) => g.auditType === "certification")
        ? "certification"
        : "verification";
  const toggle = (code: string) =>
    setSelected((s) =>
      s.includes(code) ? s.filter((c) => c !== code) : [...s, code],
    );

  return (
    <div
      className="my-6 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
      data-testid="cost-calculator"
    >
      <label htmlFor="calc-search" className="block text-base font-medium">
        Find your support types
      </label>
      <input
        id="calc-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Household tasks, personal care, SIL…"
        className="mt-1 block min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-950"
      />
      <ul
        className="mt-3 max-h-64 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800"
        aria-label="Registration groups"
      >
        {shown.map((g) => (
          <li key={g.code}>
            {/* No background on hover: the ochre and moss tags lose contrast on mist (axe on desktop). */}
            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1 hover:underline">
              <input
                type="checkbox"
                checked={selected.includes(g.code)}
                onChange={() => toggle(g.code)}
                className="h-5 w-5 shrink-0"
              />
              <span className="min-w-0 text-sm">
                {g.name}{" "}
                <span className="font-mono text-zinc-500">{g.code}</span>
              </span>
              <span
                className={`ml-auto rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${g.auditType === "verification" ? "border-moss text-moss" : "border-ochre text-ochre"}`}
              >
                {g.auditType === "verification" ? "desk audit" : "site audit"}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div
        className="mt-4 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900"
        role="status"
        aria-live="polite"
        data-testid="calculator-result"
      >
        {audit === null ? (
          <p className="text-sm">
            Tick at least one support type to see your audit and our price.
          </p>
        ) : (
          <>
            <p className="text-lg font-semibold">Your audit: {audit}</p>
            <p className="mt-1 text-sm leading-6">
              {audit === "verification"
                ? "A desk audit of your documents. Auditors quote this in the low thousands or under; get two quotes."
                : "A site visit plus interviews, and a mid-term audit later. Auditors quote this in the thousands; get two quotes."}
            </p>
            <p className="mt-2 text-sm leading-6">
              Readyline document pack:{" "}
              <strong>{packPrice ?? "one fixed price"}</strong> one-off, drafted
              for these {chosen.length}{" "}
              {chosen.length === 1 ? "group" : "groups"}.{" "}
              <Link href="/start" className="underline underline-offset-2">
                Get the full result with sources
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}

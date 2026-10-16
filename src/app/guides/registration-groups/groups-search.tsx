"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * The index of the 38 groups under the everyday headings (REQ-011 batch 31
 * item 2), searchable with the questionnaire's synonyms: the same match as
 * the supports step (code, name, description, synonyms), so a provider who
 * types "cleaning" finds household tasks here as they would there.
 */
export type IndexGroup = {
  code: string;
  name: string;
  slug: string;
  description: string;
  synonyms: string[];
  pathway: "verification" | "certification";
};

export type IndexCategory = {
  id: string;
  title: string;
  description: string;
  groups: IndexGroup[];
};

function matches(g: IndexGroup, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    g.code.includes(q) ||
    g.name.toLowerCase().includes(q) ||
    g.description.toLowerCase().includes(q) ||
    g.synonyms.some((s) => s.toLowerCase().includes(q))
  );
}

export function GroupsSearch({ categories }: { categories: IndexCategory[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () =>
      categories
        .map((c) => ({
          ...c,
          groups: c.groups.filter((g) => matches(g, query)),
        }))
        .filter((c) => c.groups.length > 0),
    [categories, query],
  );
  const total = shown.reduce((n, c) => n + c.groups.length, 0);
  return (
    <div className="mt-6">
      <label htmlFor="groups-search" className="block text-sm font-medium">
        Search by what you do (for example cleaning, support worker, therapy,
        SIL)
      </label>
      <input
        id="groups-search"
        type="search"
        inputMode="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border-line mt-1 block w-full rounded-md border px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <p
        className="text-slate mt-2 text-sm"
        aria-live="polite"
        data-testid="groups-count"
      >
        {total === 38
          ? "38 registration groups."
          : `${total} of 38 registration groups match.`}
      </p>
      {shown.map((c) => (
        <section
          key={c.id}
          aria-labelledby={`cat-${c.id}`}
          className="mt-8"
          data-testid={`groups-category-${c.id}`}
        >
          <h2 id={`cat-${c.id}`} className="text-xl font-semibold">
            {c.title}
          </h2>
          <p className="text-slate mt-1 text-sm leading-6">{c.description}</p>
          <ul className="divide-rule mt-3 divide-y">
            {c.groups.map((g) => (
              <li key={g.code} className="py-3">
                <Link
                  href={`/guides/registration-groups/${g.slug}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {g.name}
                </Link>{" "}
                <span className="text-slate text-sm">
                  {g.code},{" "}
                  {g.pathway === "verification" ? "desk audit" : "site audit"}
                </span>
                <p className="text-ink mt-1 text-sm leading-6">
                  {g.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {total === 0 ? (
        <p className="mt-6 text-sm" role="status">
          No matches. Try another word, or clear the search to see every group.
        </p>
      ) : null}
    </div>
  );
}

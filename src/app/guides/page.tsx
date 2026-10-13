import type { Metadata } from "next";
import Link from "next/link";
import { loadGuides } from "@/lib/guides/pages";
import { formatUpdated } from "@/lib/legal/pages";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guides to NDIS provider registration",
  description:
    "Plain-English guides to NDIS provider registration for sole traders and small providers: which audit you need, what it costs, and what the Commission expects. Sourced and dated.",
  alternates: { canonical: `${siteUrl()}/guides` },
};

export default function GuidesPage() {
  const guides = loadGuides();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Guides</h1>
      <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
        Plain answers to the questions providers search for, each with its
        sources and the date we last checked them.
      </p>
      <ul
        className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800"
        data-testid="guides-list"
      >
        {guides.map((g) => (
          <li key={g.slug} className="py-4">
            <Link
              href={`/guides/${g.slug}`}
              className="text-lg font-medium underline-offset-4 hover:underline"
            >
              {g.title}
            </Link>
            <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {g.description}
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Last reviewed {formatUpdated(g.reviewed)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

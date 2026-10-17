import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { GlossaryTerms } from "@/components/glossary-terms";
import { findGlossaryTerms } from "@/lib/copy-lint/glossary";
import { loadGuides } from "@/lib/guides/pages";
import { formatUpdated } from "@/lib/legal/pages";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guides to NDIS provider registration",
  description:
    "Plain-English guides to NDIS provider registration for sole traders and small providers: which audit you need, what it costs, and what the Commission expects. Sourced and dated.",
  alternates: { canonical: `${siteUrl()}/guides` },
};

const LEAD =
  "Plain answers to the questions providers search for, each with its sources and the date we last checked them.";
const GROUPS_LINK =
  "Registration groups: which audit and which documents each of the 38 classes needs";

export default function GuidesPage() {
  const guides = loadGuides();
  // REQ-027 FR-3, D-2711, D-2267: the words on this page, its own and the guides' titles and descriptions, found at render.
  const present = findGlossaryTerms(
    [
      LEAD,
      GROUPS_LINK,
      ...guides.flatMap((g) => [g.title, g.description]),
    ].join("\n"),
  );
  return (
    <PageShell kind="reading">
      <h1 className="">Guides</h1>
      <p className="text-ink mt-3 leading-7">{LEAD}</p>
      {/* REQ-011 batch 31: the 38 registration-group pages have their own index. */}
      <p className="mt-4 leading-7" data-testid="guides-groups-link">
        <Link
          href="/guides/registration-groups"
          className="underline underline-offset-2"
        >
          {GROUPS_LINK}
        </Link>
        .
      </p>
      {/* REQ-027 FR-3, D-2701: the words on this page (the guides' descriptions carry several), above the list. */}
      <GlossaryTerms ids={present} where="page" className="mt-4" />
      <ul className="divide-rule mt-6 divide-y" data-testid="guides-list">
        {guides.map((g) => (
          <li key={g.slug} className="py-4">
            <Link
              href={`/guides/${g.slug}`}
              className="text-lg font-medium underline-offset-4 hover:underline"
            >
              {g.title}
            </Link>
            <p className="text-ink mt-1 text-sm leading-6">{g.description}</p>
            <p className="text-slate mt-1 text-sm">
              Last reviewed {formatUpdated(g.reviewed)}
            </p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

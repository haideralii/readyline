import type { Metadata } from "next";
import Link from "next/link";
import { buildGroupPages, groupPagesByCategory } from "@/lib/guides/groups";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { siteUrl } from "@/lib/site";
import { GroupsSearch } from "./groups-search";
import { GlossaryTerms } from "@/components/glossary-terms";

/** REQ-027 FR-3 (D-2710): the glossary terms this page's own words use, first appearance first. */
const INDEX_TERMS = [
  "registration-group",
  "practice-standards",
  "module",
] as const;

export const metadata: Metadata = {
  title:
    "NDIS registration groups: which audit and which documents each one needs",
  description:
    "All 38 NDIS registration groups under everyday headings, with the audit type, the Practice Standards modules and the documents each one needs, generated from the Commission's published tables.",
  alternates: { canonical: `${siteUrl()}/guides/registration-groups` },
};

/** The index of the 38 groups (REQ-011 batch 31 item 2): everyday headings, the questionnaire's synonyms in the search. */
export default function RegistrationGroupsIndexPage() {
  const pages = buildGroupPages(getStandardsDataset());
  const categories = groupPagesByCategory(pages).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    groups: c.pages.map((p) => ({
      code: p.code,
      name: p.name,
      slug: p.slug,
      description: p.description,
      synonyms: p.synonyms,
      pathway: p.pathway,
    })),
  }));
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm">
        <Link
          href="/guides"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Guides
        </Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Registration groups
      </h1>
      <p className="text-ink mt-3 leading-7">
        The Commission registers providers by class of support. Each page below
        says which audit that class needs, which Practice Standards modules
        apply, and which documents the pack produces for it, from the
        Commission&apos;s published tables.
      </p>
      {/* REQ-027 FR-3, D-2701: the words on this page, above the search and inside no other disclosure. */}
      <GlossaryTerms ids={INDEX_TERMS} where="page" className="mt-3" />
      <GroupsSearch categories={categories} />
    </div>
  );
}

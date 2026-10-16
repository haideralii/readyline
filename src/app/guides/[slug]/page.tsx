import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GlossaryTerms } from "@/components/glossary-terms";
import { markdownComponents } from "@/components/legal-article";
import { BRAND } from "@/lib/brand";
import { registrationGroupsTable } from "@/lib/guides/groups-table";
import { listGuideSlugs, loadGuide } from "@/lib/guides/pages";
import { formatUpdated } from "@/lib/legal/pages";
import { formatAud, readPricing } from "@/lib/payments/pricing";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { siteUrl } from "@/lib/site";
import { CostCalculator } from "./cost-calculator";
import { JsonLd } from "@/components/json-ld";

export async function generateStaticParams() {
  return listGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!listGuideSlugs().includes(slug)) return {};
  const g = loadGuide(slug);
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `${siteUrl()}/guides/${g.slug}` },
    openGraph: {
      title: g.title,
      description: g.description,
      type: "article",
      url: `${siteUrl()}/guides/${g.slug}`,
    },
  };
}

/**
 * One guide (REQ-011 batch 29 item 1): the identity, the copy rules, a
 * "Last reviewed" line, the body with its live placeholders filled, an FAQ
 * that also emits FAQPage structured data, the sources, and one CTA to the
 * free questionnaire.
 */
export default async function GuidePage({
  params,
}: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  if (!listGuideSlugs().includes(slug)) notFound();
  const g = loadGuide(slug);
  const pricing = readPricing();
  const price = pricing.packPriceCents
    ? formatAud(pricing.packPriceCents)
    : null;
  const dataset = getStandardsDataset();
  // Split at the calculator placeholder so a client component can sit inside the article.
  const [before, after] = g.markdown
    .replace("{{registration-groups-table}}", registrationGroupsTable(dataset))
    .replace("{{pack-price}}", price ?? "one fixed price")
    .split("{{cost-calculator}}");
  const groups = dataset.registrationGroups.map((x) => ({
    code: x.code,
    name: x.name,
    auditType: x.auditType,
  }));
  const url = `${siteUrl()}/guides/${g.slug}`;
  return (
    <PageShell kind="reading">
      <article>
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: g.title,
              description: g.description,
              dateModified: g.updated,
              author: { "@type": "Organization", name: BRAND },
              publisher: { "@type": "Organization", name: BRAND },
              mainEntityOfPage: url,
            },
            g.faq.length
              ? {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: g.faq.map((f) => ({
                    "@type": "Question",
                    name: f.question,
                    acceptedAnswer: { "@type": "Answer", text: f.answer },
                  })),
                }
              : null,
          ].filter(Boolean)}
        />
        <p className="text-sm">
          <Link
            href="/guides"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            ‹ Guides
          </Link>
        </p>
        <h1 className="">{g.title}</h1>
        <p className="text-slate mt-2 text-sm" data-testid="guide-reviewed">
          Last reviewed {formatUpdated(g.reviewed)}. Updated{" "}
          {formatUpdated(g.updated)}.
        </p>
        {g.draft ? (
          <p
            className="mt-4 rounded-md border border-amber-700 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100"
            data-testid="guide-draft-note"
          >
            <strong className="font-semibold">Draft.</strong> This guide is
            being checked; lines marked UNVERIFIED are still to be confirmed
            against the Commission&apos;s pages.
          </p>
        ) : null}
        {/* Batch 49 item 5 (REQ-025 D-2218): the answer in three lines first, then where each section is. */}
        <section
          aria-labelledby="short-answer-heading"
          className="border-ochre mt-6 rounded-md border p-4"
          data-testid="guide-short-answer"
        >
          <h2 id="short-answer-heading" className="">
            Short answer
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 leading-7">
            {g.shortAnswer.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        {/* REQ-027 FR-3, D-2715: the words in this guide, the ids its front matter names, under the short answer. */}
        <GlossaryTerms ids={g.glossary} where="guide" className="mt-3" />
        <nav
          aria-label="Jump to"
          className="mt-4 text-sm"
          data-testid="guide-jump-to"
        >
          <span className="font-medium">Jump to: </span>
          <ul className="inline">
            {[
              ...g.headings,
              ...(g.faq.length
                ? [{ id: "faq-heading", text: "Questions people ask" }]
                : []),
              ...(g.sources.length
                ? [{ id: "sources-heading", text: "Sources" }]
                : []),
            ].map((h, i) => (
              <li key={h.id} className="inline">
                {i > 0 ? <span aria-hidden="true">, </span> : null}
                <a
                  href={`#${h.id}`}
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {before}
        </Markdown>
        {after !== undefined ? (
          <>
            <CostCalculator groups={groups} packPrice={price} />
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {after}
            </Markdown>
          </>
        ) : null}
        {g.faq.length ? (
          <section
            aria-labelledby="faq-heading"
            className="mt-10"
            data-testid="guide-faq"
          >
            <h2 id="faq-heading" className="">
              Questions people ask
            </h2>
            {g.faq.map((f) => (
              <details
                key={f.question}
                className="border-rule mt-3 rounded-md border"
              >
                <summary className="min-h-12 cursor-pointer px-4 py-3 text-base font-medium">
                  {f.question}
                </summary>
                <div className="px-4 pb-4">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {f.answer}
                  </Markdown>
                </div>
              </details>
            ))}
          </section>
        ) : null}
        <section
          aria-labelledby="cta-heading"
          className="border-ochre mt-10 rounded-md border p-4"
          data-testid="guide-cta"
        >
          <h2 id="cta-heading" className="">
            See which audit you need, free
          </h2>
          <p className="mt-2 leading-7">
            Answer plain questions about your supports and workers. {BRAND}{" "}
            tells you which audit you face, with the Commission&apos;s text
            behind it.
          </p>
          <p className="mt-4">
            <Link href="/start" className="btn-primary">
              See which audit I need
            </Link>
          </p>
        </section>
        {g.sources.length ? (
          <section
            aria-labelledby="sources-heading"
            className="mt-10"
            data-testid="guide-sources"
          >
            <h2 id="sources-heading" className="">
              Sources
            </h2>
            <ul className="text-ink mt-3 list-disc space-y-2 pl-5 leading-7">
              {g.sources.map((s) => (
                <li key={s.label}>
                  {s.url ? (
                    <a
                      href={s.url}
                      className="underline underline-offset-2"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {s.label} (opens in a new tab)
                    </a>
                  ) : (
                    s.label
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </PageShell>
  );
}

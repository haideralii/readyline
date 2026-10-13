import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { BRAND } from "@/lib/brand";
import { buildGroupPages, findGroupPage } from "@/lib/guides/groups";
import { formatAud, readPricing } from "@/lib/payments/pricing";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { siteUrl } from "@/lib/site";

export async function generateStaticParams() {
  return buildGroupPages(getStandardsDataset()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/guides/registration-groups/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = findGroupPage(getStandardsDataset(), slug);
  if (!p) return {};
  const title = `${p.name} (NDIS class ${p.code}): ${p.pathwayLabel} audit, modules and documents`;
  const description = `${p.description} A ${p.pathwayLabel} audit, ${p.modules.length === 1 ? "one module" : `${p.modules.length} modules`} and ${p.documents.length} documents, from the Commission's published tables.`;
  const url = `${siteUrl()}/guides/registration-groups/${p.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "article", url },
  };
}

const h2 = "mt-10 text-xl font-semibold tracking-tight";
const list =
  "mt-3 list-disc space-y-1 pl-5 leading-7 text-zinc-700 dark:text-zinc-300";

/**
 * One registration group (REQ-011 batch 31 item 1, D-1105): plain name and
 * code, the audit with its rule and source, the modules, the documents and
 * registers the pack produces, the price from config, four questions with
 * FAQPage data, the questionnaire with the group ticked, and the sources.
 * Every value comes from the builder; the template adds no facts.
 */
export default async function RegistrationGroupPage({
  params,
}: PageProps<"/guides/registration-groups/[slug]">) {
  const { slug } = await params;
  const dataset = getStandardsDataset();
  const p = findGroupPage(dataset, slug);
  if (!p) notFound();
  const pricing = readPricing();
  const price = pricing.packPriceCents
    ? formatAud(pricing.packPriceCents)
    : null;
  const url = `${siteUrl()}/guides/registration-groups/${p.slug}`;
  const updated = dataset.generatedAt.slice(0, 10);
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `${p.name} (class ${p.code})`,
            description: p.description,
            dateModified: updated,
            author: { "@type": "Organization", name: BRAND },
            publisher: { "@type": "Organization", name: BRAND },
            mainEntityOfPage: url,
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: p.faq.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          },
        ]}
      />
      <p className="text-sm">
        <Link
          href="/guides/registration-groups"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          ‹ Registration groups
        </Link>
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {p.category.title}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        {p.name}{" "}
        <span className="text-zinc-600 dark:text-zinc-400">
          (class {p.code})
        </span>
      </h1>
      <p className="mt-3 leading-7" data-testid="group-description">
        {p.description}
      </p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Generated from the Commission&apos;s tables, dataset of {updated}.
        {p.mandatoryFrom
          ? " Registration for this class is mandatory under the Commission's staged roll-out."
          : ""}
      </p>

      <section aria-labelledby="audit-heading" data-testid="group-audit">
        <h2 id="audit-heading" className={h2}>
          Your audit: {p.pathwayLabel}
        </h2>
        <p className="mt-3 leading-7">{p.pathwayDescription}</p>
        <p className="mt-2 leading-7 text-zinc-700 dark:text-zinc-300">
          {p.pathwayRule.text}{" "}
          <a
            href={p.pathwayRule.source.url}
            className="underline underline-offset-2"
            rel="noopener noreferrer"
            target="_blank"
          >
            Source: {p.pathwayRule.source.title} (opens in a new tab)
          </a>
        </p>
        {p.midTermAudit.applies ? (
          <p className="mt-2 leading-7 text-zinc-700 dark:text-zinc-300">
            A mid-term audit follows about{" "}
            {p.midTermAudit.monthsAfterRegistration} months after registration;
            prepare from month {p.midTermAudit.prepareFromMonth}.
          </p>
        ) : null}
        {p.notes.map((n) => (
          <p
            key={n.text}
            className="mt-2 leading-7 text-zinc-700 dark:text-zinc-300"
            data-testid="group-note"
          >
            {n.unverified ? "Not settled by the Commission's material: " : ""}
            {n.text}{" "}
            <a
              href={n.source.url}
              className="underline underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              Source: {n.source.title} (opens in a new tab)
            </a>
          </p>
        ))}
      </section>

      <section aria-labelledby="modules-heading" data-testid="group-modules">
        <h2 id="modules-heading" className={h2}>
          Practice Standards modules ({p.modules.length})
        </h2>
        <ul className={list}>
          {p.modules.map((m) => (
            <li key={m.id}>
              <strong className="font-semibold">{m.name}.</strong>{" "}
              {m.description}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="documents-heading"
        data-testid="group-documents"
      >
        <h2 id="documents-heading" className={h2}>
          The documents the pack produces ({p.documents.length})
        </h2>
        <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
          Drafted from your questionnaire answers for your review, as Word
          files, with a Practice Standards self-assessment.
        </p>
        <ul className={list}>
          {p.documents.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <h3 className="mt-6 text-base font-semibold">
          Registers to keep ({p.registers.length})
        </h3>
        <ul className={list}>
          {p.registers.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="price-heading"
        className="border-ochre mt-10 rounded-md border p-4"
        data-testid="group-price"
      >
        <h2 id="price-heading" className="text-xl font-semibold tracking-tight">
          {price
            ? `${price} once for the whole pack`
            : "One fixed price for the whole pack"}
        </h2>
        <p className="mt-2 leading-7">
          First see your result free: the questionnaire ticks{" "}
          {p.name.toLowerCase()} for you and shows the audit and the documents
          for everything you deliver.
        </p>
        <p className="mt-4">
          <Link
            href={`/start?group=${p.code}`}
            className="btn-primary"
            data-testid="group-cta"
          >
            Start with {p.name.toLowerCase()} ticked
          </Link>
        </p>
      </section>

      <section aria-labelledby="faq-heading" data-testid="group-faq">
        <h2 id="faq-heading" className={h2}>
          Questions people ask
        </h2>
        {p.faq.map((f) => (
          <details
            key={f.question}
            className="mt-3 rounded-md border border-zinc-200 dark:border-zinc-800"
          >
            <summary className="min-h-12 cursor-pointer px-4 py-3 text-base font-medium">
              {f.question}
            </summary>
            <p className="px-4 pb-4 leading-7">{f.answer}</p>
          </details>
        ))}
      </section>

      <section aria-labelledby="sources-heading" data-testid="group-sources">
        <h2 id="sources-heading" className={h2}>
          Sources
        </h2>
        <ul className={list}>
          {p.sources.map((s) => (
            <li key={s.id}>
              <a
                href={s.url}
                className="underline underline-offset-2"
                rel="noopener noreferrer"
                target="_blank"
              >
                {s.title} (opens in a new tab)
              </a>
              {s.versionLabel ? `, ${s.versionLabel}` : ""}, read {s.fetchedAt}.
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

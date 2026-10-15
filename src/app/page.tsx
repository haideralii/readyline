import Link from "next/link";
import { ReadyLine } from "@/components/ready-line";
import { readyLineCounts } from "@/lib/questionnaire/readiness";
import { SAMPLE_DOCUMENT, SAMPLE_DOWNLOAD_PATH } from "@/lib/sample-document";
import { Testimonials, TrustCounters } from "@/components/trust-blocks";
import { JsonLd } from "@/components/json-ld";
import { BRAND } from "@/lib/brand";
import { HOME_COPY as C, heroHeadline } from "@/lib/home-copy";
import { businessAbn, businessName } from "@/lib/legal/config";
import { siteUrl } from "@/lib/site";
import { SUBSCRIPTION_OFF } from "@/lib/payments/copy";
import { formatAud, readPricing } from "@/lib/payments/pricing";
import { subscriptionAvailable } from "@/server/payments/stripe";

/**
 * Home page v2 (REQ-013 FR-8; batch 24): the audit question and the price in
 * the first screen, a real sample document before buying, trust cues we can
 * stand behind, the example result, the mission, and counters and
 * testimonials that render only when real. Every string lives in
 * src/lib/home-copy.ts so the claims lint runs over it.
 */
export default function Home() {
  const pricing = readPricing();
  const price = pricing.packPriceCents
    ? formatAud(pricing.packPriceCents)
    : null;
  const subscriptionPrice = pricing.subscriptionPriceCents
    ? formatAud(pricing.subscriptionPriceCents)
    : null;
  const subscriptionOffered = subscriptionAvailable();
  const abn = businessAbn();
  // Batch 45 item 1: the registered name and ABN join the mission only once both are set.
  const name = businessName();
  const registeredLine = name && abn ? C.missionRegistered(name, abn) : null;
  // REQ-025 FR-12: the card's "N of M sections drafted from the answers" line, from the sample itself.
  const sampleTailored = SAMPLE_DOCUMENT.sections.filter(
    (s) => s.mode === "tailored",
  ).length;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      {/* REQ-011: Organization structured data; the ABN joins once BUSINESS_ABN is set. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: BRAND,
          url: siteUrl(),
          areaServed: "AU",
          description:
            "Registration-readiness documents and registers for small NDIS providers. General information, prepared for your review.",
          ...(abn
            ? {
                identifier: {
                  "@type": "PropertyValue",
                  propertyID: "ABN",
                  value: abn,
                },
              }
            : {}),
        }}
      />
      <section className="max-w-2xl" data-testid="home-hero">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {C.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl">
          {heroHeadline(price)}
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-700 dark:text-zinc-300">
          {C.lead}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/start" className="btn-primary" data-testid="home-cta">
            {C.cta}
          </Link>
          <Link
            href="/sample"
            className="btn-secondary"
            data-testid="home-cta-sample"
          >
            {C.ctaSecondary}
          </Link>
        </div>
        <p
          className="mt-3 text-sm text-zinc-600 dark:text-zinc-400"
          data-testid="home-free-line"
        >
          {C.ctaNote}
        </p>
        {/* Batch 45 item 9 (D-2001): two halves of equal weight, the subscription first, the pack second. */}
        {/* Batch 47 item 1: the subscription is named only while it can be bought; otherwise the one off-state sentence. */}
        {subscriptionOffered && subscriptionPrice ? (
          <p
            className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
            data-testid="home-subscription-line"
          >
            <strong className="font-semibold">{C.keepsEyebrow}:</strong>{" "}
            {C.subscriptionLine(subscriptionPrice)}
          </p>
        ) : (
          <p
            className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
            data-testid="home-subscription-off"
          >
            <strong className="font-semibold">{C.keepsEyebrow}:</strong>{" "}
            {SUBSCRIPTION_OFF}
          </p>
        )}
        {price ? (
          <p
            className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
            data-testid="home-price-line"
          >
            <strong className="font-semibold">{C.startLine}</strong>{" "}
            {C.priceLine(price)} {C.refundLine}{" "}
            <Link href="/refunds" className="underline underline-offset-2">
              Refunds
            </Link>
            .
          </p>
        ) : null}
        <TrustCounters />
      </section>

      {/* REQ-025 FR-12: the sample left this page (13,400 px at 360 px with it); a card and two links point at /sample. */}
      <section
        id="sample"
        className="mt-12 max-w-2xl scroll-mt-6"
        aria-labelledby="sample-heading"
        data-testid="home-sample"
      >
        <h2 id="sample-heading" className="text-xl font-semibold">
          {C.sampleHeading}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-7 text-zinc-700 dark:text-zinc-300">
          {C.sampleIntro.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div
          className="mt-4 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
          data-testid="home-sample-card"
        >
          <p className="text-lg font-semibold">{SAMPLE_DOCUMENT.title}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {C.sampleCardDescription}
          </p>
          <p
            className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
            data-testid="home-sample-sections"
          >
            {sampleTailored} of {SAMPLE_DOCUMENT.sections.length} sections
            drafted from the answers.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/sample"
              className="btn-secondary"
              data-testid="home-sample-read"
            >
              {C.sampleRead}
            </Link>
            <a
              href={SAMPLE_DOWNLOAD_PATH}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              data-testid="home-sample-download"
            >
              {C.sampleDownload}
            </a>
          </div>
        </div>
      </section>

      <section
        className="mt-12 max-w-2xl"
        aria-labelledby="trust-heading"
        data-testid="home-trust"
      >
        <h2 id="trust-heading" className="text-xl font-semibold">
          {C.trustHeading}
        </h2>
        <ul className="mt-4 space-y-3 leading-7 text-zinc-700 dark:text-zinc-300">
          {C.trust.map((t) => (
            <li
              key={t.title}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
                {t.title}.
              </strong>{" "}
              {t.text}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="mt-12 max-w-2xl"
        aria-labelledby="example-heading"
        data-testid="home-example"
      >
        <h2 id="example-heading" className="text-xl font-semibold">
          {C.exampleHeading}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {C.exampleLead}
        </p>
        <div className="mt-4 rounded-md border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-lg leading-8">
            <strong>{C.example.audit}</strong> {C.example.summary}
          </p>
          <div className="mt-4">
            <ReadyLine
              counts={readyLineCounts(C.example.line)}
              noun="documents and registers"
              testId="home-ready-line"
            />
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            {C.example.facts.map((f) => (
              <div key={f.label}>
                <dt className="text-zinc-600 dark:text-zinc-400">{f.label}</dt>
                <dd className="font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {C.example.note}
          </p>
        </div>
      </section>

      <Testimonials />

      <section
        className="mt-12 max-w-2xl"
        aria-labelledby="mission-heading"
        data-testid="home-mission"
      >
        <h2 id="mission-heading" className="text-xl font-semibold">
          {C.missionHeading}
        </h2>
        {[
          [C.missionOpen, registeredLine, C.missionWhy]
            .filter(Boolean)
            .join(" "),
          ...C.mission,
        ].map((p) => (
          <p
            key={p.slice(0, 24)}
            className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300"
          >
            {p}
          </p>
        ))}
        <p className="mt-3 text-sm">
          <Link href="/about" className="underline underline-offset-2">
            More about {BRAND}
          </Link>
        </p>
        {/* REQ-011 batch 31 item 3: one line to the guides; nothing else on this page moves. */}
        <p className="mt-2 text-sm">
          <Link
            href="/guides"
            className="underline underline-offset-2"
            data-testid="home-guides-link"
          >
            Read the guides
          </Link>
        </p>
      </section>

      <section className="mt-12 max-w-2xl" aria-labelledby="what-heading">
        <h2 id="what-heading" className="text-xl font-semibold">
          {C.whatHeading}
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-zinc-700 dark:text-zinc-300">
          {C.what.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {C.pricingLead}{" "}
          <Link href="/pricing" className="underline underline-offset-2">
            {C.pricingLink}
          </Link>
          . {BRAND} {C.closing}
        </p>
      </section>
    </div>
  );
}

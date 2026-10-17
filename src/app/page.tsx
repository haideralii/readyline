import { PageShell } from "@/components/page-shell";
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
import { GlossaryTerms } from "@/components/glossary-terms";

/**
 * REQ-027 FR-3 (D-2701, D-2710): the glossary terms the home page's copy
 * uses (`home-copy.ts`), in the order they first appear, for the one
 * "What these words mean" disclosure under the hero; the copy lint holds the
 * list to the copy and the render check proves it against the page.
 */
const HOME_TERMS = [
  "mid-term-audit",
  "module",
  "practice-standards",
  "certification-audit",
  // "self-assessment" left with the "What you get" list (D-2810).
] as const;

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
    <PageShell kind="grid">
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
      {/* REQ-028 FR-10 (D-2806): the hero across the shell from lg, columns 1 to 7 the words, the buttons, the
          strip and D-2265's sentences unmoved; columns 8 to 12 the example result card. */}
      <section
        data-testid="home-hero"
        className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8"
      >
        <div className="min-w-0 lg:col-span-7 lg:row-start-1">
          <p className="text-slate text-sm font-medium">{C.eyebrow}</p>
          <h1 className="mt-2">{heroHeadline(price)}</h1>
          <p className="text-ink mt-4 text-lg leading-8">{C.lead}</p>
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
          <p className="text-slate mt-3 text-sm" data-testid="home-free-line">
            {C.ctaNote}
          </p>
          {/* REQ-028 FR-10 (D-2806): the two-cell price strip, 16 px with tabular figures, the same size and weight
            in both cells, the subscription first, each cell a link to its pricing card; a null price or the off
            state omits its cell. Stacked under sm, a row from it. */}
          {(subscriptionOffered && subscriptionPrice) || price ? (
            <nav
              aria-label="Prices"
              className="mt-4 flex flex-col gap-2 text-base tabular-nums sm:flex-row sm:flex-wrap"
              data-testid="home-price-strip"
            >
              {subscriptionOffered && subscriptionPrice ? (
                <Link
                  href="/pricing#keeps"
                  className="border-rule hover:bg-mist inline-flex min-h-11 items-center rounded-md border px-4 underline-offset-4 hover:underline"
                  data-testid="home-strip-registers"
                >
                  {C.stripRegisters(subscriptionPrice)}
                </Link>
              ) : null}
              {price ? (
                <Link
                  href="/pricing#start"
                  className="border-rule hover:bg-mist inline-flex min-h-11 items-center rounded-md border px-4 underline-offset-4 hover:underline"
                  data-testid="home-strip-pack"
                >
                  {C.stripPack(price)}
                </Link>
              ) : null}
            </nav>
          ) : null}
          {/* Batch 45 item 9 (D-2001): two halves of equal weight, the subscription first, the pack second. */}
          {/* Batch 47 item 1: the subscription is named only while it can be bought; otherwise the one off-state sentence. */}
          {subscriptionOffered && subscriptionPrice ? (
            <p
              className="text-ink mt-4 text-sm leading-6"
              data-testid="home-subscription-line"
            >
              <strong className="font-semibold">{C.keepsEyebrow}:</strong>{" "}
              {C.subscriptionLine(subscriptionPrice)}
            </p>
          ) : (
            <p
              className="text-ink mt-4 text-sm leading-6"
              data-testid="home-subscription-off"
            >
              <strong className="font-semibold">{C.keepsEyebrow}:</strong>{" "}
              {SUBSCRIPTION_OFF}
            </p>
          )}
          {price ? (
            <p
              className="text-ink mt-2 text-sm leading-6"
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
          {/* REQ-027 FR-3, D-2701: the words on this page, under the hero and inside no other disclosure. */}
          <GlossaryTerms ids={HOME_TERMS} where="page" />
        </div>
        {/* REQ-028 FR-10: the example result card in columns 8 to 12 beside the hero from lg; under lg it
            follows the hero's words (before Session C it stood after the trust cards; D-2276). */}
        <section
          className="mt-12 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:mt-0"
          aria-labelledby="example-heading"
          data-testid="home-example"
        >
          <h2 id="example-heading" className="">
            {C.exampleHeading}
          </h2>
          <p className="text-slate mt-2 text-sm leading-6">{C.exampleLead}</p>
          <div className="border-rule bg-mist mt-4 rounded-md border p-4">
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
                  <dt className="text-slate">{f.label}</dt>
                  <dd className="font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-slate mt-3 text-sm leading-6">
              {C.example.note}
            </p>
          </div>
        </section>
      </section>

      {/* REQ-025 FR-12: the sample left this page (13,400 px at 360 px with it); a card and two links point at /sample. */}
      <section
        id="sample"
        className="mt-12 scroll-mt-6"
        aria-labelledby="sample-heading"
        data-testid="home-sample"
      >
        {/* REQ-028 FR-10: 7 / 5 from lg, the words left and the card right. */}
        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8">
          <div className="lg:col-span-7">
            <h2 id="sample-heading" className="">
              {C.sampleHeading}
            </h2>
            <ul className="text-ink mt-2 list-disc space-y-1 pl-5 leading-7">
              {C.sampleIntro.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div
            className="border-rule mt-4 rounded-md border p-4 lg:col-span-5 lg:mt-0"
            data-testid="home-sample-card"
          >
            <p className="text-lg font-semibold">{SAMPLE_DOCUMENT.title}</p>
            <p className="text-ink mt-1 text-sm leading-6">
              {C.sampleCardDescription}
            </p>
            <p
              className="text-slate mt-1 text-sm"
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
        </div>
      </section>

      <section
        className="mt-12"
        aria-labelledby="trust-heading"
        data-testid="home-trust"
      >
        <h2 id="trust-heading" className="">
          {C.trustHeading}
        </h2>
        {/* REQ-028 FR-10: a 2 x 2 grid from lg. */}
        <ul className="text-ink mt-4 space-y-3 leading-7 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {C.trust.map((t) => (
            <li key={t.title} className="border-rule rounded-md border p-4">
              <strong className="text-ink font-semibold">{t.title}.</strong>{" "}
              {t.text}
            </li>
          ))}
        </ul>
      </section>

      <Testimonials />

      <section
        className="mt-12"
        aria-labelledby="mission-heading"
        data-testid="home-mission"
      >
        {/* REQ-028 FR-10: eight of the twelve columns from lg. */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-8">
            <h2 id="mission-heading" className="">
              {C.missionHeading}
            </h2>
            {[
              [C.missionOpen, registeredLine, C.missionWhy]
                .filter(Boolean)
                .join(" "),
              ...C.mission,
            ].map((p) => (
              <p key={p.slice(0, 24)} className="text-ink mt-3 leading-7">
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
          </div>
        </div>
      </section>

      {/* D-2810 (REQ-028, PO, 17 Oct 2026): the "What you get" list went; its
          five bullets restated the hero and the sample card, and with the
          glossary disclosure and the subscription sentence the page sat on
          REQ-025 FR-12's 5,000 px cap at 360 px. The pricing line stays. */}
      <section className="mt-12">
        <p className="text-slate text-sm leading-6">
          {C.pricingLead}{" "}
          <Link href="/pricing" className="underline underline-offset-2">
            {C.pricingLink}
          </Link>
          . {BRAND} {C.closing}
        </p>
      </section>
    </PageShell>
  );
}

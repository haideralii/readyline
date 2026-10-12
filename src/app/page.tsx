import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { HOME_COPY as C } from "@/lib/home-copy";

/**
 * Home page (REQ-013 FR-8): the value proposition in plain words, what it
 * costs and how long it takes, trust cues we can stand behind, and one
 * example result. Every string lives in src/lib/home-copy.ts so the claims
 * lint runs over it. No testimonials until real ones exist.
 */
export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {C.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {C.headline}
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-700 dark:text-zinc-300">
          {C.lead}
        </p>
        <p className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/start"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-900 px-5 text-base font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {C.cta}
          </Link>
          <span
            className="text-sm text-zinc-600 dark:text-zinc-400"
            data-testid="home-free-line"
          >
            {C.ctaNote}
          </span>
        </p>
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

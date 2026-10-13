import { trustContent, visibleCounters } from "@/lib/trust-content";

/**
 * Honest counters and testimonials (batch 24 item 4). Both render nothing
 * until the PO has put real numbers and real words in
 * data/readyline-content/trust.json; no placeholder, no zero shown as proof.
 */
export function TrustCounters() {
  const counters = visibleCounters();
  if (counters.length === 0) return null;
  return (
    <dl
      className="mt-8 flex flex-wrap gap-6"
      data-testid="trust-counters"
      aria-label="Numbers from the private trial"
    >
      {counters.map((c) => (
        <div
          key={c.label}
          className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
        >
          <dd className="text-3xl font-semibold">{c.value}</dd>
          <dt className="text-sm text-zinc-600 dark:text-zinc-400">
            {c.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}

export function Testimonials() {
  const items = trustContent.testimonials;
  if (items.length === 0) return null;
  return (
    <section
      className="mt-12 max-w-2xl"
      aria-labelledby="testimonials-heading"
      data-testid="testimonials"
    >
      <h2 id="testimonials-heading" className="text-xl font-semibold">
        In providers&apos; own words
      </h2>
      <ul className="mt-4 space-y-4">
        {items.map((t) => (
          <li
            key={`${t.business}-${t.given}`}
            className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <blockquote className="leading-7">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t.name}, {t.business}, {t.audit} audit
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

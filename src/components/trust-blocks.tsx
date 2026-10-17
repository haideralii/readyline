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
        <div key={c.label} className="border-rule rounded-md border px-4 py-3">
          <dd className="text-3xl font-semibold">{c.value}</dd>
          <dt className="text-slate text-sm">{c.label}</dt>
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
      <h2 id="testimonials-heading" className="">
        In providers&apos; own words
      </h2>
      <ul className="mt-4 space-y-4">
        {items.map((t) => (
          <li
            key={`${t.business}-${t.given}`}
            className="border-rule rounded-md border p-4"
          >
            <blockquote className="leading-7">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <p className="text-slate mt-2 text-sm">
              {t.name}, {t.business}, {t.audit} audit
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

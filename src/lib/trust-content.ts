/**
 * Trust content the PO fills during the trial (batch 24 item 4): counters
 * that render nothing until a number exists, and testimonials that render
 * nothing until there is one. Parsed strictly so a half-filled entry fails
 * the build rather than showing a blank quote.
 */
import { z } from "zod";
import trustJson from "../../data/readyline-content/trust.json";

const Counter = z.number().int().nonnegative().nullable();

export const Testimonial = z.object({
  /** The provider's own words, as given in writing. */
  quote: z.string().trim().min(20).max(400),
  /** First name or "a sole trader", never a participant. */
  name: z.string().trim().min(1).max(60),
  /** The business name, with the provider's permission. */
  business: z.string().trim().min(1).max(80),
  /** "verification" or "certification", so the reader knows which audit it was. */
  audit: z.enum(["verification", "certification"]),
  /** ISO date the words were given. */
  given: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const TrustContent = z.object({
  note: z.string(),
  owner: z.literal("po"),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counters: z.object({
    providersHelped: Counter,
    firstAuditsPassed: Counter,
  }),
  testimonials: z.array(Testimonial).max(12),
});
export type TrustContent = z.infer<typeof TrustContent>;
export type Testimonial = z.infer<typeof Testimonial>;

export const trustContent: TrustContent = TrustContent.parse(trustJson);

export type CounterView = { label: string; value: number };

/** The counters that have a number; an empty list means the block does not render. */
export function visibleCounters(c: TrustContent = trustContent): CounterView[] {
  const out: CounterView[] = [];
  if (c.counters.providersHelped !== null)
    out.push({ label: "providers helped", value: c.counters.providersHelped });
  if (c.counters.firstAuditsPassed !== null)
    out.push({
      label: "first audits passed",
      value: c.counters.firstAuditsPassed,
    });
  return out;
}

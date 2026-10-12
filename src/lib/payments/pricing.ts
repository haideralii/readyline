/**
 * Display pricing from configuration (REQ-007 FR-1, FR-9; CLAUDE.md 5: one
 * fixed, visible price, no hidden fees). The amounts are display values; the
 * Stripe Price is the source of truth for what is charged and a startup check
 * compares the two when the key is live (Session C).
 */

export type Pricing = {
  /** The pack price in cents, or null until PACK_PRICE_AUD_CENTS is set. */
  packPriceCents: number | null;
  /** The sentence shown beside the price about GST, or null until GST_LINE is set. */
  gstLine: string | null;
  /** The subscription's display price, or null until SUBSCRIPTION_PRICE_AUD_CENTS is set (shown as "coming"). */
  subscriptionPriceCents: number | null;
};

function cents(value: string | undefined): number | null {
  const v = value?.trim();
  if (!v || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

export function readPricing(
  env: Record<string, string | undefined> = process.env,
): Pricing {
  return {
    packPriceCents: cents(env.PACK_PRICE_AUD_CENTS),
    gstLine: env.GST_LINE?.trim() || null,
    subscriptionPriceCents: cents(env.SUBSCRIPTION_PRICE_AUD_CENTS),
  };
}

/** "AUD 399" for whole dollars, "AUD 399.50" otherwise. */
export function formatAud(centsValue: number): string {
  const dollars = Math.floor(centsValue / 100);
  const rest = centsValue % 100;
  return rest === 0
    ? `AUD ${dollars.toLocaleString("en-AU")}`
    : `AUD ${dollars.toLocaleString("en-AU")}.${String(rest).padStart(2, "0")}`;
}

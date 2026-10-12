/**
 * The display price must be what Stripe charges (REQ-007 FR-9, AC-6). With
 * a live key the server refuses to start on a mismatch; with a test key it
 * only reports. Pure over an injected Price reader so the rule is unit
 * tested without the network.
 */

export type PriceReader = (
  priceId: string,
) => Promise<{ unit_amount: number | null; currency: string }>;

export type PriceCheck =
  | { ok: true; amountCents: number; currency: string }
  | { ok: false; reason: string };

export async function checkPackPrice(input: {
  read: PriceReader;
  priceId: string;
  expectedCents: number | null;
}): Promise<PriceCheck> {
  if (!input.expectedCents)
    return { ok: false, reason: "PACK_PRICE_AUD_CENTS is not set" };
  let price;
  try {
    price = await input.read(input.priceId);
  } catch (e) {
    return {
      ok: false,
      reason: `could not read the Price: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (price.currency.toLowerCase() !== "aud")
    return {
      ok: false,
      reason: `Price currency is ${price.currency}, not aud`,
    };
  if (price.unit_amount !== input.expectedCents)
    return {
      ok: false,
      reason: `Price unit_amount ${price.unit_amount} differs from PACK_PRICE_AUD_CENTS ${input.expectedCents}`,
    };
  return { ok: true, amountCents: price.unit_amount, currency: "aud" };
}

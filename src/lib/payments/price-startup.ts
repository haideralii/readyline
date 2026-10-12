/**
 * Startup half of the price check (REQ-007 FR-9, AC-6), run from
 * src/instrumentation.ts in the Node runtime only. Live key: a mismatch
 * stops the process with a message naming both values. Test key: the
 * comparison is logged. Fake mode or no Stripe configuration: nothing to
 * check. Kept out of instrumentation.ts because that file is also compiled
 * for the Edge runtime.
 */
import { log } from "@/lib/logging/logger";
import { isFakeStripeMode, isLiveKey } from "./fake-session";
import { checkPackPrice } from "./price-check";
import { readPricing } from "./pricing";

export async function checkPackPriceAtStartup(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const priceId = env.STRIPE_PRICE_PACK?.trim();
  if (!secretKey || !priceId || isFakeStripeMode(env)) return;
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secretKey, { typescript: true });
  const result = await checkPackPrice({
    read: async (id) => {
      const p = await stripe.prices.retrieve(id);
      return { unit_amount: p.unit_amount, currency: p.currency };
    },
    priceId,
    expectedCents: readPricing(env).packPriceCents,
  });
  if (result.ok) {
    log.info("payments.price-check.ok", { amountCents: result.amountCents });
    return;
  }
  if (isLiveKey(secretKey)) {
    globalThis.process.stderr.write(
      `\nPrice check failed; refusing to start with a live Stripe key.\n  - ${result.reason}\nSet PACK_PRICE_AUD_CENTS to the Price's unit_amount, or fix the Price in the Stripe dashboard.\n\n`,
    );
    globalThis.process.exit(1);
  }
  log.warn("payments.price-check.mismatch", { reason: result.reason });
}

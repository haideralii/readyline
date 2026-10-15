/**
 * Startup half of the price and live-mode checks (REQ-007 FR-9, AC-6;
 * REQ-022 FR-3, D-2209), run from src/instrumentation.ts in the Node
 * runtime only. Test key: the price comparison is logged. Live key: the
 * guards in live-guards.ts are judged against the Prices as Stripe reports
 * them, and any condition is stored with setPaymentRefusal(), after which
 * the checkout actions answer "not available" and the webhook route 404s
 * while the rest of the site serves; one log line names the conditions.
 * Fake mode or no Stripe configuration: nothing to check. Kept out of
 * instrumentation.ts because that file is also compiled for the Edge
 * runtime.
 */
import { log } from "@/lib/logging/logger";
import { isFakeStripeMode, isLiveKey } from "./fake-session";
import { liveModeProblems, type PriceFact } from "./live-guards";
import { checkPackPrice } from "./price-check";
import { readPricing } from "./pricing";
import { setPaymentRefusal } from "./refusal";

export type PriceReader = {
  retrieve(id: string): Promise<{
    livemode: boolean;
    unit_amount: number | null;
    currency: string;
  }>;
};

export async function readPriceFact(
  prices: PriceReader,
  id: string | undefined,
): Promise<PriceFact | null> {
  if (!id?.trim()) return null;
  try {
    const p = await prices.retrieve(id.trim());
    return {
      ok: true,
      livemode: p.livemode,
      unitAmount: p.unit_amount,
      currency: p.currency,
    };
  } catch (e) {
    const err = e as { type?: string; statusCode?: number };
    return {
      ok: false,
      reason:
        err?.type === "StripePermissionError" || err?.statusCode === 403
          ? "no-permission"
          : err?.statusCode === 404
            ? "not-found"
            : "error",
    };
  }
}

/** Pure over a Price reader, so both key modes are unit tested without the network. */
export async function judgeStartup(
  env: Record<string, string | undefined>,
  prices: PriceReader,
): Promise<{ refused: string[]; logged: "ok" | "mismatch" | "none" }> {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const priceId = env.STRIPE_PRICE_PACK?.trim();
  if (!secretKey || !priceId || isFakeStripeMode(env))
    return { refused: [], logged: "none" };
  if (isLiveKey(secretKey)) {
    const refused = liveModeProblems({
      env,
      pack: await readPriceFact(prices, priceId),
      registers: await readPriceFact(prices, env.STRIPE_PRICE_REGISTERS),
    });
    return { refused, logged: refused.length ? "mismatch" : "ok" };
  }
  const result = await checkPackPrice({
    read: async (id) => {
      const p = await prices.retrieve(id);
      return { unit_amount: p.unit_amount, currency: p.currency };
    },
    priceId,
    expectedCents: readPricing(env).packPriceCents,
  });
  return { refused: [], logged: result.ok ? "ok" : "mismatch" };
}

export async function checkPackPriceAtStartup(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const priceId = env.STRIPE_PRICE_PACK?.trim();
  if (!secretKey || !priceId || isFakeStripeMode(env)) return;
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secretKey, { typescript: true });
  const verdict = await judgeStartup(env, stripe.prices);
  setPaymentRefusal(verdict.refused);
  if (verdict.refused.length) {
    // REQ-022 FR-3: one line naming the conditions; the payment routes refuse, the site serves.
    log.error("payments.live-guard.refused", {
      conditions: verdict.refused,
    });
    return;
  }
  if (verdict.logged === "ok") log.info("payments.price-check.ok", {});
  else if (verdict.logged === "mismatch")
    log.warn("payments.price-check.mismatch", {});
}

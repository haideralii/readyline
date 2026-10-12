import "server-only";
/**
 * The Stripe client and secrets (REQ-007 FR-9, SR-3). Built on the server
 * only; the secret key never reaches a client bundle (`server-only`). Code
 * that talks to Stripe takes the client as an argument so tests pass a fake.
 */
import Stripe from "stripe";

export const STRIPE_ENV_NAMES = {
  secretKey: "STRIPE_SECRET_KEY",
  webhookSecret: "STRIPE_WEBHOOK_SECRET",
  pricePack: "STRIPE_PRICE_PACK",
} as const;

export class StripeEnvError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(
      `Stripe is not configured: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing. Set the value(s) in .env.local; in production they live in the Vercel project environment variables.`,
    );
    this.name = "StripeEnvError";
    this.missing = missing;
  }
}

export function readStripeEnv(
  source: Record<string, string | undefined> = process.env,
): { secretKey: string; webhookSecret: string; pricePack: string } {
  const secretKey = source[STRIPE_ENV_NAMES.secretKey]?.trim();
  const webhookSecret = source[STRIPE_ENV_NAMES.webhookSecret]?.trim();
  const pricePack = source[STRIPE_ENV_NAMES.pricePack]?.trim();
  const missing: string[] = [];
  if (!secretKey) missing.push(STRIPE_ENV_NAMES.secretKey);
  if (!webhookSecret) missing.push(STRIPE_ENV_NAMES.webhookSecret);
  if (!pricePack) missing.push(STRIPE_ENV_NAMES.pricePack);
  if (missing.length) throw new StripeEnvError(missing);
  return {
    secretKey: secretKey!,
    webhookSecret: webhookSecret!,
    pricePack: pricePack!,
  };
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { typescript: true, maxNetworkRetries: 2 });
}

/** True when the key is a live key: the startup price check (Session C) refuses to serve on a mismatch. */
export function isLiveKey(secretKey: string): boolean {
  return secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
}

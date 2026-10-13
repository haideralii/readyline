import "server-only";
/**
 * The Stripe client and secrets (REQ-007 FR-9, SR-3). Built on the server
 * only; the secret key never reaches a client bundle (`server-only`). Code
 * that talks to Stripe takes the client as an argument so tests pass a fake.
 * In fake mode (D-709) the missing values are filled with local-only ones so
 * the webhook route can verify the fake page's signatures.
 */
import Stripe from "stripe";
import {
  FAKE_PRICE_ID,
  FAKE_REGISTERS_PRICE_ID,
  fakeSecretKey,
  fakeWebhookSecret,
  isFakeStripeMode,
  isLiveKey,
} from "@/lib/payments/fake-session";

export { isLiveKey };

export const STRIPE_ENV_NAMES = {
  secretKey: "STRIPE_SECRET_KEY",
  webhookSecret: "STRIPE_WEBHOOK_SECRET",
  pricePack: "STRIPE_PRICE_PACK",
  /** REQ-009 Session C: the recurring Price for the registers; optional until Haider creates it. */
  priceRegisters: "STRIPE_PRICE_REGISTERS",
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

export type StripeEnv = {
  secretKey: string;
  webhookSecret: string;
  pricePack: string;
  /** Null until STRIPE_PRICE_REGISTERS is set; the subscription button hides meanwhile. */
  priceRegisters: string | null;
  /** True when Checkout is the local fake page and the webhook secret is the local one. */
  fake: boolean;
};

export function readStripeEnv(
  source: Record<string, string | undefined> = process.env,
): StripeEnv {
  const fake = isFakeStripeMode(source);
  const secretKey = source[STRIPE_ENV_NAMES.secretKey]?.trim();
  const webhookSecret = source[STRIPE_ENV_NAMES.webhookSecret]?.trim();
  const pricePack = source[STRIPE_ENV_NAMES.pricePack]?.trim();
  const priceRegisters = source[STRIPE_ENV_NAMES.priceRegisters]?.trim();
  if (fake) {
    return {
      secretKey: secretKey || fakeSecretKey(),
      webhookSecret: fakeWebhookSecret(source),
      pricePack: pricePack || FAKE_PRICE_ID,
      priceRegisters: priceRegisters || FAKE_REGISTERS_PRICE_ID,
      fake: true,
    };
  }
  const missing: string[] = [];
  if (!secretKey) missing.push(STRIPE_ENV_NAMES.secretKey);
  if (!webhookSecret) missing.push(STRIPE_ENV_NAMES.webhookSecret);
  if (!pricePack) missing.push(STRIPE_ENV_NAMES.pricePack);
  if (missing.length) throw new StripeEnvError(missing);
  return {
    secretKey: secretKey!,
    webhookSecret: webhookSecret!,
    pricePack: pricePack!,
    priceRegisters: priceRegisters || null,
    fake: false,
  };
}

/** True when a Subscribe button may be shown: Stripe is configured and the registers Price exists (or fake mode). */
export function subscriptionAvailable(
  source: Record<string, string | undefined> = process.env,
): boolean {
  try {
    return Boolean(readStripeEnv(source).priceRegisters);
  } catch (e) {
    if (e instanceof StripeEnvError) return false;
    throw e;
  }
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { typescript: true, maxNetworkRetries: 2 });
}

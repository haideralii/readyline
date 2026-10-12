/**
 * The Checkout Session parameters (REQ-007 FR-2, AC-3, SR-3), built as a pure
 * function so the rules are unit-tested: card only, no instalments, one
 * fixed Price, the account on the session and on the payment intent, and
 * success and cancel URLs on our own origin.
 */
import type Stripe from "stripe";

export const CANCEL_PATHS = [
  "/pricing",
  "/start/result",
  "/documents",
] as const;
export type CancelPath = (typeof CANCEL_PATHS)[number];

export type CheckoutInput = {
  priceId: string;
  accountId: string;
  email: string;
  assessmentId: string;
  packVersion: string;
  siteUrl: string;
  cancelPath: string;
};

export function safeCancelPath(path: string | undefined): CancelPath {
  return (CANCEL_PATHS as readonly string[]).includes(path ?? "")
    ? (path as CancelPath)
    : "/pricing";
}

export function buildCheckoutParams(
  input: CheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  const site = input.siteUrl.replace(/\/$/, "");
  const metadata = {
    account_id: input.accountId,
    assessment_id: input.assessmentId,
    pack_version: input.packVersion,
  };
  return {
    mode: "payment",
    // Card only (CLAUDE.md 5): no Afterpay, Klarna, Zip or any pay-later method.
    // API 2026-09-30 (SDK 23) replaced `payment_method_types` on Checkout with
    // `allowed_payment_method_types`, a filter on the dynamically computed set.
    allowed_payment_method_types: ["card"],
    line_items: [{ price: input.priceId, quantity: 1 }],
    customer_email: input.email,
    client_reference_id: input.accountId,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${site}/documents?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}${safeCancelPath(input.cancelPath)}`,
    allow_promotion_codes: false,
    locale: "auto",
  };
}

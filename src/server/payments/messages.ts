/**
 * Messages the Buy action can answer with (REQ-007 FR-2, SR-4), kept out of
 * the "use server" module because such a module may export only async
 * functions once a client component imports it.
 */
export type CheckoutActionResult = { ok: false; message: string };

export const CHECKOUT_UNAVAILABLE =
  "Buying is not available in this environment yet.";
export const CHECKOUT_RATE_LIMITED =
  "You have started a few checkouts in the last hour. Give it an hour and try again, or email us at the contact address in the footer.";
export const CHECKOUT_NEEDS_ANSWERS =
  "Finish every step of the questionnaire first; the pack is drafted from those answers.";
/** Stripe refused or failed while the session was being created (batch 23 item 2); nothing was charged. */
export const CHECKOUT_FAILED =
  "Buying is not available right now; nothing was charged. Please try again in a few minutes, or email us at the contact address in the footer.";
/** REQ-009 Session C: the registers subscription. */
export const SUBSCRIPTION_UNAVAILABLE =
  "The registers subscription is not available in this environment yet.";
export const SUBSCRIPTION_ALREADY_ACTIVE =
  "Your registers subscription is already active.";
export const PORTAL_UNAVAILABLE =
  "Billing settings are not available right now. Email us at the contact address in the footer and we will sort it out.";

/**
 * What to log when Stripe fails: the SDK's error type and code, never the
 * message (it can echo the key prefix or the Price id) and never the key.
 */
export function stripeFailureFields(error: unknown): {
  type: string;
  code: string | null;
  status: number | null;
} {
  const e = error as {
    type?: unknown;
    code?: unknown;
    statusCode?: unknown;
    name?: unknown;
  } | null;
  return {
    type:
      typeof e?.type === "string"
        ? e.type
        : typeof e?.name === "string"
          ? e.name
          : "unknown",
    code: typeof e?.code === "string" ? e.code : null,
    status: typeof e?.statusCode === "number" ? e.statusCode : null,
  };
}

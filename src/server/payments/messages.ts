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

/**
 * Every string on the pricing page (REQ-007 FR-1; CLAUDE.md 4.3, 5). Kept in
 * one place so the claims lint runs over all of it in a unit test, and so the
 * no-dark-patterns rule (no urgency, no scarcity, no pre-ticked anything) is
 * reviewable in one file. The refund promise is not here: it is read from
 * product/legal/refunds.md so the page and the Refunds page cannot drift.
 */
import {
  AI_DISCLOSURE,
  BRAND,
  GENERAL_INFORMATION_STATEMENT,
} from "@/lib/brand";

/**
 * Batch 47 item 1: the one sentence for the subscription's off state, used
 * by every page that names the registers subscription (home, result,
 * pricing, refunds, account) while STRIPE_PRICE_REGISTERS is unset. In the
 * voice of batch 45 item 2: an environment fact, never "coming" or "soon".
 */
export const SUBSCRIPTION_OFF =
  "The registers subscription is not switched on in this environment.";

export const PRICING_COPY = {
  /** REQ-028 FR-10: the page is "Pricing"; each card carries its product's name. */
  title: "Pricing",
  intro: `One fixed price for the policies, procedures, registers and self-assessment your answers call for, as editable Word files. ${BRAND} drafts them; you review and adopt them.`,
  priceHeading: "Price",
  priceUnset:
    "The price is not set in this environment. In production it is a single fixed amount in Australian dollars.",
  whatYouGetHeading: "What you get",
  whatYouGetForYou:
    "The documents your questionnaire answers call for. Your set is listed below.",
  whatYouGetCore:
    "Every pack includes the core set below. Finish the questionnaire to see the exact set for your supports.",
  whatItIsNotHeading: "What it is not",
  whatItIsNot: [
    "The documents are first drafts for your review, not finished policies. You change anything that is not true for your business and adopt them yourself.",
    "They are general information and document templates, not legal advice.",
    "Buying the pack does not mean you will be registered. The auditor and the Commission decide that; the pack prepares you for the audit.",
  ],
  refundHeading: "Refunds",
  aiHeading: "How the drafts are made",
  /** REQ-011 (batch 40 item 5): the honest answer to the sector's warning about AI-written policies (CLAUDE.md 4.3: no audit-proof, no compliant). */
  /** REQ-025 FR-11: the lead and three parallel facts as a list. */
  aiHonest:
    "Consultants warn that AI-written policies are vague, generic and unfinished. Ours are built from your own answers:",
  aiHonestPoints: [
    "Every step names a role, a time and a record.",
    "Vague wording and leftover blanks are rejected before a document reaches you.",
    "You read and adopt each document before it counts.",
  ],
  aiDisclosure: AI_DISCLOSURE,
  /** Batch 45 item 10: the provider's own AI statement is an appendix to the pack's privacy policy, not a separate document (REQ-016 S-6). */
  aiAppendixLead:
    "Your own statement on AI and digital tools is an appendix to the privacy policy in your pack, so an auditor finds it with your privacy commitments.",
  aiAppendixLink: "How Readyline uses AI",
  notLegalAdvice: GENERAL_INFORMATION_STATEMENT,
  /** Batch 45 item 9 (D-2001): two halves of equal weight, the subscription first, the pack second; no bundling, no discount. */
  keepsEyebrow: "What keeps you audit-ready",
  startEyebrow: "Where you start",
  /** Batch 49 item 2: the subscription card as a price line, a four-item list and the cancel line; the linking sentence lives on the registers page. */
  subscriptionPriceLine: (price: string | null) =>
    price
      ? `${price} a month for the registers, with email reminders.`
      : "A monthly subscription for the registers, with email reminders.",
  /** REQ-028 FR-10 (D-2816): the words beside the 30 px figure on each card; subscriptionPriceLine stays for the no-figure case. */
  subscriptionPriceNote: "a month for the registers, with email reminders.",
  packPriceNote: "one-off, for the document pack",
  subscriptionIncludes: [
    "Incident register",
    "Complaints register",
    "Worker checks, with expiry reminders",
    "Policy review reminders",
  ],
  subscriptionCancel:
    "Cancel at any time; no notice period, no fee, no instalments, no interest.",
  /** Batch 49 item 3: the two prices above both cards on a phone, each a link to its card. */
  stripPack: (price: string | null) =>
    price ? `Document pack: ${price}, once` : "Document pack: one price, once",
  stripRegisters: (price: string | null) =>
    price
      ? `Registers: ${price} a month, cancel any time`
      : "Registers: monthly, cancel any time",
  separateLine:
    "The two are separate: the pack is paid once and the subscription is monthly; neither includes the other, and there is no discount for taking both.",
  /** REQ-028 FR-10 (QA N7): one name for the subscription everywhere, the registers subscription. */
  subscriptionHeading: "Registers subscription",
  /** Batch 47 item 1: the one sentence every page uses while STRIPE_PRICE_REGISTERS is unset; never "coming" or "soon". */
  subscriptionOff: SUBSCRIPTION_OFF,
  /** CLAUDE.md 5: said under the subscription in both states, since it holds whether or not it can be bought today. */
  noCredit: "No instalments, no interest, no late fees.",
  buy: "Buy the document pack",
  signInToBuy: "Sign in to buy",
  signInNote:
    "You sign in with an email link first, so the pack is tied to your account and you can download it again later.",
  termsLead: "Before you buy, read the",
  terms: "Terms of use",
  privacy: "Privacy policy",
  refundsPage: "Refunds page",
} as const;

/** Every string the page can show, for the claims lint test. */
export function pricingStrings(): string[] {
  const out: string[] = [];
  for (const value of Object.values(PRICING_COPY)) {
    if (typeof value === "string") out.push(value);
    else if (typeof value === "function")
      out.push(value("AUD 399"), value(null));
    else out.push(...value);
  }
  return out;
}

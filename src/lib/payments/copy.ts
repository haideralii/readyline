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

export const PRICING_COPY = {
  title: "Your document pack",
  intro: `One fixed price for the policies, procedures, registers and the Practice Standards self-assessment your answers call for, drafted for your business and delivered as editable Word files. ${BRAND} drafts them; you review and adopt them.`,
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
  aiDisclosure: AI_DISCLOSURE,
  notLegalAdvice: GENERAL_INFORMATION_STATEMENT,
  subscriptionHeading: "Audit-ready subscription",
  subscriptionComing:
    "Coming after the document pack: the incident and complaints registers, the worker screening expiry tracker, policy review reminders and the mid-term audit countdown, as a monthly subscription you can cancel at any time. No instalments, no interest, no late fees.",
  subscriptionPriceLead: "Expected price:",
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
    else out.push(...value);
  }
  return out;
}

/**
 * Every purchase-related string on the documents page (REQ-007 FR-5, FR-6,
 * FR-8; CLAUDE.md 4.3), in one place for the claims lint. No error codes
 * ever reach the customer: a failed job reads as "preparing".
 */
import { BRAND } from "@/lib/brand";

export const DOCUMENTS_COPY = {
  intro: `${BRAND} drafts your policy and procedure set and a Practice Standards self-assessment from your questionnaire answers. Every document is a first draft for your review; sections we could not draft are marked for you to complete.`,
  buyHeading: "Buy your document pack",
  buyLead:
    "One fixed price for the documents your answers call for, drafted for your business as editable Word files, with the readiness summary.",
  buyButton: "Buy the document pack",
  buyNeedsAnswers:
    "Finish the questionnaire first; the pack is drafted from those answers.",
  buyTerms: "Before you buy, read the",
  thanks:
    "Thank you. Your payment went through and we are preparing your documents now.",
  preparingHeading: "Preparing your documents",
  preparing:
    "Preparing your documents (usually 10 to 20 minutes). This page refreshes on its own; we also email you when the set is ready.",
  preparingProgress: (done: number) =>
    done === 1
      ? "1 document drafted so far."
      : `${done} documents drafted so far.`,
  delayed:
    "We are preparing your documents and will email you when they are ready. This is taking longer than usual; you do not need to do anything.",
  readyHeading: "Your document pack",
  readyLead:
    "Your set is ready. Download everything as a zip, the readiness summary on its own, or open each document to review the tailored sections.",
  openSet: "Open the document set",
  receiptLink: "View your receipt",
  receiptPending: "Your receipt is on its way from Stripe by email.",
  refundLink: "Request a refund",
  refundNote:
    "Full refund within 14 days if nothing has been downloaded; after a download, a refund if the documents do not match your answers.",
  refundedHeading: "This purchase was refunded",
  refunded:
    "Your document pack was refunded, so the downloads are closed. Your questionnaire answers are kept; you can buy a new pack at any time.",
  lockedSet:
    "The downloads for this set are closed because the purchase was refunded.",
} as const;

/** Every fixed string the page can show, for the claims lint test. */
export function documentsStrings(): string[] {
  const out: string[] = [];
  for (const value of Object.values(DOCUMENTS_COPY)) {
    if (typeof value === "string") out.push(value);
    else out.push(value(2));
  }
  return out;
}

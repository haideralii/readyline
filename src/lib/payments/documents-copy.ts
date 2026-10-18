/**
 * Every purchase-related string on the documents page (REQ-007 FR-5, FR-6,
 * FR-8; CLAUDE.md 4.3), in one place for the claims lint. No error codes
 * ever reach the customer: a failed job reads as "preparing".
 */
import { BRAND } from "@/lib/brand";

export const DOCUMENTS_COPY = {
  intro: `${BRAND} drafts your policies, procedures and self-assessment from your answers. Every document is a first draft for your review. Sections we could not draft are marked for you to complete.`,
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
  /** Batch 32 item 3: no email provider exists yet (D-013), so the page promises only what is true. */
  preparing:
    "Preparing your documents (usually 10 to 20 minutes). You can close this page. Come back in about 20 minutes and your documents will be here.",
  preparingProgress: (done: number) =>
    done === 1
      ? "1 document drafted so far."
      : `${done} documents drafted so far.`,
  delayed:
    "We are still preparing your documents. This is taking longer than usual; you do not need to do anything. Come back later and they will be here.",
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
  /** REQ-035 FR-5 (D-2966): the gap checks on the documents page, and the catalogue list before a set exists. */
  gapHeading: "Your own policies checked",
  gapLead:
    "A policy you already have, compared with Readyline's outline for its document type.",
  gapLink: "Check a policy you already have",
  gapNone: "No checks yet.",
  packHoldsHeading: "What your pack holds",
  packHoldsLead:
    "The documents your answers call for. Each one is written for you when you buy the pack.",
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

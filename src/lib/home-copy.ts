/**
 * Every string on the home page (REQ-013 FR-8; batch 24 home v2 after the
 * competitor review), in one place so the claims lint runs over all of it in
 * a unit test. Proof over promise: what the Commission publishes, where data
 * lives, what we never collect, a real sample document, honest counters.
 * No superlatives; testimonials only from data/readyline-content/trust.json.
 */
import { BRAND } from "@/lib/brand";

/** The hero headline with the configured price (batch 24 item 1); the price clause is dropped when no price is set. */
export function heroHeadline(price: string | null): string {
  return price
    ? `Find out which NDIS audit you'll face — free. Then get every document it needs, drafted from your answers, for ${price}.`
    : "Find out which NDIS audit you'll face — free. Then get every document it needs, drafted from your answers, for one fixed price.";
}

export const HOME_COPY = {
  eyebrow: "For sole traders and small providers",
  /** Three lines on a phone (batch 26 item 5), so the price and refund lines sit in the first screen. */
  lead: `Answer plain questions about your supports and workers. ${BRAND} tells you which audit you face, with the Commission's text behind it, then drafts every document to fit.`,
  cta: "See which audit I need",
  ctaSecondary: "See a sample document",
  ctaNote: "Free, about ten minutes, no account needed.",
  keepsEyebrow: "What keeps you audit-ready",
  /** The first screen says what it costs and what the deal is (batch 24 item 1). */
  /** Batch 45 item 9 (D-2001): the subscription first, as what keeps a provider audit-ready; the pack second, as where they start. */
  subscriptionLine: (price: string) =>
    `${price} a month keeps you audit-ready: the registers, the reminders and the mid-term audit countdown, with the evidence already in place at renewal. Cancel at any time.`,
  startLine: "Where you start:",
  priceLine: (price: string) =>
    `${price} one-off for the document pack. No subscription needed, no instalments, no interest.`,
  refundLine:
    "Full refund within 14 days if you have not downloaded the documents; after a download, a refund if they do not match your answers.",
  sampleHeading: "See exactly what you get",
  sampleLead:
    "This is a real document from a recorded run, not a template: the complaints policy for a fictional sole trader. The sections marked in colour were drafted from that provider's answers; the rest is fixed text every provider gets. Your pack has every document your audit calls for, each one like this.",
  trustHeading: "What you can count on",
  trust: [
    {
      title: "Sourced to the Commission",
      text: "Every module, standard and audit rule comes from the NDIS Quality and Safeguards Commission's published Practice Standards and registration pages, with a link to the source on your result.",
    },
    {
      title: "Hosted in Australia",
      text: "Your business details stay in an Australian data centre. You can export everything or delete your account at any time.",
    },
    {
      title: "No participant data",
      text: `${BRAND} never asks for participants' names, NDIS numbers or health details, and the forms warn you not to enter them. Nothing you type about a participant is ever sent to an AI model.`,
    },
    {
      title: "Independent",
      text: "Not affiliated with the NDIA or the Commission, and not an auditor. We take no fee or commission from any auditor.",
    },
  ],
  exampleHeading: "What a result looks like",
  exampleLead:
    "A sole trader in New South Wales delivering household tasks (class 0120):",
  example: {
    audit: "Your audit: verification.",
    summary:
      "You will need 15 documents and 5 registers. An auditor reviews your documents at their desk; nobody visits.",
    facts: [
      { label: "Practice Standards module", value: "Verification module" },
      { label: "Audit", value: "Desk review of your documents" },
      { label: "Mid-term audit", value: "Does not apply" },
    ],
    /** The ready line for this example: what the reference case said it has (REQ-014 FR-2); pinned by a test. */
    line: { have: 0, documents: 15, registers: 5 },
    note: "Add personal care and the result changes to a certification audit with the core module, a site visit and a mid-term audit. The questionnaire shows the reason and the source for each change.",
  },
  missionHeading: "Why one price, and who is behind it",
  /**
   * Batch 24 item 3: 120 words in the style of product/legal/about.md. Batch
   * 45 item 1: the registered name and ABN join the first paragraph only
   * once both are set (BUSINESS_NAME, BUSINESS_ABN), the way the footer
   * shows the ABN; until then the paragraph ends one sentence earlier.
   */
  missionOpen: `${BRAND} is built and run by one person in Sydney, a software quality engineer who tests systems for a living.`,
  missionRegistered: (name: string, abn: string) =>
    `It is registered as ${name}, ABN ${abn}.`,
  missionWhy:
    "It exists because a sole trader facing their first audit is choosing between a consultant at several thousand dollars and a template pack that describes someone else's business.",
  mission: [
    "One fixed price, paid once, because the pack is something you need once. No instalments and no interest, because debt is not a service we want to sell. No subscription is needed to use what you bought. The registers are a separate, optional subscription you can cancel at any time.",
    "Every document is a draft for your review. The audit decision is the auditor's and the Commission's, not ours.",
  ],
  whatHeading: "What you get",
  what: [
    "A guided questionnaire about the supports you deliver, your workers and where you operate.",
    "Which Practice Standards modules apply to you, and whether you face a verification or certification audit.",
    "A tailored set of policies and procedures and a self-assessment, as editable Word documents for your review.",
    "A readiness checklist showing which documents, registers, clearances and insurances are still missing.",
    "Optional ongoing registers for incidents, complaints, worker screening expiry and policy reviews.",
  ],
  pricingLead:
    "The questionnaire and the checklist are free. The document pack is one fixed price; see",
  pricingLink: "pricing",
  closing:
    "provides general information and document templates for your own review, not legal advice.",
} as const;

export function homeStrings(): string[] {
  const out: string[] = [
    heroHeadline("AUD 399"),
    heroHeadline(null),
    HOME_COPY.priceLine("AUD 399"),
  ];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(HOME_COPY);
  return out;
}

/**
 * Every string on the home page (REQ-013 FR-8; REQ-014 FR-2 restyles it),
 * in one place so the claims lint runs over all of it in a unit test. Proof
 * over promise: what the Commission publishes, where data lives, what we
 * never collect. No superlatives, no testimonials (none exist yet; none
 * will ever be made up).
 */
import { BRAND } from "@/lib/brand";

export const HOME_COPY = {
  eyebrow: "For sole traders and small providers",
  headline: "Get ready for NDIS provider registration without a consultant",
  lead: `Answer a few questions about the supports you deliver and your workers. ${BRAND} tells you which Practice Standards modules apply, which audit you face and what documents and registers you need, with the Commission's own text behind every answer. Then it drafts the documents for your review.`,
  cta: "Find out what registration needs from you",
  ctaNote: "Free, about ten minutes, no account needed.",
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
      "You will need 17 documents and 5 registers. An auditor reviews your documents at their desk; nobody visits.",
    facts: [
      { label: "Practice Standards module", value: "Verification module" },
      { label: "Audit", value: "Desk review of your documents" },
      { label: "Mid-term audit", value: "Does not apply" },
    ],
    /** The ready line for this example: what the reference case said it has (REQ-014 FR-2); pinned by a test. */
    line: { done: 0, toPrepare: 6, remainder: 16 },
    note: "Add personal care and the result changes to a certification audit with the core module, a site visit and a mid-term audit. The questionnaire shows the reason and the source for each change.",
  },
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
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(HOME_COPY);
  return out;
}

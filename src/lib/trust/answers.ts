/**
 * REQ-034 FR-1 (D-2945): the trust page's eight questions, each answered in
 * one or two short sentences that restate the privacy policy, with the
 * policy section the answer comes from and the policy sentences it derives
 * from, verbatim. `legal-copy.test.ts` holds every source sentence in
 * `product/legal/privacy.md` and every answer's places and numbers in its
 * sources, so the page and the policy cannot drift apart. The
 * `{{vendor-terms-date}}` token is the policy's own and is rendered the same
 * way (`renderLegalTokens`).
 */
export type TrustRow = {
  id: string;
  /** The heading, in the provider's words, ending in a question mark (FR-7). */
  question: string;
  /** The answer's sentences, in our words; places and numbers come from the sources. Rendered as one paragraph, or as a list when `list` is set. */
  answer: readonly string[];
  /** Row 2 names six processors: one line each. */
  list?: true;
  /** The privacy policy's "## " heading the link opens, by its words; the renderer's id is looked up at render (`legalHeadingId`). */
  section: string;
  /** The policy's sentences, verbatim, the answer derives from. */
  sources: readonly string[];
};

export const TRUST_TITLE = "Where your data lives and who can see it";
export const TRUST_SOURCE_LINK_LABEL = "In the privacy policy";
export const TRUST_REVIEWED_LEAD = "Last reviewed";
export const TRUST_NAV_LABEL = "Where your data lives";

export const TRUST_ROWS: readonly TrustRow[] = [
  {
    id: "where-stored",
    question: "Where is my data stored?",
    answer: ["In Sydney, Australia, on Supabase's servers."],
    section: "Who helps us run the service",
    sources: [
      "Supabase stores your account and data on servers in Sydney, Australia.",
    ],
  },
  {
    id: "who-processes",
    list: true,
    question: "Who processes it, and where?",
    answer: [
      "Vercel runs the website, in Sydney where we can choose and otherwise in the United States.",
      "Anthropic drafts your documents from your answers, in the United States.",
      "Stripe takes payments, in the United States and elsewhere.",
      "GitHub keeps a weekly encrypted backup copy in the United States for up to 90 days.",
      "Sentry receives error reports, with email addresses and free text removed, in the United States.",
      "An email provider sends service emails.",
    ],
    section: "Who helps us run the service",
    sources: [
      "Vercel runs the website. Its servers are in Sydney where we can choose, and otherwise in the United States.",
      "Anthropic provides the AI model that drafts your documents. We send it your questionnaire answers and the fixed text of the document.",
      "Anthropic processes our requests in the United States.",
      "Stripe takes payments and keeps card details. Stripe may process data in the United States and elsewhere under its own privacy policy.",
      "GitHub, in the United States, keeps a weekly encrypted copy of our database for up to 90 days; only the owner holds the key that opens it, and each copy is deleted after 90 days.",
      "Sentry receives reports of errors on our servers, with email addresses and free text removed before they leave Australia, and stores them in the United States.",
      "An email provider sends service emails.",
    ],
  },
  {
    id: "participants",
    question: "Do you hold participant information?",
    answer: [
      "Never. Readyline is for your business information only.",
      "The forms warn you, and refuse a name or an NDIS number where they can tell.",
    ],
    section: "What we never collect",
    sources: [
      "Readyline is for your business information only.",
      "Do not enter personal, health or disability information about NDIS participants anywhere in Readyline, including in notes and registers.",
      "If we find participant information, we may remove it and tell you.",
    ],
  },
  {
    id: "training",
    question: "Is my data used to train AI?",
    answer: [
      "No. Anthropic does not use our requests to train its models under its commercial terms, as read on {{vendor-terms-date}}.",
    ],
    section: "Who helps us run the service",
    sources: [
      "It does not use our requests to train its models under its commercial terms, as read on {{vendor-terms-date}}.",
    ],
  },
  {
    id: "retention",
    question: "How long is it kept?",
    answer: [
      "While your account is open.",
      "If you delete it, we remove your documents, answers and notes within 30 days.",
      "We keep only the purchase records the tax law requires, for as long as it requires.",
      "An encrypted backup copy may hold your data for up to 90 days after that.",
    ],
    section: "How long we keep it",
    sources: [
      "Your data stays while your account is open.",
      "If you delete your account, we remove your documents, answers and notes within 30 days, and keep only the purchase records the tax law requires us to keep, for the period it requires.",
      "An encrypted backup copy may still hold your data for up to 90 days after that, then it is deleted.",
    ],
  },
  {
    id: "export",
    question: "Can I take my data out?",
    answer: [
      "Yes, from your account page, at any time.",
      "The file holds your account, answers, checklist, registers with the worker tables, and audit log.",
    ],
    section: "Your choices",
    sources: [
      "Export: you can download everything we hold about you from your account page at any time: your account, your answers, your checklist, your registers (including the worker tables) and your audit log.",
    ],
  },
  {
    id: "who-signs-in",
    question: "Who can sign in?",
    answer: [
      "You, the workers you invite, and an auditor through a time-limited link you share.",
      "Each account sees its own data only, enforced in the database.",
    ],
    section: "Security",
    sources: [
      "Each account can only see its own data, enforced in the database.",
      "the hashed email address of a worker you invite",
      "Your worker code and your check and application numbers go to your manager's auditor through a time-limited link",
    ],
  },
  {
    id: "breach",
    question: "What happens if there is a breach?",
    // D-2950: the policy's sentence as it stands, nothing added about timeframes.
    answer: [
      "If a breach happens that is likely to cause serious harm, we tell you, and the Office of the Australian Information Commissioner where the law requires it.",
    ],
    section: "Security",
    sources: [
      "If a breach happens that is likely to cause serious harm, we tell you, and the Office of the Australian Information Commissioner where the law requires it.",
    ],
  },
];

/** FR-7 (D-2949): the words the page never carries. */
export const TRUST_BANNED_WORDS: readonly RegExp[] = [
  /\bsecure\b/i,
  /\bsafe\b/i,
  /\bbank-level\b/i,
  /\bguaranteed?\b/i,
  /\bcompliant\b/i,
  /\bcertified\b/i,
];

/** The places and numbers an answer names, each of which must appear in its sources (D-2945). */
export function pinnedFacts(sentences: readonly string[]): string[] {
  const answer = sentences.join(" ");
  const facts = new Set<string>();
  for (const m of answer.matchAll(/\b\d+ (?:days|months|years)\b/g))
    facts.add(m[0]);
  for (const place of ["Sydney", "Australia", "United States"])
    if (answer.includes(place)) facts.add(place);
  return [...facts];
}

/** The page's sentences, for FR-7's length rule. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

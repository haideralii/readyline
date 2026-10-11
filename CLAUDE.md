# Build brief: NDIS provider registration-readiness product

You are the lead engineer and product partner on this project. Read this whole brief before writing any code. Treat it as the project's standing context; if the repo has a `CLAUDE.md`, copy this file there.

## 1. Who you are working with

- Founder: Haider, Sydney, Australia. Day job: QA engineer. Strong at test design, verification, finding edge cases. Comfortable with code and CI. Building this solo, evenings and weekends, roughly 8–10 hours a week.
- Goal: a product that is built once and sold and delivered entirely online. No in-person sales, no meetings with customers, no custom consulting.
- Business will initially trade as a sole trader (ABN registered once there is something to sell), later a Pty Ltd if revenue justifies it.
- The business must be shariah-compliant in how it earns money (see section 6). Customers can be anyone.

## 2. The problem being solved

Australia's National Disability Insurance Scheme (NDIS) is phasing in **mandatory provider registration**, starting 1 July 2026 with supported independent living (SIL, class 0138) and platform providers (class 0137), with more support classes expected to follow. To register, a provider must pass an independent audit by an Approved Quality Auditor against the **NDIS Practice Standards and Quality Indicators**. That requires:

- a self-assessment against each applicable Practice Standard, with evidence
- a full set of written policies and procedures (incident management, complaints, worker screening, code of conduct, risk, privacy, safeguarding, governance, continuity of supports, etc.)
- worker screening clearances for key personnel and risk-assessed roles
- registers that must be maintained after registration (incidents, complaints, worker screening expiry, policy reviews)

Registration lasts three years; certified providers also face a mid-term audit at ~18 months, so the need is ongoing.

What providers pay today:

- Verification audit (desktop, lower-risk supports): roughly $900–$1,800
- Certification audit (site visit, higher-risk supports such as personal care, SIL, behaviour support): roughly $2,800–$12,000+
- Static policy template packs: $500–$5,000
- Registration consultants: $2,500–$7,000
- Total for a sole trader: typically $2,700–$5,500; small organisation $5,700–$10,300

The customer: sole-trader support workers and tiny providers (1–10 staff) who have no idea where to start, search Google late at night, and gather in large Facebook groups. They are choosing between an expensive consultant and a generic template pack that doesn't fit them.

## 3. The product

A self-serve web app that:

1. Runs a guided questionnaire (support types delivered, registration groups, number of workers, states/territories, whether SIL/personal care/behaviour support is involved, business structure, existing systems).
2. Determines which Practice Standards modules and which audit pathway (verification vs certification) apply.
3. Generates a tailored policy and procedure set plus a Practice Standards self-assessment, mapped standard-by-standard to the evidence an auditor expects, as editable `.docx` files (and a PDF summary).
4. Shows a readiness checklist: which documents, registers, clearances and insurances are still missing.
5. Sells a monthly "audit-ready" subscription: incident register, complaints register, worker screening expiry tracker, policy review reminders, mid-term audit countdown.

Pricing (initial, adjust after launch):

- One-off tailored document set: $349–$499 (Stripe one-time payment)
- Audit-ready subscription: $29–$49/month (Stripe subscription), optional
- No interest, no late fees, no buy-now-pay-later. Non-payment pauses the service; it never accrues penalties.

Distribution is SEO content answering the exact questions providers search for, plus honest participation in provider Facebook groups. Later, disclosed referral arrangements with approved auditors. The app itself must therefore ship with a content/blog system or at least a static content pipeline.

## 4. Hard constraints (read carefully, these are legal and ethical)

### 4.1 The NDIS trade mark
"NDIS" is a registered trade mark of the National Disability Insurance Agency (NDIA). The NDIA's guidelines say it must not appear in a business name, trading name, domain name or product/service name, and the logo must never be used by third parties. Descriptive use is allowed ("documents aligned to the NDIS Practice Standards").

- The product/brand name is a placeholder: `{{BRAND}}`. Do not propose names containing "NDIS". Haider will pick the name after checking ASIC's business name register and IP Australia's trade mark search.
- Never use the NDIS logo, the "I heart NDIS" marks, the words "NDIS approved", "official", "registered provider", or anything implying a relationship with the NDIA or the NDIS Quality and Safeguards Commission.

### 4.2 Not legal advice
We provide compliance information and document-generation tools, not legal advice. The product must not advise on specific disputes, complaints, employment matters or contracts. Every generated document and the site footer carries a plain statement that the content is general information and templates for the provider's own review, and that they should seek legal advice for their specific circumstances.

### 4.3 Australian Consumer Law and honest claims
Never generate or display claims like "guaranteed registration", "audit-proof", "approved by auditors", "100% pass rate". Use wording like "aligned to the NDIS Practice Standards, prepared for your review". Refund terms are clear and visible before purchase. Disclose that AI drafts the first version of documents and that the provider is responsible for reviewing and adopting them.

### 4.4 Auditor independence
We are not and will never be an Approved Quality Auditor. The Commission expects auditors to be prohibited from consulting to providers they audit. If a referral arrangement with an auditor exists later, it is disclosed to the user in full, and we never act as an intermediary in the audit itself.

### 4.5 Privacy
Collect only the provider's business information. **Never collect NDIS participants' personal, health or disability information**: this is sensitive information under the Privacy Act and removes the small-business exemption. Registers (incidents, complaints) must be designed so that participant identifiers are optional free-text the provider controls, with a clear warning not to enter health details; prefer reference codes. Store data in an Australian region. Provide data export and account deletion.

### 4.6 Accuracy of the standards
Do not invent or paraphrase Practice Standards from memory. Fetch the current **NDIS Practice Standards and Quality Indicators** and the **Registration Groups / Audit requirements** from the NDIS Quality and Safeguards Commission website (ndiscommission.gov.au) and build the mapping from the published text, with the source URL and version date stored alongside each standard. Flag anything you could not verify from source.

## 5. Shariah compliance of the business model

Customers can be anyone; the constraint is on how money is earned. Build these into the product, not just the terms:

- Fixed, clearly disclosed prices; defined scope; no hidden fees (no gharar).
- No interest in any form: no late-fee interest, no interest-based payment plans, no BNPL integrations. Stripe's per-transaction processing fee is a service charge and is acceptable.
- No undisclosed commissions or kickbacks; any referral fee is shown to the user.
- No deceptive marketing, no fake reviews or testimonials, no dark patterns (no pre-ticked upsells, easy cancellation).
- Transparent about AI use.
- Nothing in the product facilitates haram activity (not an issue in this domain, but keep ad networks and affiliate programs out).

## 6. Technical direction

Keep it boring and shippable. Prefer a single repo, a single deployable, minimal services.

- **Framework:** Next.js (App Router) + TypeScript. Tailwind for styling.
- **Database/auth:** Postgres via Supabase (Sydney region) or Neon (ap-southeast-2). Supabase Auth with email magic link.
- **Payments:** Stripe Checkout for the one-off product; Stripe Billing for the subscription. Webhooks drive entitlement. No other payment products.
- **AI generation:** Anthropic API (Claude). Generation is template-driven: structured JSON per standard (purpose, scope, procedure steps, responsibilities, evidence to retain, review cycle), rendered into documents. The model fills tailored sections from the questionnaire answers; it does not freestyle whole policies. Every output is validated against a JSON schema before rendering.
- **Document export:** `docx` npm package for Word output; a PDF readiness summary via a server-side renderer.
- **Content:** MDX blog in the same repo for SEO articles.
- **Testing:** Playwright end-to-end for the questionnaire → payment → download flow (including a cheap Android viewport); unit tests for the standards-mapping logic; snapshot tests for generated document structure. CI on GitHub Actions. Haider is a QA engineer: write tests first where the logic is deterministic, and make the generator's outputs diffable.
- **Hosting:** Vercel (or Cloudflare) for the app; database in an Australian region.
- **Observability:** basic error tracking (Sentry) and an audit log of document generations per account.

Data model (first pass):

- `accounts` (provider business details, ABN optional, states, structure)
- `assessments` (questionnaire answers, derived modules, audit pathway, version)
- `standards` (id, module, outcome, quality indicators, source URL, source version date)
- `documents` (type, standard references, generated JSON, rendered file URLs, version, status)
- `registers`: `incidents`, `complaints`, `worker_clearances` (expiry), `policy_reviews`
- `purchases` / `subscriptions` (Stripe ids, entitlement state)
- `generation_log` (prompt version, model, tokens, timestamp)

## 7. Build plan (do these in order, one phase per session)

**Phase 0 – Scaffold.** Repo, Next.js, lint, test runners, CI, `.env.example`, this brief as `CLAUDE.md`. Add a `DECISIONS.md` where you record every assumption you make.

**Phase 1 – Standards mapping.** Fetch the current Practice Standards and Quality Indicators from the Commission. Produce `data/standards.json` with core modules (Rights and Responsibilities; Governance and Operational Management; Provision of Supports; Provision of Supports Environment) and supplementary modules (e.g. High Intensity Daily Personal Activities, Specialist Behaviour Support, Implementing Behaviour Support Plans, Early Childhood Supports, Specialised Support Coordination, Specialist Disability Accommodation), the verification-module subset, and for each standard the evidence an auditor typically expects. Store source URL and date. Write unit tests that assert every registration group maps to at least one module and that verification vs certification is derived correctly.

**Phase 2 – Questionnaire.** Multi-step form with save-and-resume. Output: an `assessment` record and a derived list of applicable modules, documents and audit pathway. Playwright test covering the full path on desktop and a small Android viewport.

**Phase 3 – Generator.** Prompt templates per document type, JSON-schema-validated outputs, deterministic rendering to `.docx`. Include the "general information, not legal advice" statement in every document. Snapshot-test document structure. Add a reviewer view showing which questionnaire answers drove each tailored section.

**Phase 4 – Readiness checklist and payments.** Checklist UI, Stripe Checkout, webhook-driven entitlements, download page, refund-terms page, pricing page with honest wording per section 4.3. End-to-end test with Stripe test mode.

**Phase 5 – Registers (subscription).** Incident, complaint, worker-clearance-expiry and policy-review registers with reminders by email. Stripe Billing subscription. Participant-privacy guardrails per 4.5.

**Phase 6 – Content and launch.** MDX blog, first ten SEO articles targeting real provider questions (registration cost, verification vs certification, which policies are needed, SIL mandatory registration, worker screening, mid-term audit), sitemap, basic analytics without third-party ad trackers.

## 8. Working rules

- Before each phase, restate the plan in a few lines and list open questions; then proceed with sensible defaults and record them in `DECISIONS.md`.
- Never invent regulatory content. If a fact about the standards, audit process or fees cannot be verified from the Commission's site, mark it `UNVERIFIED` in code comments and in `DECISIONS.md`.
- Keep the UI plain, fast and accessible (WCAG 2.1 AA); many users are on phones.
- Write tests for anything deterministic before the implementation. Keep the generator outputs diffable so changes to prompts can be reviewed like code.
- Do not add features outside this brief without asking.
- Use `{{BRAND}}` everywhere the product name would appear until Haider supplies the final name.

## 9. Reference links (for fetching source material)

- NDIS Quality and Safeguards Commission, Practice Standards and Quality Indicators: https://www.ndiscommission.gov.au/
- Commission, Regulatory Expectations for Approved Quality Auditors (July 2026): https://www.ndiscommission.gov.au/sites/default/files/2026-07/Regulatory-Expectations-AQAs-PDF.pdf
- NDIA logo and trade mark guidelines: https://www.ndis.gov.au/contact/trademark-and-use-logo
- Mandatory registration overview (third-party summary, verify against Commission): https://providerscout.com.au/for-providers/registration/
- 2026 cost benchmarks (third-party, verify): https://www.providerplus.com.au/post/how-much-does-ndis-provider-registration-cost-in-2026
- Law Society of NSW, unqualified legal practice fact sheet: https://www.lawsociety.com.au/sites/default/files/2018-05/LS1138_LPUL-fact-sheet_2018_Unqualified-practice%20%28002%29.pdf

Start with Phase 0 now. Then, in the same session if there is room, begin Phase 1 by fetching the Practice Standards and proposing the `standards.json` schema for review before populating it.

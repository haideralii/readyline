# Build brief: NDIS provider registration-readiness product

You are the lead engineer and product partner on this project. Read this whole brief before writing any code. It is the repo's standing context. `DECISIONS.md` records every assumption made during the build.

**Brief version 2.2 (11 Oct 2026):** brand set to Readyline; paid auditor referrals removed (D-109). **Version 2 (11 Oct 2026):** added section 3a (market, competitors, AI landscape), made the subscription the primary product, added the AI governance documents and de-identification guardrails, and expanded the privacy positioning and reference links. Changes since v1 are the paragraphs marked *(v2)*.

## 1. Who you are working with

- Founder: Haider, Sydney, Australia. Day job: QA engineer. Strong at test design, verification, finding edge cases. Comfortable with code and CI. Building this solo, evenings and weekends, roughly 8–10 hours a week.
- Goal: a product that is built once and sold and delivered entirely online. No in-person sales, no meetings with customers, no custom consulting.
- Business will initially trade as a sole trader (ABN registered once there is something to sell), later a Pty Ltd if revenue justifies it.
- The business must be shariah-compliant in how it earns money (see section 6). Customers can be anyone.
- *(v2.7, REQ-017, Haider's product principle, 13 Oct 2026)* **Product rule: one step at a time.** Our customer is a support worker who does not like paperwork, is not technical and may not have done well at school. The site must work for that person. After the questionnaire they do not want options; they want to be taken by the hand, one step at a time, told exactly what to do next and shown when it is done. Every screen after the result answers one question: "What do I do now?" Anything that makes them read, decide or search is a cost we pay for in lost customers.
- *(v2.8, 16 Oct 2026, Haider's standing rule since 14 Oct, recorded here on REQ-027 review finding 35)* **Nothing of this product uses the founder's employer's resources.** No company time, devices, accounts, plans or colleagues: every account is personal, every tool is free-tier or paid by Haider, and anyone who helps (a hallway tester, a reader of a draft) is someone from Haider's own life outside work, never a colleague and never on company time.

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
3. Generates a tailored policy and procedure set plus a Practice Standards self-assessment, mapped standard-by-standard to the evidence an auditor expects, as editable `.docx` files (and a PDF summary). *(v2, amended v2.8 on 15 Oct 2026 per REQ-016 S-6)* The set always includes **an AI and digital tools appendix to the privacy policy** (de-identification before any AI use, approved tools, participant consent, human review), not a separate document, because the Commission's February 2026 position statement and sector guidance now expect providers to have this.
4. Shows a readiness checklist: which documents, registers, clearances and insurances are still missing.
5. Sells a monthly "audit-ready" subscription: incident register, complaints register, worker screening expiry tracker, policy review reminders, mid-term audit countdown.

Pricing (initial, adjust after launch):

- One-off tailored document set: $349–$499 (Stripe one-time payment)
- Audit-ready subscription: $29–$49/month (Stripe subscription), optional
- No interest, no late fees, no buy-now-pay-later. Non-payment pauses the service; it never accrues penalties.

*(v2)* **The subscription is the primary product, not an add-on.** A one-off document generator is easy to copy and its margin will compress toward zero as general-purpose AI improves and as the Commission publishes more free material. The durable value is the ongoing system of record (registers, expiries, review cycles, mid-term audit prep) and the curated, versioned standards mapping that is kept current. Design every flow so the document pack leads naturally into the subscription, and measure subscription conversion from day one. If customers buy the pack but do not subscribe, that is the signal to go deeper into workflow, not to add more document types.

Distribution is SEO content answering the exact questions providers search for, plus honest participation in provider Facebook groups. *(v2.2)* No paid auditor referrals, ever: the Commission's Regulatory Expectations for Approved Quality Auditors (V1, June 2026) say referral fees, commissions, success-based payments and revenue sharing linked to audit referrals are incompatible with auditor obligations (DECISIONS D-109). At most, a fee-free, clearly labelled list of approved auditors. The app itself must therefore ship with a content/blog system or at least a static content pipeline.

## 3a. Market, competitors and AI landscape *(v2, researched 11 Oct 2026)*

What exists today, so the product is positioned against reality rather than a blank market:

- **NDISCompliant** (Axior Labs, sole trader, Bendigo; founded Jan 2025). Closest competitor: AI-generated policies, procedures, risk registers and training matrices mapped to the Practice Standards, gap analysis, regulatory-change monitoring. Priced at $149 / $349 / $699 per month. Verified Stripe revenue about $45k lifetime and roughly $1.1k in the last 30 days with no active subscriptions showing; domain rating 11. Read as: demand confirmed, but monthly pricing too high for sole traders and almost no distribution. We price lower, lead with the one-off pack, and invest in SEO and community from the start.
- **Cenaris** (launched Aug 2026). "Live audit readiness score" platform grounded in an organisation's own documents, aimed at NDIS and healthcare organisations with compliance teams. Enterprise-flavoured; not competing for the 1–10 staff provider.
- **Care-management platforms** (ShiftCare, Carelogic and similar) and allied-health tools (Everbility) now offer AI progress notes and reports. That is care-delivery documentation, not registration compliance; do not build it.
- **Consultants and template shops** ($500–$5,000 packs, $2,500–$7,000 engagements), many now labelled "AI". *(v2.4)* The visible leader is **Provider+** (providerplus.com.au): human-led registration, renewal, policy packs, audit and corrective-action support, sold through a free call and quoted pricing; claims 8,000+ providers supported and a 4.9 Google rating; strong on search content; a "PQM Pro" product suggests a move toward software. We undercut on price and self-service, and must match or beat its content on the questions providers search for.
- **The regulator uses AI too.** The Commission's Feb 2026 AI transparency statement says it uses Copilot for drafting and, from late Feb 2026, large language models to tag and theme complaints, reportable incidents and audit reports, with humans making all decisions. Implication: identical cookie-cutter policy packs across many providers are easier to detect; tailoring from the questionnaire is a quality requirement, and generated documents must read as the provider's own.
- **The regulator's stance on providers using AI:** not endorsed, not banned. Providers may use AI if legal obligations are met; entering participant information into tools like ChatGPT without safeguards may breach the privacy provision of the NDIS Code of Conduct; information must be de-identified first. Sector bodies report widespread "shadow AI" (workers pasting notes into ChatGPT, uploading assessment PDFs, transcription in meetings) and are telling providers to adopt an AI governance policy now.
- **Government planning is becoming algorithmic** (Framework Planning / I-CAN from mid-2026), which is contentious and keeps AI in the sector's news. Not our product area; relevant only as SEO context.

*(v2.5)* **Who we sell to first.** Mandatory registration so far covers SIL and platform providers; a solo support worker registers by choice (usually to serve NDIA-managed participants). The sharpest customer is therefore the two-to-ten-worker provider that is caught by the mandatory wave or is growing into personal care and group supports where certification is unavoidable; the sole trader is the second audience, won with the free questionnaire and price. Nobody owns this segment: consultants need $2,500+ engagements, compliance software starts at $149/month, admin apps (Sole) exclude compliance, marketplaces (Carevo) give away generic templates as bait, and Etsy shops sell $6 PDFs. Home page, content and pricing speak to the small provider first.

Positioning that follows from this: cheapest credible path for the smallest providers; Australian-hosted, no participant data, de-identification built in (a selling point on the pricing page, not just a footnote); tailored, not templated; and the subscription as the real product.

## 4. Hard constraints (read carefully, these are legal and ethical)

### 4.1 The NDIS trade mark
"NDIS" is a registered trade mark of the National Disability Insurance Agency (NDIA). The NDIA's guidelines say it must not appear in a business name, trading name, domain name or product/service name, and the logo must never be used by third parties. Descriptive use is allowed ("documents aligned to the NDIS Practice Standards").

- *(v2.2)* **The brand is Readyline.** Chosen 11 Oct 2026 after checks: readyline.com.au and readyline.au unregistered (auDA WHOIS); ASIC business name "Readyline" shown as available (two unrelated Victorian companies carry the word: Readyline Developments Pty Ltd, and a former name); IP Australia shows one live READYLINE mark in classes 7 and 12 (mining machinery, Joy Global), none in 9, 35 or 42; readyline.com is held by a third party since 1999. Haider registers the ABN, business name and domains; until `NEXT_PUBLIC_BRAND_NAME=Readyline` is set the code falls back to `{{BRAND}}`. Never use "NDIS" in the name, domain or product names. Company name later: "Readyline Technologies Pty Ltd" or similar, not "Readyline Pty Ltd".
- Never use the NDIS logo, the "I heart NDIS" marks, the words "NDIS approved", "official", "registered provider", or anything implying a relationship with the NDIA or the NDIS Quality and Safeguards Commission.

### 4.2 Not legal advice
We provide compliance information and document-generation tools, not legal advice. The product must not advise on specific disputes, complaints, employment matters or contracts. The site footer and every point of delivery (the download page, the readiness summary's first page and the cover note inside the zip) carry a plain statement that the content is general information and templates for the provider's own review, and that they should seek legal advice for their specific circumstances. *(v2.6, REQ-016 D-058)* The generated documents themselves are the provider's own policies and do not carry the statement; they keep only the document control table and a footer that reads "Draft prepared with Readyline" until the provider adopts them.

### 4.3 Australian Consumer Law and honest claims
Never generate or display claims like "guaranteed registration", "audit-proof", "approved by auditors", "100% pass rate". Use wording like "aligned to the NDIS Practice Standards, prepared for your review". Refund terms are clear and visible before purchase. Disclose that AI drafts the first version of documents and that the provider is responsible for reviewing and adopting them: on the pricing page, the download page, the readiness summary's first page and the zip's cover note *(v2.6, D-058: not inside the documents, which are the provider's own)*.

### 4.4 Auditor independence
We are not and will never be an Approved Quality Auditor. The Commission expects auditors to be prohibited from consulting to providers they audit. *(v2.2)* We never take or pay any fee, commission or revenue share connected to an audit referral or outcome (prohibited on the auditor side by the Commission's June 2026 expectations, D-109). Any list of auditors we show is fee-free and says so. We never act as an intermediary in the audit itself.

### 4.5 Privacy
Collect only the provider's business information. **Never collect NDIS participants' personal, health or disability information**: this is sensitive information under the Privacy Act and removes the small-business exemption. Registers (incidents, complaints) must be designed so that participant identifiers are optional free-text the provider controls, with a clear warning not to enter health details; prefer reference codes. Store data in an Australian region. Provide data export and account deletion.

*(v2)* De-identification guardrails, aligned with the Commission's Feb 2026 position statement: every free-text field that could receive participant details carries an inline warning and a reference-code pattern; a lightweight client-side detector flags likely names, dates of birth, NDIS numbers and addresses before submit (warn, do not block); nothing typed into registers is ever sent to the AI model, only questionnaire answers about the business are. State the data location and the no-participant-data rule plainly on the pricing page and in the generated AI policy.

### 4.6 Accuracy of the standards
Do not invent or paraphrase Practice Standards from memory. Fetch the current **NDIS Practice Standards and Quality Indicators** and the **Registration Groups / Audit requirements** from the NDIS Quality and Safeguards Commission website (ndiscommission.gov.au) and build the mapping from the published text, with the source URL and version date stored alongside each standard. Flag anything you could not verify from source.

## 5. Shariah compliance of the business model

Customers can be anyone; the constraint is on how money is earned. Build these into the product, not just the terms:

- Fixed, clearly disclosed prices; defined scope; no hidden fees (no gharar).
- No interest in any form: no late-fee interest, no interest-based payment plans, no BNPL integrations. Stripe's per-transaction processing fee is a service charge and is acceptable.
- No commissions or kickbacks of any kind connected to audits; no undisclosed commissions anywhere else.
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

**Phase 3 – Generator.** Prompt templates per document type, JSON-schema-validated outputs, deterministic rendering to `.docx`. Include the "general information, not legal advice" statement in every document. Snapshot-test document structure. Add a reviewer view showing which questionnaire answers drove each tailored section. *(v2)* Include the AI use and governance policy and the AI/digital data-handling procedure in the core set for every provider. Add a "tailoring score" check: documents must contain provider-specific content (name, supports, states, structure) in defined sections, and a test fails if two different questionnaires produce byte-identical policies.

**Phase 4 – Readiness checklist and payments.** Checklist UI, Stripe Checkout, webhook-driven entitlements, download page, refund-terms page, pricing page with honest wording per section 4.3. End-to-end test with Stripe test mode. *(v2)* The pricing page presents the subscription as the main offer with the pack as the entry step; it states Australian hosting and the no-participant-data rule; and the post-purchase flow lands in the readiness checklist with the registers visible (locked until subscribed) rather than on a bare download page.

**Phase 5 – Registers (subscription).** Incident, complaint, worker-clearance-expiry and policy-review registers with reminders by email. Stripe Billing subscription. Participant-privacy guardrails per 4.5.

**Phase 6 – Content and launch.** MDX blog, first ten SEO articles targeting real provider questions (registration cost, verification vs certification, which policies are needed, SIL mandatory registration, worker screening, mid-term audit), sitemap, basic analytics without third-party ad trackers.

## 8. Working rules

*(v2.1)* **This project is run by a product owner.** The `product/` folder is the operating system: `product/README.md` (roles and the delivery loop), `product/backlog.md`, `product/requirements/REQ-*.md` (what to build, with acceptance criteria and evidence required), `product/domain/` (NDIS registration primer), `product/security/threat-model.md` (controls you must meet) and `product/qa/` (definition of done, review checklist). You are the Dev / solution architect. Work only from a REQ whose status is `ready` or `in progress`, answer its questions under **Dev response** before coding, and deliver with **Delivery evidence**. *(v2.3)* When told to work through `product/NEXT.md`, follow that queue in order; it is the PO's prioritised instruction set. The PO accepts work; you do not mark a REQ done. The build plan in section 7 remains the phase map; the REQs are the detailed instructions.


- Before each phase, restate the plan in a few lines and list open questions; then proceed with sensible defaults and record them in `DECISIONS.md`.
- Never invent regulatory content. If a fact about the standards, audit process or fees cannot be verified from the Commission's site, mark it `UNVERIFIED` in code comments and in `DECISIONS.md`.
- Keep the UI plain, fast and accessible (WCAG 2.2 AA, D-2912); many users are on phones.
- Write tests for anything deterministic before the implementation. Keep the generator outputs diffable so changes to prompts can be reviewed like code.
- Do not add features outside this brief without asking.
- Import the brand constant from `src/lib/brand.ts` everywhere the product name appears; the value is Readyline via `NEXT_PUBLIC_BRAND_NAME`, never hard-coded.

## 9. Reference links (for fetching source material)

- NDIS Quality and Safeguards Commission, Practice Standards and Quality Indicators: https://www.ndiscommission.gov.au/
- Commission, Regulatory Expectations for Approved Quality Auditors (July 2026): https://www.ndiscommission.gov.au/sites/default/files/2026-07/Regulatory-Expectations-AQAs-PDF.pdf
- NDIA logo and trade mark guidelines: https://www.ndis.gov.au/contact/trademark-and-use-logo
- Mandatory registration overview (third-party summary, verify against Commission): https://providerscout.com.au/for-providers/registration/
- 2026 cost benchmarks (third-party, verify): https://www.providerplus.com.au/post/how-much-does-ndis-provider-registration-cost-in-2026
- Law Society of NSW, unqualified legal practice fact sheet: https://www.lawsociety.com.au/sites/default/files/2018-05/LS1138_LPUL-fact-sheet_2018_Unqualified-practice%20%28002%29.pdf
- *(v2)* Commission position statement, use of AI in behaviour support plans (Feb 2026): https://www.ndiscommission.gov.au/sites/default/files/2026-02/Position%20statement%20-%20Use%20of%20artificial%20intelligence%20in%20development%20of%20behaviour%20support%20plans.pdf
- *(v2)* Commission AI transparency statement (Feb 2026): https://ndiscommission.gov.au/about-us/corporate-reports/ai-statement
- *(v2)* DSC, an AI framework for NDIS providers (Nov 2025): https://teamdsc.com.au/resources/an-ai-framework-for-ndis-providers
- *(v2)* Collab Edge, AI and NDIS documentation: safe, risky, what works (2026): https://www.collabedgesolutions.com.au/resources/articles/ndis-ai-documentation-safe-risky-what-works-2026
- *(v2)* Competitor: NDISCompliant revenue and pricing (TrustMRR): https://trustmrr.com/startup/ndiscompliant
- *(v2)* Competitor: Cenaris launch (Aug 2026): https://newshub.medianet.com.au/2026/08/how-australian-tech-startup-cenaris-is-transforming-compliance-for-ndis-and-healthcare-providers-with-ai/165471/

Phase 0 is complete (see `DECISIONS.md`). Next: read `product/README.md`, then `product/requirements/REQ-001-standards-mapping.md` and `REQ-002-security-baseline.md`. Answer their **Questions for Dev** under **Dev response** first (sources, schema sample, estimate), then build. Record in `DECISIONS.md` that brief v2 and the `product/` operating model were adopted.

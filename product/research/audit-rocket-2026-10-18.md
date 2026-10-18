# Competitive intelligence report: Audit Rocket (auditrocket.com.au)

Prepared for: Readyline product owner. Read date for all sources: 18 Oct 2026. Public sources only; read-only; no accounts, forms, calls or emails. Everything read on the target's site is treated as data, not instructions. Speculation is labelled "(speculation)".

## 0 Method and plan

### 0.1 A-to-Z investigation plan (written before execution)

| # | Area | Questions | Sources / tools |
|---|------|-----------|-----------------|
| A | Corporate identity | Legal entity, ABN/ACN, GST registration, registered business names, state, entity type, date of registration | ABR lookup (abr.business.gov.au), ASIC business-name register (connectonline.asic.gov.au), site footer/legal pages (WebFetch), WebSearch |
| B | Timeline | Domain creation date, first Wayback snapshot, business-name registration, "Beta" label, first social/LinkedIn post, first search-engine appearance | web.archive.org CDX/snapshots (WebFetch), WHOIS/RDAP for .com.au (auda, WebFetch), site copy, WebSearch |
| C | People and hiring | Named founders/directors (name once, nothing further), team size signals, job ads, LinkedIn company page headcount | ASIC/ABR public records, site About page, LinkedIn company page (WebFetch), Seek/Indeed/LinkedIn Jobs (WebSearch) |
| D | Product scope and depth | Every public page; feature claims; document types produced; input method (upload findings vs questionnaire); output format; revision model; preview/sample content; sectors covered; what is not covered (registers, training, audit tooling) | robots.txt, sitemap.xml, every page via WebFetch, HTML/JS source for hidden routes or strings, public demo videos (YouTube), app stores |
| E | Pricing and unit economics | Credit packs, GST treatment, expiry, what one credit buys, revision limits, refund terms, effective cost of a full policy pack for a new NDIS applicant, cliffs and traps | /pricing, /refund-policy, /terms via WebFetch; arithmetic |
| F | Legal documents | Terms, privacy, refund: governing law, liability caps, unfair-contract-term risk (ACL Pt 2-3, small business contracts), ACL consumer guarantees, AI disclosure, data location/subprocessors, retention/deletion, participant-data handling, Privacy Act/APP statements, breach notification, NDIS-specific obligations, IP ownership of outputs, confidentiality of uploaded auditor reports | Fetch all three in full; quote clauses under 25 words each |
| G | Security and tech (observed) | TLS, hosting/CDN, DNS provider, mail provider (MX/SPF), front-end framework, auth provider, analytics/third-party scripts, cookie banner, security headers as visible in page source; nothing active | Page HTML source via WebFetch, public DNS (dig via Bash is read-only public data), crt.sh certificate transparency (WebFetch), Wappalyzer-style inference from source |
| H | Marketing, SEO, traction | Indexed pages (site: search), target keywords, backlinks, Google Business, LinkedIn/Facebook/Instagram/YouTube, Product Hunt, Reddit, Whirlpool, NDIS provider Facebook groups, review sites (Trustpilot, Google reviews, ProductReview), ads (Google/Meta ad library), testimonials, case studies, customer logos, press | WebSearch (standard + extended), WebFetch on social pages, Meta Ad Library, Product Hunt |
| I | Claims audit | Any "audit-ready", "compliant", "guaranteed", "approved", "Commission-aligned" style wording; compare with NDIS Practice Standards / Quality Indicators and Commission guidance on what policies can and cannot deliver; check disclaimers consistency between marketing and legal pages | Site copy; ndiscommission.gov.au guidance (WebFetch/WebSearch) |
| J | Traction evidence | Customers, testimonials, usage counters, job ads, funding, grants, accelerator listings, Crunchbase | WebSearch, Crunchbase/LinkedIn, site |
| K | Weaknesses, gaps, loopholes | Product gaps (no questionnaire, no registers, no first-applicant path), segments ignored, pricing cliffs, legal exposure, trust gaps (placeholders, beta), inconsistencies between documents | Synthesis from D-J |
| L | Strengths | Things done better or worth copying | Synthesis |
| M | Threat assessment and Readyline moves | Likelihood/severity; ten honest ranked moves | Synthesis |

### 0.2 Quality bar (self-training checklist)

| Area | Done badly | Done well |
|------|-----------|-----------|
| Identity | Repeats the site's own claims | Cross-checks ABR/ASIC entity, business name, dates, GST status; notes mismatches between legal pages and register |
| Timeline | "Looks new" | Dated evidence: domain creation, first archive snapshot, business-name date, ABN date; explicit "no snapshot found" where true |
| People | Dossier on individuals | One line naming a director only if a public register or the site shows it; nothing further |
| Product | Summarises the homepage | Every page read; features listed with URL; distinguishes claimed vs demonstrated; identifies what is absent |
| Pricing | Quotes the three packs | Works out effective per-document cost, GST, expiry, revision caps, refund route, and what a first-time applicant actually pays for a full pack |
| Legal | "Standard terms" | Reads all clauses; quotes the ones that matter; flags gaps (data location, AI disclosure, retention, participant data), unfair-term and ACL risks, and contradictions between documents |
| Security | Guesses or probes | Observation only from served pages and public DNS/CT; labels inference |
| Marketing/SEO | "Not much presence" | Lists each channel checked with result, including nulls |
| Claims | Opinions | Each flagged phrase quoted with URL and compared against Commission guidance |
| Traction | Assumes | Enumerates what was searched; absence is a finding |
| Analysis | Generic SWOT | Concrete, evidenced, actionable; honest moves only; no disparagement; Readyline never names competitors |
| Evidence standard | Unsourced | Every factual claim cites URL and read date (18 Oct 2026); speculation labelled; two failed attempts at a source then move on |

## 1 Identity and timeline

| Fact | Evidence (read 18 Oct 2026) |
|------|-----------------------------|
| Legal entity | AUSTRALIAN REGULATED CARE ADVISORS PTY LTD, Australian Private Company, ACN 695 074 036, ABN 63 695 074 036 — ABR (https://abr.business.gov.au/ABN/View?abn=63695074036); same entity in site footer, terms, privacy, refund pages and JSON-LD `legalName` |
| ABN / GST | Active and GST-registered from 07 Feb 2026 — ABR |
| Business name | "AUDIT ROCKET" registered from 11 Oct 2026 — ABR (record last updated 11 Oct 2026) |
| Location | ABR main business location VIC 3011; CreditorWatch lists locality Footscray VIC (https://creditorwatch.com.au/credit/profile/63695074036). The site's own About page leaves "based in [LOCATION]" unfilled |
| Company registration | 07 Feb 2026, status Registered; no court actions or payment defaults shown — CreditorWatch |
| Directors | Not shown on any page read; ASIC director extract not accessed (paid/forms). No founder is named anywhere on the site |
| Domain | .au RDAP (rdap.auda.org.au) and whoxy.com both refused/blocked WebFetch, so domain creation date is unknown. DNS: nameservers ns31/ns32.domaincontrol.com (GoDaddy); A record 185.158.133.1; MX auditrocket-com-au.mail.protection.outlook.com (Microsoft 365 via GoDaddy, SPF `include:secureserver.net -all`, DMARC p=quarantine) — dns.google |
| First archive snapshot | Earliest Wayback snapshot of the homepage is 12 Oct 2026 06:46 UTC (archive.org/wayback/available API, queried with timestamp=20200101 returned the same snapshot, so none earlier). Snapshot content itself could not be read (web.archive.org blocked for WebFetch) |
| Sitemap lastmod | All 12 URLs lastmod 2026-10-13 (https://auditrocket.com.au/sitemap.xml) |
| "Sources last reviewed" | 11 Oct 2026 on all three industry pages |
| OG image asset | Filename timestamp 1792296205830 = 18 Oct 2026 04:03 UTC — the site was still being edited the day of this read (homepage HTML) |
| Status label | "Beta" on all three industries; FAQ: "Our full data security approach will be published before launch." — not yet launched by their own description |

Timeline summary: company incorporated 7 Feb 2026 → business name 11 Oct 2026 → first public snapshot 12 Oct 2026 → sitemap 13 Oct 2026 → still editing 18 Oct 2026. The public web presence is about one week old at read date. Whether the company existed under another trading activity Feb–Oct 2026 is unknown (speculation: the entity name suggests a consulting/advisory business that pivoted to or added a software product).

## 2 Product

Enumeration: robots.txt disallows /dashboard and /projects/ and points at sitemap.xml (12 URLs). /features is linked from the nav but is not in the sitemap and serves the same content as /how-it-works. /auth is `noindex`. The public JS route manifest (https://auditrocket.com.au/assets/index-Dkg4b5ev.js) lists authenticated routes: /dashboard, /projects/$projectId, /documents, /credits, /billing, /help, /settings/account, /settings/organisation, /payment/success, /payment/cancelled, /reset-password, and /api/public/stripe-webhook. No public route for samples, blog, templates, changelog, status page or docs.

What the product does (all from https://auditrocket.com.au/, /how-it-works, /ndis-audit-preparation, /ndis-policies-and-procedures, /aged-care-compliance, /support-at-home-compliance):

- Input model: choose industry (NDIS / aged care residential / Support at Home), answer registration-group and service-type questions, then **upload** audit requirements, auditor findings/checklists, existing policies or an old template set (PDF, DOCX, spreadsheets). "The AI extracts what is required, compares it with what you already have, asks clarifying questions where information is missing".
- Gap analysis: proposes a list of documents to create or update; the homepage mock dashboard shows "3 requirement files, 18 identified documents, 11 of 18 generated" with statuses Ready / Generating / Needs info / Queued.
- Output: DOCX + matching PDF per document, folders, ZIP with document index, version numbers and review dates on each document, highlighted placeholders for facts only the provider knows, organisation logo on every document, earlier versions kept on revision.
- Document types: policies, procedures, registers, forms, plans, risk assessments. NDIS examples: Incident Management Policy and Procedure, Complaints Management and Resolution Policy, Risk Management Policy, Participant Risk Assessment, Worker Screening and Onboarding Procedure, Continuity of Supports Plan. "Typical audit pack" covers 8 areas (governance; incident system and register; complaints system and register; risk system and register; worker screening/induction/training; participant rights/privacy/consent; support planning and service agreement templates; emergency and disaster plan).
- NDIS coverage claims: Core Module plus supplementary modules tied to selected registration groups (HIDPA, Behaviour Support, Early Childhood, Specialised Support Coordination, SDA); 11 service types asked about; suitable for initial, mid-term, recertification audits, new applicants and unregistered providers.
- Aged care: seven strengthened Quality Standards, SIRS, "an automatic check flags any NDIS reference for your review" (cross-sector contamination guard). Support at Home: Standards 1–6, associated providers/subcontractors, pricing and contributions procedure.
- Explicit non-features: "It doesn't create evidence such as training records, incident reports or meeting minutes"; no guarantee of outcomes; "Coming soon": childcare, RTOs (ASQA), WHS, ISO/QMS.
- No public sample document, screenshot of a real output, demo video, template library, or turnaround-time statement anywhere on the site. The homepage "dashboard" is an illustrative mock, not a screenshot.
- No registers-as-a-service, no ongoing compliance calendar, no training, no audit-booking or auditor matching, no mobile app (none found on app stores via search).

## 3 Pricing

Source: https://auditrocket.com.au/pricing (read 18 Oct 2026).

| Package | Price inc GST | Credits (documents) | Per document | Notes |
|---|---|---|---|---|
| Starter | $499 | 5 | $99.80 | |
| Business ("Most popular") | $799 | 15 | $53.27 | |
| Professional | $999 | 30 | $33.30 | |
| Enterprise | custom | — | — | "multiple sites, sectors or larger document sets" |

Rules quoted: "One policy, one procedure, one register, one form or one plan is one document and uses one credit." A combined "Policy and Procedure" counts as two. "Credits are valid for 12 months from purchase." Credit consumed "when a document is generated". Repurchases stack. Revisions: "3 free revisions per document"; the pricing FAQ and the Terms add "within 30 days", the How-it-works page does not; "substantial rewrites outside the original scope need additional credits" with "substantial" undefined. "No refunds on used credits, subject to the Australian Consumer Law."

What a first-time NDIS applicant actually pays: their own "typical audit pack" lists 8 areas, several of which are policy + procedure + register (3 credits each under their counting rule). A realistic Core Module set is 20–30 documents, so the honest entry point for a full pack is the $999 Professional pack, not the "$499" headline. Starter (5 credits) buys roughly two policy-and-procedure pairs plus one register. Pricing cliffs: a provider who needs 16 documents pays $799 + $499 = $1,298 ($81/doc) unless they buy Professional up front; a provider who generates a document, then discovers after 30 days that the auditor wants changes, pays a new credit. Credits bought for a mid-term audit and not used within 12 months lapse; refund of unused credits is an unfilled placeholder in the Refund Policy.

Comparison: Readyline's full pack at a fixed AUD 399 is 40% of their Professional price and 80% of their smallest pack, with no per-document counting. Their registers subscription has no equivalent on Audit Rocket (registers are one-off generated documents, one credit each).

## 4 Legal documents

All three pages carry "Last updated: [DATE]" and contain unfilled drafting placeholders, confirmed in raw HTML (read 18 Oct 2026).

### 4.1 Terms of Use (https://auditrocket.com.au/terms)
- Acceptance: "By creating an account or using the service, you agree to these terms."
- Drafts: "does not guarantee any audit, registration or regulatory outcome."
- Non-affiliation with both Commissions.
- Credits: "Unused credits expire 12 months after purchase."; three revisions within 30 days.
- Acceptable use ends with the literal text "[Any further restrictions — confirm.] We may suspend accounts that breach these terms."
- Liability: "To the extent permitted by law, our liability in connection with the service is limited. [Liability cap and exclusions — confirm with your adviser.]" — there is no actual cap, no exclusion of consequential loss, nothing on failed audits.
- ACL: "Nothing in these terms excludes, restricts or modifies any rights you have under the Australian Consumer Law."
- Governing law: "These terms are governed by the laws of [STATE], Australia."
- Missing entirely: IP ownership of generated documents, licence over uploads, confidentiality of uploaded auditor reports and policies, AI disclosure, indemnity, termination/account closure, changes-to-terms mechanism, dispute resolution, business-customer-only statement, data processing terms.

Risk read: with no liability cap, the operator's exposure to a provider that fails an audit and blames the documents is bounded only by the "drafts" wording and ACL. The "12 months expiry + no refund + suspension without notice" combination in a standard-form small-business contract is the kind of term the unfair-contract-terms regime (ACL Pt 2-3, penalties since Nov 2023) scrutinises; whether it is unfair depends on transparency and balance, which the placeholders undermine (speculation on outcome, fact on exposure).

### 4.2 Privacy Policy (https://auditrocket.com.au/privacy)
- Scope: handles "personal information in connection with the Audit Rocket service"; Privacy Act 1988 and APPs are not named.
- Collected: account, organisation (incl. logo and services), "the files you upload and the information you provide", Stripe payments ("We do not store your full card details"), enquiries.
- Purposes end with "[Any other purposes, e.g. marketing — confirm.]"
- Storage: "[Files and data are stored in LOCATION.]" — data location and overseas disclosure unknown.
- AI: project information and files are sent to Anthropic to prepare documents; then "[Uploaded files are / are not used to train AI models.]"
- Access: "[Describe any staff access, e.g. for support — confirm.]"
- Retention: "[Retention periods for account data, uploaded files, generated documents and payment records.]"
- Deletion: "[Data deletion — describe whether and how customers can request deletion.]"
- Complaints: internal first, then OAIC.
- Not addressed: sensitive/health information in uploads (auditor findings and incident/complaints registers routinely contain participant details), notifiable data breaches, cookies/analytics (the site loads Lovable's events SDK and sets a Cloudflare cookie), other subprocessors (Cloudflare, Lovable hosting, Microsoft 365 mail, Google Fonts), cross-border transfer to Anthropic's US infrastructure.

Contradiction: the homepage FAQ promises "Customer projects and uploaded files are private to your organisation" while the policy leaves staff access, retention and training use unresolved. The privacy policy says information is shared with "hosting, AI and payments" providers but names only Anthropic and Stripe.

### 4.3 Refund Policy (https://auditrocket.com.au/refund-policy)
- "No refunds are given on used credits, subject to the Australian Consumer Law."
- "[Unused credits — confirm whether refunds are available for unused credits, and how.]"
- "Nothing in this policy limits your rights under the Australian Consumer Law."
- Not addressed: unused and expired credits, cooling-off, failed generations/technical errors, refund method and timing, chargebacks.

### 4.4 Cross-document inconsistencies
1. Revisions: "3 free revisions per document" (how-it-works, no time limit) vs "within 30 days of generation" (pricing FAQ, terms).
2. Security: homepage says files are private and encrypted in transit; privacy policy has no storage location, retention, staff-access or training answer.
3. Entity location: ABR says VIC 3011; site says "[LOCATION]"; terms say "[STATE]".
4. Registers: marketed as an output type, yet the site also says it never creates evidence — registers populated with placeholder rows are fine, but a buyer may expect a working register, which Readyline's subscription actually provides.

## 5 Security and tech (observed only)

Observed from served HTML/JS and public DNS on 18 Oct 2026; no probing.

| Item | Observation |
|---|---|
| Build platform | Lovable: scripts `/__l5e/events.…js` (`window.__lovableEvents`), `/~flock.js` (web-vitals), OG image hosted on public Cloudflare R2 bucket `pub-bb2e…r2.dev/lovp_…`, deployment header `x-deployment-id: psr2.…`, A record 185.158.133.1 (Lovable hosting range) |
| Front end | React + TanStack Router/Start (`_authenticated` route tree, `createClientRpc`), Vite bundles, Lucide icons, Inter via Google Fonts, server-rendered meta and JSON-LD (Organization, WebSite, SoftwareApplication) |
| Edge | Cloudflare (`server: cloudflare`, `__cf_bm` cookie) |
| Headers | HSTS (1 year, includeSubDomains), `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`. No Content-Security-Policy, no X-Frame-Options/frame-ancestors, no Permissions-Policy observed on the homepage response |
| Auth | Email/password and "Continue with Google"; provider not identifiable from public pages (no Supabase/Clerk/Auth0 strings in the public bundle) |
| Payments | Stripe (privacy policy; `/api/public/stripe-webhook` route in public manifest) |
| AI | Anthropic (privacy policy) |
| Email | Microsoft 365 via GoDaddy; SPF `-all`; DMARC `p=quarantine` — reasonable mail hygiene |
| Analytics | Only Lovable's first-party events SDK; no GA/GTM/Hotjar/Meta pixel observed; Google Search Console verification meta present |
| Data location | Not stated anywhere. Lovable's default backend is Supabase (region selectable); speculation only — nothing public confirms where customer files sit |
| Cookie notice | None (not required in AU) |

Trust implication: an AI-generated front end on a no-code platform is not a flaw in itself, but combined with unfilled legal templates it signals a product assembled quickly, and a buyer handling participant data cannot currently learn where their uploads are stored.

## 6 Marketing, SEO and traction

| Channel | Result (18 Oct 2026) |
|---|---|
| Google index (`site:auditrocket.com.au`) | No results returned by WebSearch; sitemap and Search Console verification exist, so indexing is probably pending (speculation on cause) |
| Brand searches ("Audit Rocket" + NDIS/aged care; phone; email; entity name) | No third-party page mentions the product, the phone number, the support email or the entity. Results were unrelated (AuditRock, Rocket Software, Rocket Care Pty Ltd) |
| LinkedIn company page | linkedin.com/company/audit-rocket blocked for WebFetch; no search result for an Audit Rocket company page |
| Facebook / Instagram / X / YouTube | No search results; no social links on the site |
| Product Hunt, Reddit, Whirlpool, NDIS forums | No mentions found |
| Review sites (Google, Trustpilot, ProductReview, Capterra/GetApp) | No listing found |
| Meta Ad Library | Blocked for WebFetch; no evidence of ads |
| Testimonials / customers / case studies / logos | None on site |
| Job ads / GitHub | None found |
| Funding / accelerator / press | None found |
| SEO on-page | Decent: unique titles, meta descriptions, canonical, en_AU locale, JSON-LD, sector landing pages targeting "NDIS audit preparation", "NDIS policies and procedures", "aged care compliance", "Support at Home compliance"; "Official sources" and "last reviewed" blocks on sector pages are good E-E-A-T practice |
| Content marketing | No blog, guides, checklists or downloadable resources |

Conclusion: zero externally visible traction. All market presence is the website itself.

## 7 Claims audit

| Phrase (URL) | Assessment |
|---|---|
| "Audit documentation. Ready faster." and "audit-ready structure" (home) | "Audit-ready" is applied to folder structure, not compliance; defensible |
| "AI-Powered Audit & Compliance Documentation" (home title) | Fine; AI is disclosed in marketing but not in the Terms |
| "Does Audit Rocket guarantee audit approval? No." + footer disclaimer on every page | Good, consistent with Commission position that certification audits assess implementation (Stage 2 on-site), not documents alone. (Commission pages at ndiscommission.gov.au/provider-registration/apply-registration/types-audits could not be fetched; statement from general public Commission guidance) |
| "documents alone do not establish compliance with registration requirements" (home FAQ) | Accurate and unusually candid |
| "prepares draft documents from validated templates" (home FAQ) | "validated" by whom is unstated; unverifiable claim |
| "Customer projects and uploaded files are private to your organisation ... never made publicly accessible" (home FAQ) | Undercut by privacy placeholders on staff access and training use |
| "Our full data security approach will be published before launch." | Admission the product is pre-launch while taking payment |
| "Sources last reviewed 11 October 2026" on sector pages | Good practice; verifiable date |
| "Not affiliated with or endorsed by" both Commissions | Good |
| Aged care "automatic check flags any NDIS reference" | Specific, testable claim; unverified |
| No "compliant", "guaranteed", "approved" wording found | Marketing is honest on outcomes; the exposure is in the unfinished legal pages, not in the copy |

## 8 Strengths (respect or copy)

1. Findings-driven workflow: upload the auditor's non-conformance report or the old template set and get a targeted list of what to create or update. This is the strongest idea on the site and maps to the real post-audit "fix the gaps" moment, which Readyline's questionnaire path does not serve.
2. Multi-sector from day one (NDIS, residential aged care, Support at Home) with a cross-sector contamination check, and a visible roadmap (childcare, RTO, WHS, ISO).
3. Honest, consistent outcome disclaimers and non-affiliation statements on every page; "we don't create evidence" is well put.
4. Output hygiene: version numbers and review dates on every document, document index in the ZIP, highlighted placeholders for facts only the provider knows, logo on every document, earlier versions kept.
5. Registration-group-aware module selection and a list of the service types asked about; sector pages cite legislation with a "last reviewed" date.
6. Clean pricing page copy: "Pay once. No subscription.", GST-inclusive, clear credit definition.
7. Server-rendered SEO landing pages with schema markup, built fast.

## 9 Weaknesses, gaps and loopholes

1. Legal pages are unfinished templates: `[DATE]`, `[STATE]`, `[Liability cap and exclusions — confirm with your adviser.]`, `[Files and data are stored in LOCATION.]`, `[Uploaded files are / are not used to train AI models.]`, `[Retention periods …]`, `[Data deletion …]`, `[Describe any staff access …]`, `[Unused credits — confirm …]`, `[Any further restrictions — confirm.]`. A compliance-documentation vendor publishing placeholder compliance documents is the single biggest trust gap.
2. No data location, retention, deletion or training statement, while inviting uploads of auditor findings, incident and complaints material that commonly contain participant personal and health information. Privacy Act/APPs not referenced; no breach-notification statement.
3. Contradictions: revisions "3 free" vs "within 30 days"; security promise vs privacy placeholders; location on ABR vs site.
4. Pricing cliffs: a full NDIS pack realistically needs the $999 pack; per-document counting makes "Policy and Procedure" two credits; 12-month expiry; no stated refund on unused credits; "substantial rewrite" undefined.
5. Pre-launch while charging: "security approach will be published before launch", "Beta" on every sector, About page with "[Two to three sentences about why Audit Rocket was built — to be supplied.]", no team, no founder, no address.
6. No first-time-applicant guidance: no explanation of verification vs certification, Stage 1/Stage 2, module selection help beyond "we ask", no checklist of what an application needs; assumes the buyer already has requirements or findings to upload.
7. Nothing to see before paying: no sample document, no preview, no demo video, no free gap analysis; the only "proof" is a mocked dashboard.
8. No ongoing layer: registers are one-shot generated documents; no register maintenance, reminders, review-date tracking after download, or annual-review workflow.
9. Zero external traction evidence: no customers, reviews, social, press, jobs, index presence.
10. Security headers thin (no CSP, no frame-ancestors) and a no-code hosting stack with public R2 bucket for assets; observation only, but a procurement-minded provider would ask questions.
11. Terms silent on who owns the generated documents and what licence they take over uploaded auditor reports and policies — a loophole for them (they could claim rights) and a risk for buyers.
12. Sector spread may dilute depth: three regulatory regimes in beta simultaneously with no visible subject-matter team.

## 10 Threat assessment

- Capability: real product concept, plausibly working (authenticated routes for projects, documents, credits, billing and Stripe webhook exist in the public bundle), AI drafting via Anthropic, multi-sector. Medium.
- Maturity: ~1 week public, beta, unfinished legal, no traction, no team visible. Low now.
- Price position: 1.25x–2.5x Readyline for a comparable pack; no subscription; sells against Readyline on "upload your findings" and multi-sector, not on price.
- Segment overlap: high for registered providers responding to audit findings and for aged-care; medium for first-time NDIS applicants (their copy says they serve them, their workflow does not guide them); none for Readyline's registers subscription.
- Likely evolution (speculation): fill in the legal pages, add childcare/RTO, add samples and testimonials. If they ship a "upload your non-conformance report" flow that works, they own the post-audit remediation moment.
- Overall: a credible fast follower rather than an immediate threat. Watch in 30–60 days: legal pages finished, Google indexing, LinkedIn page, first reviews, removal of "Beta".

## 11 Recommended Readyline moves (ranked by impact, honest only)

1. Publish a finished, dated trust page: where data is hosted (region), subprocessors by name (AI model provider, hosting, payments, email), retention and deletion in days, "not used to train models", no participant data stored, NDB scheme statement, APPs referenced. Make it the most complete in the category; competitors' placeholders do the contrast for you without naming anyone.
2. Add an "I already have audit findings" entry path: upload the auditor's report or an old policy set and get a targeted gap list mapped to the questionnaire. This neutralises their core differentiator for existing providers.
3. Show the product before purchase: a watermarked full sample policy (DOCX and PDF), a 2-minute walkthrough, and a free pre-purchase "which modules do I need" check. They have none of this.
4. Make the full-pack price comparison explicit on your pricing page without naming anyone: "one price, every document in your pack, no credits, no expiry, unlimited edits for 12 months" — each clause maps to one of their cliffs.
5. First-time applicant guide as content: verification vs certification, Stage 1/Stage 2, registration groups and modules, what evidence auditors look for beyond documents. Target the SEO terms they target (NDIS audit preparation, NDIS policies and procedures) with genuinely better guidance.
6. Promote the registers subscription as the "after the pack" layer: review-date reminders, annual policy review, register templates kept live. They stop at download.
7. Finish Readyline's own legal pages to the standard you are judging them by: dated, governing state, liability cap, IP in outputs belongs to customer, licence over inputs limited to service delivery, AI disclosure in the terms, unfair-contract-terms review for small-business customers.
8. Output hygiene parity: version number, review date, document index, placeholder highlighting, logo, change log on revisions. Cheap to add and buyers notice.
9. Collect and publish verifiable social proof now (named providers with consent, Google reviews, LinkedIn presence, a public changelog). The category currently has none from them; be the one with references.
10. Set up monitoring: monthly check of their sitemap lastmod, pricing, legal pages, Wayback, ABR business names, LinkedIn, and job ads; re-run this review when "Beta" disappears or when they publish the security page.

Secondary, lower effort: note "Policy and Procedure as one document" and "no per-document counting" in copy; consider an aged-care/Support-at-Home roadmap signal only if real.

## 12 Sources (all read 18 Oct 2026)

- https://auditrocket.com.au/ — homepage, FAQ, footer, JSON-LD, headers, scripts
- https://auditrocket.com.au/robots.txt
- https://auditrocket.com.au/sitemap.xml
- https://auditrocket.com.au/how-it-works
- https://auditrocket.com.au/features (same content as how-it-works)
- https://auditrocket.com.au/pricing
- https://auditrocket.com.au/ndis-audit-preparation
- https://auditrocket.com.au/ndis-policies-and-procedures
- https://auditrocket.com.au/aged-care-compliance
- https://auditrocket.com.au/support-at-home-compliance
- https://auditrocket.com.au/about
- https://auditrocket.com.au/contact (form observed, not submitted)
- https://auditrocket.com.au/terms
- https://auditrocket.com.au/privacy
- https://auditrocket.com.au/refund-policy
- https://auditrocket.com.au/auth (observed only, `noindex`)
- https://auditrocket.com.au/assets/index-Dkg4b5ev.js and /assets/routes-HBcMBDh4.js (public bundles, route manifest)
- https://auditrocket.com.au/~flock.js and /__l5e/events.124894084da8c432.js (Lovable scripts)
- https://abr.business.gov.au/ABN/View?abn=63695074036
- https://creditorwatch.com.au/credit/profile/63695074036
- https://dns.google/resolve?name=auditrocket.com.au (A, NS, MX, TXT, _dmarc)
- https://archive.org/wayback/available?url=auditrocket.com.au (and with timestamp=20200101)
- WebSearch queries: entity name; "Audit Rocket" NDIS aged care; phone/email; site:auditrocket.com.au; LinkedIn/Facebook/Product Hunt/Reddit; jobs/GitHub; NDIS Commission audit evidence guidance

## 13 What could not be determined

- Domain registration date and registrant (auDA RDAP and whoxy blocked/robot-walled; two attempts).
- Certificate transparency history (crt.sh blocked).
- Content of the 12 Oct 2026 Wayback snapshot (web.archive.org blocked for reading; only the availability API worked).
- Director names (not on any readable page; ASIC extract not accessed).
- Whether a LinkedIn company page exists (blocked) and any Meta ads (Ad Library blocked).
- Authentication provider, database/backend and data region (not visible in public bundles; Lovable/Supabase default is speculation).
- Actual output quality, turnaround time and whether the "automatic NDIS reference check" works (would require an account, which the rules prohibit).
- NDIS Commission audit guidance pages (ndiscommission.gov.au blocked for WebFetch); Commission position stated from general public knowledge, not a fetched quote.
- Any customer, revenue, usage or funding figure.

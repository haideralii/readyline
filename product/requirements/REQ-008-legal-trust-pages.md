# REQ-008: Legal and trust pages
Status: ready
Phase: 4   Priority: must   Owner: Dev (pages and wiring); PO (copy)   Blocks: REQ-007 going live with real money.

## Why
Nobody should be charged before the terms, privacy policy, refund terms and AI disclosure exist and are linked from every page. These pages are also trust signals for a first-time visitor: Australian hosting, no participant data, independence from the NDIA and the Commission.

## Scope
In: `/terms`, `/privacy`, `/refunds`, `/ai` (how Readyline uses AI), `/about` (who runs it, independence statement, contact), a footer present on every page, and a `product/legal/` folder holding the copy as markdown that the pages render. Out: cookie banner (no third-party cookies, so none is needed; a test asserts no third-party cookies are set), legal review (Haider engages a lawyer before launch; the pages carry the PO's plain-language draft until then).

## Functional requirements
- FR-1 Pages render markdown from `product/legal/*.md` with a "Last updated" date taken from the file's front matter; headings are numbered; reading grade target 9 or below for the refund and AI pages, 11 or below for terms and privacy (the readability lint from REQ-005 runs over these files in CI as a warning).
- FR-2 Footer on every page: Readyline; "General information and document templates, not legal advice"; links Terms, Privacy, Refunds, How we use AI, About, Contact (mailto to a `CONTACT_EMAIL` config value); "Hosted in Australia"; "Independent of the NDIA and the NDIS Quality and Safeguards Commission"; ABN line shown only when `BUSINESS_ABN` is set.
- FR-3 Privacy page states: what we collect (business details, questionnaire answers, account email), what we never collect (participant personal, health or disability information; a request that users do not enter it), where data is stored (Supabase, Sydney; Vercel; Anthropic for document drafting with no training on our data), retention and deletion (REQ-004 periods), export, how to complain, and the Privacy Act small-business position in plain words with a note that we behave as if the Act applies.
- FR-4 AI page states: which parts of a document are fixed text and which are drafted by a model from the user's answers; the model provider; that a person must review and adopt every document; that no participant data is sent to the model; and how to tell us about a wrong output.
- FR-5 Refunds page: the REQ-007 promise verbatim, how to ask, how long it takes (Stripe's 5 to 10 business days).
- FR-6 Terms: plain-language terms for a one-off purchase and (marked "when available") the subscription; no interest, no late fees, service pauses on non-payment; governing law New South Wales; the not-legal-advice and no-guarantee statements; licence to the generated documents (the customer owns their documents and may edit them freely).
- FR-7 About: who runs Readyline (sole trader, Sydney; name added when the ABN exists), why it exists, the independence statement, no auditor referral fees (D-021).

## Acceptance criteria
- AC-1 Every page in the app has the footer (e2e walks every route). All five pages render, are linked, axe clean, Lighthouse accessibility 100, and readable at 360 px.
- AC-2 Prohibited-claims lint passes over `product/legal/*.md`.
- AC-3 No third-party cookies and no third-party requests other than Supabase and (on purchase pages only) Stripe; a Playwright test records every request on the five pages and the home page.
- AC-4 The copy files carry front matter `updated: YYYY-MM-DD` and `owner: po`.

## Evidence required on delivery
Screenshots of the five pages and the footer at both viewports; the request log from AC-3.

## Dev response
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
**12 Oct 2026 (branch `req-008-legal-pages`, 792e113; PR #12): ACCEPTED.** Pages, footer, draft note, last-updated line and the no-third-party test are as specified; screenshots reviewed at 360 px. D-801 (own front-matter parser instead of gray-matter), D-802 (quoted banned words on the AI page exempt from the claims lint, on that page only) and D-803 (readability module copied until PR #9 merges) accepted. One cosmetic item for a later batch, not blocking: the footer states independence from the NDIA and the Commission twice (in the general-information paragraph and in the trust line); keep the trust line and shorten the paragraph. Merge when CI is green. Lighthouse: Haider records the score once when he next runs the app.

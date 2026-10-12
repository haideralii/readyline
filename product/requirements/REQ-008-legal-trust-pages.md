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

**2026-10-12 (batch 13, item 4; response only, nothing built).** Read with the PO's drafts in `product/legal/{terms,privacy,refunds,ai,about}.md` (commit 63fe3ad), which already carry `title`, `updated: 2026-10-12`, `owner: po` and a `status` line in their front matter, so AC-4 holds today.

### How the markdown pages will be built

- **Source of truth stays in `product/legal/*.md`.** A server-only module `src/lib/legal/pages.ts` reads the five files at build time with `node:fs`, parses the front matter with `gray-matter`, and exports a typed list (`slug`, `title`, `updated`, `owner`, `status`, body). Zod validates the front matter so a missing `updated` or an owner other than `po` fails the build, not the page.
- **One route, five static pages:** `src/app/(legal)/[slug]/page.tsx` with `generateStaticParams` over the five slugs and `dynamicParams = false`, so `/terms`, `/privacy`, `/refunds`, `/ai` and `/about` are prerendered and anything else is a 404. `generateMetadata` sets the title from the front matter.
- **Rendering:** `react-markdown` with `remark-gfm` (tables in the privacy page), no `dangerouslySetInnerHTML`. Heading components are overridden to number `##` and `###` headings ("1", "1.1") and to give each an id, which also gives us an in-page contents list on phones. The PO's files already use numbered headings in the text ("## 1 Our promise"); the renderer will number from structure and the copy will drop the hand-typed numbers, so the two cannot drift.
- **"Last updated"** is printed under the title from `updated`; while `status` begins with "draft", a one-line note above the body says the page is a plain-language draft pending legal review, taken from that front matter so it disappears when the PO removes the line.
- **CI lints over the five files (`src/lib/legal/legal-copy.test.ts`, part of `npm run check`):** the prohibited-claims check from `src/lib/claims.ts` fails the test (AC-2); the readability grade from `src/lib/generator/readability.ts` is computed on the body text (headings and tables excluded, as for generated documents) and printed as a GitHub `::warning::` annotation when it is above 9 for refunds and ai, or above 11 for terms and privacy, without failing (FR-1). The same test checks that every file links nowhere outside the site and never uses "NDIS" in a page title.

### Footer

- `SiteFooter` (already on every page through `src/app/layout.tsx`) gains the FR-2 lines: brand, the existing general-information notice and AI disclosure, a nav with Terms, Privacy, Refunds, How we use AI, About and Contact (`mailto:` from `CONTACT_EMAIL`), "Hosted in Australia", "Independent of the NDIA and the NDIS Quality and Safeguards Commission", and the ABN line only when `BUSINESS_ABN` is set. Both values are read in the server component from `process.env`; they are public on every page, so they are not secrets, but they stay without the `NEXT_PUBLIC_` prefix as the REQ names them and the client bundle check keeps them out of client code.
- The footer renders on the sign-in, account, documents and admin routes too (same root layout). The AC-1 e2e builds its route list from `src/app/**/page.tsx` at test time, so a new page cannot ship without the footer: public routes are visited directly, signed-in routes are visited signed out and the footer is asserted on the sign-in page they redirect to.

### No third-party requests or cookies (AC-3)

- A Playwright spec `e2e/legal-pages.spec.ts` on both projects (desktop and the 360 px Android profile) visits `/`, the five pages and `/sign-in`, records every request URL with `page.on("request")`, waits for network idle, and asserts each host is the app origin or the Supabase project host; Stripe hosts (`js.stripe.com`, `checkout.stripe.com`) are allowed only on the purchase routes once REQ-007 adds them, by an explicit per-route allow list in the test. Fonts are self-hosted by `next/font`, so no Google Fonts request is expected and one would fail the test.
- Cookies: after the walk, `context.cookies()` must contain only cookies for the app origin (Supabase auth cookies are first-party on our domain). A third-party `Set-Cookie` is caught by asserting that no response from a non-app host carried one.
- The request log is written to `product/evidence/req-008/requests-<project>.json` by the test, which is the AC-3 evidence the REQ asks for, together with the full-page screenshots at both viewports (same pattern as REQ-013).
- Accessibility: `@axe-core/playwright` on each page, as in REQ-003. Lighthouse is run by hand in Chrome at both viewports and the accessibility score screenshot goes into the evidence folder; there is no Lighthouse step in CI and I propose not to add one for five static pages.

### Config values Haider must set (names only)

- `CONTACT_EMAIL`: the address behind the Contact link and "how to complain" (Vercel project variable and `.env.local`; added to `.env.example` empty). The footer shows no Contact link until it is set, and the legal-copy test warns.
- `BUSINESS_ABN`: optional; the ABN line appears only when set. Set it once the ABN is registered (Vercel and `.env.local`).
- No other config. The About page's owner name is copy, not config: the PO adds it to `about.md` when the ABN exists.

### Dependencies to add

`gray-matter`, `react-markdown`, `remark-gfm` (all maintained, no native code), plus `@axe-core/playwright` if it is not already a dev dependency from REQ-003.

### Estimate and questions

- One Dev session: module and route, footer, the two tests, evidence. It can run on its own branch from `main` (`req-008-legal-pages`) independent of REQ-005.
- Q1. The PO's drafts hand-number their headings ("## 1 Our promise"). Confirm the renderer numbers from structure and the hand-typed numbers are removed from the copy; otherwise the renderer will leave numbering to the copy and only add ids.
- Q2. FR-5 wants the REQ-007 refund promise verbatim. `refunds.md` already states it; confirm it is the final wording, or REQ-007's text is the source and `refunds.md` must match it (a test can assert the two are identical).
- Q3. The privacy page names Supabase, Vercel and Anthropic. Should the AI page also name the model family in use (recorded in `ANTHROPIC_MODEL`), or only the provider? Recommend provider only, since the model id changes with `PROMPT_VERSION` bumps.

Noted: the PO owes the copy in `product/legal/` and has delivered first drafts; a lawyer checks them before launch.

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)

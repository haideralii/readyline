# QA report B: content pages and edge routes

Site: https://readyline-zeta.vercel.app (release `b340ee3`; `/api/health` reports `sha b340ee3dbe84`, region `syd1`, `deployment: production`).
Run: 18 October 2026, Playwright 1.64 Chromium, viewports 360x740 (mobile emulation) and 1280x800. Everything read-only: no sign-in, no account, no form submitted; the only typing was the word `cleaning` / `zzzqqq` into the client-side group filter on `/guides/registration-groups` (an input outside any form). Requests were sequential at about one per second.

Scripts and data in this folder: `B-run.mjs` (pages, edge routes, headers, sitemap, link check; writes `B-results.json`, `B-run.log`), `B-axe.mjs` (axe-core on every page at both widths plus the search-clear check; writes `B-axe.json`), `B-sample.mjs`. Screenshots under `shots/B-*` (one full-page shot per page per width, `-1280-scrolled` shots of the Jump-to after a scroll, `B-edge-*` for the unknown-token routes, `B-groups-search-*` for the filter states).

## Summary

| Total checks | PASS | FAIL | NOTE |
|---|---|---|---|
| 94 | 71 | 1 | 22 |

The one FAIL: on the "unknown token" 404s (`/email/unsubscribe/<bad>`, `/report/<bad>`, `/auditor/<bad>`, `/invite/<bad>`) and on `/admin` signed out, the page body is the site's own "That page is not here." 404 and the server sends `<title>Page not found | Readyline</title>`, but once React hydrates the browser tab title changes to the route's own metadata: "Reminder emails stopped | Readyline", "Report an incident | Readyline", "Shared audit view | Readyline", "Your invitation | Readyline", "Admin | Readyline". A person who taps a stale unsubscribe link sees a tab called "Reminder emails stopped" over a page saying the link is old or mistyped; `/admin` announces itself in the tab even though the body is a 404. Plain `/this-does-not-exist` keeps "Page not found | Readyline" (the `not-found.spec.ts` case), so the e2e suite does not catch it.

Nothing returned a 500, no stack trace or environment detail appeared anywhere, every sitemap URL answers 200, every internal link from the inspected pages answers 200 (or 307 to sign-in for the one account-page link on `/ai`), the headers match `security-headers.spec.ts` on every route tried, and axe (WCAG 2.0/2.1 A+AA plus best-practice) reported zero violations on all 18 pages at both widths.

## 1. Guides

### 1.1 /guides index

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 1 | PASS | 360, 1280 | 200, title "Guides to NDIS provider registration \| Readyline". One h1 "Guides". `guides-list` shows the four guides each with "Last reviewed 13/14 October 2026", plus the "Registration groups: which audit and which documents each of the 38 classes needs." link. Header and footer present, no sideways scroll at 360 (scrollWidth 360). Shots `B-guides-360.png`, `B-guides-1280.png`. |
| 2 | NOTE | both | The index does not say the cost guide is a draft, but the cost guide itself opens with the box "Draft. This guide is being checked; lines marked UNVERIFIED are still to be confirmed against the Commission's pages." A reader is told to look for UNVERIFIED lines and there are none on the page (the word appears only in that box). See 1.3. |

### 1.2 /guides/which-ndis-audit

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 3 | PASS | both | One h1 "Verification or certification: which NDIS audit do you need?". h2 order: Short answer, The two audits in plain words, Every registration group by audit type, Four cases the list alone does not settle, What the audit report says, The mid-term audit, When registration becomes compulsory, Questions people ask, See which audit you need, free, Sources (+ the aside's own "Short answer" h2, hidden under lg). Every h2 has an id; no h3 skips. |
| 4 | PASS | 1280 | Aside (`role=complementary`, 1 of them) visible on the right with "Jump to" (8 links), then "Last reviewed 14 October 2026. Updated 14 October 2026.", then the "Short answer" box. Scrolled to the second heading: the nav stays at top 96 px (sticky at 6 rem) and `aria-current="location"` moved from none to "Every registration group by audit type" (underlined in ochre). Shot `B-guides-which-ndis-audit-1280-scrolled.png`. |
| 5 | PASS | 360 | No visible complementary landmark (the aside is in the DOM but `display:none`). The article's own copy is visible: "Short answer" box with three bullets, then "Jump to: The two audits in plain words, Every registration group by audit type, Four cases the list alone does not settle, What the audit report says, The mid-term audit, When registration becomes compulsory, Questions people ask, Sources" (`guide-jump-to`, `aria-label="Jump to"`). Each href lands on an existing heading id. Shot `B-guides-which-ndis-audit-360.png`. |
| 6 | PASS | both | Reviewed line `guide-reviewed`: "Last reviewed 14 October 2026. Updated 14 October 2026." |
| 7 | PASS | both | Table: the data-table region is named "Every registration group by audit type: Code, Registration group, Audit" (`aria-label` on the region and the table). At 360 it stacks as a list (table element hidden), at 1280 it is a table with CODE / REGISTRATION GROUP / AUDIT headers. No overflow at 360. |
| 8 | PASS | both | External links: five, all `https://www.ndiscommission.gov.au/...`, `target=_blank rel="noopener noreferrer"`, link text carries "(opens in a new tab)". Sources block first link is the Commission's registration-groups page. FAQPage JSON-LD present (1 script). |
| 9 | PASS | both | Internal links all 200: `/guides`, `/guides/what-happens-at-an-ndis-audit`, `/guides/registration-groups`, `/start`, legal pages. |

### 1.3 /guides/ndis-registration-cost

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 10 | PASS | both | One h1 "NDIS registration cost in 2026-27: what a small provider really pays". h2 order: Short answer, What you pay, line by line, What drives the number, Work out your own audit type and price, Where small providers overspend, Questions people ask, See which audit you need, free, Sources. |
| 11 | PASS | 1280 | Aside with Jump to (6 links), reviewed line, short answer; after scrolling to "What drives the number" aria-current moved to it, nav top 96 px. Shot `B-guides-ndis-registration-cost-1280-scrolled.png`. |
| 12 | PASS | 360 | No complementary landmark; article's "Short answer" (3 bullets) then "Jump to: What you pay, line by line, What drives the number, Work out your own audit type and price, Where small providers overspend, Questions people ask, Sources". |
| 13 | PASS | both | Reviewed line "Last reviewed 13 October 2026. Updated 13 October 2026." Table region named "What you pay, line by line: Item, Typical range, Source and date"; "AUD 399" in it. No overflow at 360. |
| 14 | NOTE | both | Copy: the draft box "Draft. This guide is being checked; lines marked UNVERIFIED are still to be confirmed against the Commission's pages." sits above a guide about money, on production, with no line actually marked UNVERIFIED. A nervous owner reads "being checked" and cannot tell which numbers to trust. Either drop the box (content front matter still says `status: draft`) or mark the lines. |
| 15 | NOTE | both | External links: two go to `ndiscommission.gov.au` and are labelled "(opens in a new tab)"; one goes to `https://www.providerplus.com.au/post/how-much-does-ndis-provider-registration-cost-in-2026` (a commercial consultancy, labelled "Provider+: ...") and one, inside the FAQ "Is there a fee to apply to the Commission?", is a bare URL `https://ablis.business.gov.au/service/ag/ndis-provider-registration/40940` as link text with no `target`, no "(opens in a new tab)" label, so it behaves differently from every other source link. Both are outside the legislation.gov.au / ndiscommission.gov.au set. Not broken, but inconsistent and the bare URL is hard to read on a phone. |
| 16 | PASS | both | Cost calculator (`cost-calculator`) renders with its "Find your support types" box. Not exercised beyond rendering (per the hard rules nothing was typed into it). |

### 1.4 /guides/what-happens-at-an-ndis-audit

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 17 | PASS | both | One h1. h2 order: Short answer, The five kinds of audit, What the auditor reads, The interviews, The closing meeting and the ratings, How the money works, Getting ready, in the order an auditor works, Questions people ask, CTA, Sources. No `guide-draft-note`. Reviewed "Last reviewed 14 October 2026. Updated 14 October 2026." |
| 18 | PASS | 1280 | Aside Jump to (8 links); after scroll aria-current on "What the auditor reads", nav top 96. |
| 19 | PASS | 360 | No complementary landmark; article Short answer (3 bullets) then "Jump to: The five kinds of audit, What the auditor reads, The interviews, ... Questions people ask, Sources". No overflow. |
| 20 | PASS | both | Table region "The five kinds of audit: Kind, Who gets it, What it is"; text contains "Out of cycle". External links: three, all ndiscommission.gov.au (one a PDF under `/sites/default/files/2026-07/Regulatory-Expectations-AQAs-PDF.pdf`), all labelled "(opens in a new tab)". Body says practice is "not a rule". |

### 1.5 /guides/registers-an-auditor-asks-for

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 21 | PASS | both | One h1 "The registers an auditor asks for, and what each one proves". h2 order: Short answer, Two records the Rules require you to keep, The records the Practice Standards expect, The records auditors ask for in practice, How the auditor reads a register, Keep them as things happen, Questions people ask, CTA, Sources. Reviewed line present. |
| 22 | PASS | 1280 | Aside Jump to (7 links); after scroll aria-current on "The records the Practice Standards expect", nav top 96. |
| 23 | PASS | 360 | Article Short answer then "Jump to: Two records the Rules require you to keep, ... Sources". No overflow. |
| 24 | PASS | both | Three tables, each region uniquely named by its heading: "Two records the Rules require you to keep: Record, What the rule says, Where to keep it", "The records the Practice Standards expect: ...", "The records auditors ask for in practice: ...". Text includes "Complaints register" and "It is the companion to your own worker list". External links: three ndiscommission.gov.au, labelled. |

### 1.6 /guides/registration-groups

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 25 | PASS | both | 200. One h1 "Registration groups"; h2s are the eight everyday categories (Personal care at home, Help around the house and getting out, Therapy and health, Equipment and modifications, Housing and living arrangements, Children and families, Specialist supports, Business and platform services). `groups-count` "38 registration groups." 38 group links, all 200 (checked one by one). No aside on this page by design (`PageShell kind="reading"` with no aside); no overflow at 360. |
| 26 | PASS | 360 | Search box: `<input type="search" id="groups-search">`, labelled "Search by what you do (for example cleaning, support worker, therapy, SIL)", not inside a `<form>` (nothing can be submitted). Typed `cleaning`: count became "2 of 38 registration groups match." with links "Household tasks" and "Assistive products for household tasks". |
| 27 | PASS | 360 | Typed `zzzqqq`: count "0 of 38 registration groups match." and the sentence "No matches. Try another word, or clear the search to see every group." with no group links left. Shot `B-groups-search-nomatch-360.png`. |
| 28 | PASS | 360 | Cleared the box: count back to "38 registration groups.", 38 links, 8 category headings, "No matches" gone. Shot `B-groups-search-cleared-360.png`. |
| 29 | NOTE | both | "clear the search" in the no-match sentence is plain text, not a link or button. The only clearing control is the browser's native "x" inside the search field (visible in the shot). It works, but the sentence reads like an instruction to tap something that is not there. |

### 1.7 Group pages (0107, 0115, 0136)

Pages: `/guides/registration-groups/assistance-with-daily-personal-activities` (0107), `/guides/registration-groups/assistance-with-daily-life-tasks-in-a-group-or-shared-living-arrangement` (0115), `/guides/registration-groups/group-and-centrebased-activities` (0136).

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 30 | PASS | both | All three 200. One h1 each: "Assistance with daily personal activities (class 0107)", "Assistance with daily life tasks in a group or shared living arrangement (class 0115)", "Group and centrebased activities (class 0136)". h2 order on each: Your audit: certification, Practice Standards modules (1), The documents the pack produces (22 / 22 / 20), [h3 Registers to keep (5)], AUD 399 once for the whole pack, Questions people ask, Sources. The one h3 sits under the documents h2. |
| 31 | PASS | 1280 | Aside with Jump to (6 links: Your audit: certification, Practice Standards modules, The documents the pack produces, Price, Questions people ask, Sources). After scroll aria-current on "Practice Standards modules", nav top 96. Shots `B-guides-registration-groups-*-1280-scrolled.png`. |
| 32 | PASS | 360 | No complementary landmark. The group pages have no article-level "Jump to" copy (only the four guides do, per batch 49 item 5); the page is short. No overflow at 360 even with the long 0115 title. |
| 33 | PASS | both | `group-audit` "Your audit: certification ... Source: Registration groups or classes of support (audit type table) (opens in a new tab)" linking to ndiscommission.gov.au; `group-price` "AUD 399 once for the whole pack"; `group-cta` href `/start?group=0107` / `0115` / `0136` (all 200). Sources: Commission pages and the Application Pack PDF on ndiscommission.gov.au, all labelled "(opens in a new tab)". FAQPage JSON-LD present. Body contains no "data/", ".json" or "Never restate". |
| 34 | NOTE | both | Naming: the 0136 page is titled "Group and centrebased activities" (title tag, h1, slug `group-and-centrebased-activities`, CTA "Start with group and centrebased activities ticked") while its own blurb says "centre-based activities" and the Commission writes "Group and Centre Based Activities". "centrebased" reads as a typo on every surface of that page. |
| 35 | NOTE | both | The 0115 group's h1 and CTA ("Start with assistance with daily life tasks in a group or shared living arrangement ticked") are long; fine at both widths, but the CTA button is four lines at 360. Cosmetic. |

## 2. Legal pages

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 36 | PASS | both | `/terms`, `/privacy`, `/refunds`, `/about`, `/ai` all 200, titles "Terms of use \| Readyline", "Privacy policy \| Readyline", "Refunds \| Readyline", "About Readyline \| Readyline", "How Readyline uses AI \| Readyline". One h1 each; h2s numbered 1..n in order (terms 11, privacy 10, refunds 6, about 6, ai 6); every h2 has an id. |
| 37 | PASS | 1280 | Each renders through the reading shell with one complementary aside holding "Last updated 16 October 2026" (privacy: 17 October 2026) and "Jump to" with one link per numbered h2. After scrolling to section 2 the matching link got `aria-current="location"`; the aside column stays sticky (nav top 132 px: the updated line sits above it). Shots `B-terms-1280.png`, `B-terms-1280-scrolled.png`, etc. |
| 38 | PASS | 360 | No complementary landmark; `legal-updated` "Last updated 16 October 2026" directly under the h1. No horizontal overflow on any of the five. |
| 39 | PASS | both | No broken anchors: every `#` link on the five pages resolves to an element id (0 broken). |
| 40 | PASS | both | Refund promise on `/refunds` section "1 Our promise": "We want you to be happy with what you buy. If you are not, tell us and we will put it right or refund you as set out below." The same paragraph is repeated on `/pricing` under "Refunds". |
| 41 | PASS | both | Subscription wording: `/refunds` h2 "3 The registers subscription" and `/terms` section 4 "The registers subscription is charged in advance for each period. You can cancel at any time and keep access until the end of the paid period. ..." No "Audit-ready subscription" anywhere on terms, refunds, privacy, about, ai or pricing. (`/pricing` uses the capitalised "Registers subscription" heading; the legal pages use lower-case "registers subscription" mid-sentence, consistent with the markdown source.) |
| 42 | PASS | both | Contact address: terms "11 Contact: Email us at the contact address in the footer.", refunds "4 How to ask: Email us at the contact address in the footer with the email address on your account and the receipt number.", privacy "Contact details are in the footer." The footer shows a "Contact" `mailto:` link (`footer-contact`) on every page. |
| 43 | NOTE | both | The footer contact is a personal Gmail address (`haiderali14se89@gmail.com`). Terms, refunds and privacy all point to it as the only way to ask for a refund or raise a privacy complaint. For a paid service that holds incident and worker records, a nervous buyer may read a Gmail address as "no business behind this". Consider a domain address. |
| 44 | NOTE | both | Every legal page shows the box "Draft. Plain-language draft by the product owner; to be checked by a lawyer before launch." (about: "Draft. Plain-language draft by the product owner.") on the live site that already takes payment. The e2e spec expects it (`legal-draft-note`), so this is by design, but "before launch" on a launched product undermines the terms the buyer is being asked to accept. |
| 45 | NOTE | both | No template tokens leaked (`{{...}}`, `[NAME]` and the like absent). The `{{business-line}}` sentence is absent on terms, so the trading name and ABN are not shown; terms say only "Readyline is run by a sole trader in Sydney, Australia." That is fine for the token rules but means the terms never name the contracting party. |
| 46 | PASS | both | External hosts: none on the legal pages except the `mailto:` footer link; no third-party request on any of them (all requests same-origin). |
| 47 | NOTE | both | `/ai` links "your documents page" to `/documents`, which answers 307 to `/sign-in?next=%2Fdocuments` for a signed-out reader. Expected (it is an account page), but it is the only internal link from a public page that does not answer 200. |

## 3. /sample, /sign-in, /pricing

| # | Result | Viewport | What I did / saw |
|---|---|---|---|
| 48 | PASS | both | `/sample` 200, "Sample document \| Readyline". One h1 "See exactly what you get"; h2 "Complaints management policy, procedure and register"; h3s Document control / In plain words / Easy Read version visible and 14 more h3s inside the closed `<details>` "Show the other 13 sections" (they looked empty to innerText only because the disclosure is shut). Eight tables, each region named from its columns ("Table: Item, Detail", "Table: Role, Does what, When", ...). Word download link `/sample/complaints-policy.docx` answers 200. No overflow at 360. |
| 49 | NOTE | both | Sample table names are generic ("Table: Item, Detail"; "Table: Role, Does what, When" appears twice). Named, so not a failure, but two tables share a name. Also the label "Generic text: add your details." sits under the document title of a page that says "This is a real document from a recorded run, not a template"; the two sentences pull in opposite directions. |
| 50 | PASS | both | `/sign-in` 200. One h1 "Sign in", copy "We email you a link; there is no password. Use the address you want your account under." One form with one field: `<input type="text" id="email" name="email" autocomplete="email" maxlength="254" value="">`, label "Email address" (a real `<label for>`), button "Email me a sign-in link". Value empty on load, nothing prefilled, no hidden fields exposing anything, no third-party requests. Not submitted. Shots `B-sign-in-360.png`, `B-sign-in-1280.png`. |
| 51 | NOTE | 360 | The email field is `type="text" inputmode="text"` (set explicitly in `sign-in-form.tsx`). On a phone the keyboard will not offer the "@" / ".com" email layout. `inputmode="email"` would help without changing validation. |
| 52 | PASS | both | `/pricing` 200. One h1 "Pricing"; h2s Registers subscription, Price, What you get, What it is not, Refunds, How the drafts are made. Links in the main content to the legal pages: "Terms of use" → `/terms`, "Privacy policy" → `/privacy`, "Refunds page" → `/refunds`, "How Readyline uses AI" → `/ai`; all 200. Sentence "Before you buy, read the Terms of use, Privacy policy and Refunds page." Phone price strip at 360: "Document pack: AUD 399, once" / "Registers: AUD 39 a month, cancel any time". "Sign in to buy" goes to `/sign-in?next=%2Fpricing` (not followed). CSP on `/pricing` adds `form-action 'self' https://checkout.stripe.com` and nothing else mentions Stripe. |

## 4. Unknown-token and signed-out routes

All fetched with redirects not followed (status and words from the raw response), then opened in a 360 browser for what a visitor sees. No 500, no stack trace, no "Application error", no Supabase/REST/JWT fragments in any body (`leaks: []` on every one). Bodies are `cache-control: private, no-cache, no-store`.

| # | Result | Route | What I saw |
|---|---|---|---|
| 53 | PASS | `/email/unsubscribe/not-a-real-token` | 404. Body is the site 404: h1 "That page is not here.", "The link may be old or mistyped. Start with the free questions, or read the guides.", links "Start the questions" (`/start`) and "Read the guides" (`/guides`), header and footer present. Nothing says whether the token was malformed or unknown. Shot `B-edge-email-unsubscribe-not-a-real-token-360.png`. |
| 54 | PASS | `/report/not-a-real-token` | 404, same 404 page. |
| 55 | PASS | `/auditor/not-a-real-token` | 404, same 404 page. |
| 56 | PASS | `/invite/not-a-real-token` | 404, same 404 page. |
| 57 | **FAIL** | the four above and `/admin` | **Browser tab title is the private route's title, not "Page not found".** Server HTML has `<title>Page not found | Readyline</title>` (confirmed with curl, saved as `B-unsub.html`, `B-admin.html`), but the RSC payload carries the route's `metadata.title` and after hydration `document.title` became: `/email/unsubscribe/...` → "Reminder emails stopped \| Readyline"; `/report/...` → "Report an incident \| Readyline"; `/auditor/...` → "Shared audit view \| Readyline"; `/invite/...` → "Your invitation \| Readyline"; `/admin` → "Admin \| Readyline". The body underneath is "That page is not here." A reader who follows a stale unsubscribe link sees a tab saying their reminder emails stopped when nothing happened; "Admin" in the tab confirms the route exists to anyone probing. `/this-does-not-exist` keeps "Page not found \| Readyline" so `not-found.spec.ts` passes; `req-022-b.spec.ts` checks only status and h1. Fix: the token pages and the admin page should not export static `metadata` that survives `notFound()` (use `generateMetadata` that returns the not-found title when the token fails, or set the title only on the success render). Recorded values: `B-results.json` → `edges[]` with `browser: true` → `title`. |
| 58 | PASS | `/registers/incidents/abc` | 307 → `/sign-in?next=%2Fregisters%2Fincidents%2Fabc`; in the browser lands on the Sign in page (200). No register content, no "abc" echoed. |
| 59 | PASS | `/registers` | 307 → `/sign-in?next=%2Fregisters`. |
| 60 | PASS | `/account` | 307 → `/sign-in?next=%2Faccount`; browser lands on Sign in. |
| 61 | PASS | `/admin` | 404 with the site 404 body (never a page, never a redirect that reveals an admin sign-in). Title issue recorded in #57. |
| 62 | PASS | `/worker` | 307 → `/sign-in?next=%2Fworker`; browser lands on Sign in. |
| 63 | PASS | `/checklist`, `/documents` | 307 from the proxy (`Redirecting...` 15-byte body) → `/sign-in?next=...`. |
| 64 | NOTE | `/registers/incidents/abc`, `/registers`, `/account`, `/worker` | These 307s come from the page (`redirect()` in the server component) rather than the proxy, so the 307 response carries a ~13 KB HTML body whose `<title>` is the private page's ("Incident \| Readyline", "Registers \| Readyline", "Your account \| Readyline", "Your entries \| Readyline"). No data inside, browsers never show it, but a crawler or curl user gets the private page's title on a redirect. The proxy's `SESSION_ROUTES` list covers only `/documents` and `/checklist`. |

## 5. Headers, health, robots, sitemap, 404

| # | Result | What I checked | What I saw |
|---|---|---|---|
| 65 | PASS | CSP on `/`, `/guides`, `/sign-in`, `/this-does-not-exist`, `/api/health` | `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://dpwwzhylcyosnkmlcnnp.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. No `unsafe-inline`, no Stripe outside `/pricing`. Nonce differs between two consecutive requests to `/`. |
| 66 | PASS | HSTS | `max-age=63072000; includeSubDomains; preload` on every route tried. |
| 67 | PASS | X-Content-Type-Options / Referrer-Policy / Permissions-Policy / X-Frame-Options | `nosniff` / `strict-origin-when-cross-origin` / `camera=(), microphone=(), geolocation=(), payment=()` / `DENY`, plus `frame-ancestors 'none'` in the CSP. No `x-powered-by`. |
| 68 | PASS | CSP violations in the browser | `securitypolicyviolation` listener on all 36 page loads: zero events. |
| 69 | PASS | `/api/health` | 200 `application/json`: `{"ok":true,"version":"0.1.0+b340ee3dbe84","sha":"b340ee3dbe84","region":"syd1","deployment":"production"}`. Matches release sha b340ee3. Same security headers as pages. |
| 70 | PASS | `/robots.txt` | 200 `text/plain`: `Allow: /`, `Disallow: /account /checklist /documents /registers /admin /api/ /dev/ /auth/`, `Sitemap: https://readyline-zeta.vercel.app/sitemap.xml`. |
| 71 | PASS | `/sitemap.xml` | 200 `application/xml`, 53 URLs: `/`, `/start`, `/pricing`, `/sample`, `/guides`, `/guides/registration-groups`, the five legal pages, the four guides, 38 group pages. Fetched each one (sequential, 1/s): all 53 answer 200 directly (no redirect), none carries `noindex`, all on the production host; none is a signed-in page. |
| 72 | PASS | `/this-does-not-exist` | 404 status, title "Page not found \| Readyline", h1 "That page is not here.", sentence "The link may be old or mistyped. Start with the free questions, or read the guides.", `not-found-links` "Start the questions" → `/start`, "Read the guides" → `/guides`, site header ("Readyline", "Sign in") and footer (`footer-nav` Terms Privacy Refunds How we use AI About Guides Contact, `site-disclaimer` "...not legal advice...", `footer-trust` "Hosted in Australia. Independent of the NDIA and the NDIS Quality and Safeguards Commission."). Security headers present on the 404. Shots `B-this-does-not-exist-360.png`, `-1280.png`. |

## 6. Console errors and failed network requests

| # | Result | Pages | What I saw |
|---|---|---|---|
| 73 | PASS | all 18 pages x 2 widths | Console: zero errors or warnings on every 200 page. The only console error anywhere is on the 404 pages: "Failed to load resource: the server responded with a status of 404 (Not Found)", which is the document itself answering 404 (correct). |
| 74 | PASS | all | Every request on every page was to `readyline-zeta.vercel.app` (fonts, scripts, styles self-hosted). No third-party cookies. |
| 75 | NOTE | all | Playwright reports 1 to 13 `net::ERR_ABORTED` per page, all `GET …?_rsc=<id>` requests: Next.js `<Link>` prefetches that the router cancels or dedupes while the page is still loading (e.g. `/sign-in?_rsc=…`, `/guides?_rsc=…`, group pages from the index). None is a real failure, none is user-visible, nothing answered 4xx/5xx. Recorded so nobody mistakes them for broken links. |
| 76 | PASS | all | Every page: `lang="en-AU"`, header `wordmark` "Readyline" + "Sign in", footer with the five legal links, "Guides" and "Contact". |

## 7. Accessibility sweep (axe-core, WCAG 2.0/2.1 A+AA + best-practice)

| # | Result | What I saw |
|---|---|---|
| 77 | PASS | All 18 pages at 360 and 1280: zero violations of any impact, including `landmark-unique`, `link-name`, `heading-order`, `region`, `color-contrast`. (`B-axe.json`.) |

## 8. Horizontal overflow at 360

| # | Result | What I saw |
|---|---|---|
| 78 | PASS | `document.documentElement.scrollWidth === clientWidth === 360` on all 18 pages; no element's right edge exceeds 361 px (checked every element in `body`). Stacked tables on the guides and sample, the long 0115 title, the registration-groups list, the pricing strip and the sign-in form all fit. |

## 9. Copy a nervous owner might trip on (collected NOTEs)

| # | Result | Where | Why it may confuse |
|---|---|---|---|
| 79 | NOTE | cost guide | "Draft. This guide is being checked; lines marked UNVERIFIED are still to be confirmed" with no UNVERIFIED lines (see #14). |
| 80 | NOTE | all legal pages | "to be checked by a lawyer before launch" on the live, paid product (see #44). |
| 81 | NOTE | footer, terms, refunds, privacy | Only contact is a personal Gmail address (see #43). |
| 82 | NOTE | 0136 group page | "centrebased" (see #34). |
| 83 | NOTE | registration-groups search | "clear the search" is not a control (see #29). |
| 84 | NOTE | group pages | "Every selected group (0136 Group and centrebased activities) is a higher-risk class that needs a certification audit." The phrase "Every selected group" on a single-group page reads as if the reader selected something; "This group is a higher-risk class" would be plainer. Same template on 0107 and 0115. |
| 85 | NOTE | sample | "Generic text: add your details." under the title of a page described as "a real document ... not a template" (see #49). |
| 86 | NOTE | guides at 360 | The inline "Jump to:" list on the phone copy uses `min-h-11` on each inline link, so a seven-item list takes about nine lines with wide gaps (see `B-guides-which-ndis-audit-360.png`); readable, but with the short answer box above it the body text starts well below the fold. |

## 10. Remaining rows (pass detail by page for completeness)

| # | Result | Page | Viewport | Status / title |
|---|---|---|---|---|
| 87 | PASS | `/guides/which-ndis-audit` | 360+1280 | 200 "Verification or certification: which NDIS audit do you need? \| Readyline" |
| 88 | PASS | `/guides/ndis-registration-cost` | 360+1280 | 200 "NDIS registration cost in 2026-27: what a small provider really pays \| Readyline" |
| 89 | PASS | `/guides/what-happens-at-an-ndis-audit` | 360+1280 | 200 "What happens at an NDIS audit: the five kinds, what the auditor reads, and what it costs \| Readyline" |
| 90 | PASS | `/guides/registers-an-auditor-asks-for` | 360+1280 | 200 "The registers an auditor asks for, and what each one proves \| Readyline" |
| 91 | PASS | `/guides/registration-groups` | 360+1280 | 200 "NDIS registration groups: which audit and which documents each one needs \| Readyline" |
| 92 | PASS | three group pages | 360+1280 | 200 "<Group> (NDIS class 0107/0115/0136): certification audit, modules and documents \| Readyline" |
| 93 | PASS | `/terms` `/privacy` `/refunds` `/about` `/ai` | 360+1280 | 200, titles as in #36 |
| 94 | PASS | `/sample` `/sign-in` `/pricing` | 360+1280 | 200 "Sample document", "Sign in", "Pricing" |

## Files

- Report: `report-B-content-and-edges.md`
- Raw data: `B-results.json`, `B-axe.json`, `B-run.log`, `B-axe.log`, `B-analysis.txt`, `B-unsub.html`, `B-admin.html`
- Screenshots: `shots/B-*.png` (59 files). The FAIL is evidenced by `B-edge-email-unsubscribe-not-a-real-token-360.png` together with the recorded `document.title` values in `B-results.json` (`edges[].title`, browser entries) versus the server HTML in `B-unsub.html` / `B-admin.html` ("Page not found").

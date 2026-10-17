# Role reviews of production fe325d2, 15 October 2026 (PO, public surface)

- **Environment:** production, https://readyline-zeta.vercel.app, health `fe325d26acaa`, syd1, after PR #56 (batch 45) and migrate run #15. Reviewed from outside: every public route fetched and read as text; the repository's own public Playwright suite (`e2e/*.spec.ts`, 186 tests, desktop-chromium and android-small) run against production from a clean clone of `main` at 01ad5bc; mobile screenshots at 360 px; the signed-in surfaces (registers, audit pack, worker role, auditor link, import, guided path) **not reviewed**, because the PO has no account on production and does not create one (standing rule). Those need either Haider signed in on production in the browser pane with a test address, or the Dev's pipeline on a local stack at fe325d2; see "Not covered" at the end.
- **Comparison:** against `product/qa/role-reviews/2026-10-14/` (local dev server, 5209a5e).
- **One file, seven sections:** written as one file to spend one docs commit instead of seven while batch 46 (docs-only commits cost nothing) is still on `next`. Each section keeps its role's severity scale from the README.

## Totals

| Role | Scale | Count |
| --- | --- | --- |
| QA | blocker / major / minor | 0 / 1 / 5 |
| Manager | blocker / major / minor | 1 / 3 / 1 |
| Field | could not / would get it wrong / annoying | 0 / 1 / 2 |
| Domain | wrong / unsourced / imprecise | 0 / 1 / 1 |
| Provider | could not / would get it wrong / annoying | 1 / 1 / 0 |
| Auditor | major NC / minor NC / observation | 0 / 1 / 2 |
| Commission | would act / would ask / would note | 0 / 2 / 2 |

The same root cause appears in five roles (the subscription story); it is one item in the batch.

## 1 of 7: QA (does it work, is it tested)

Public suite against production: 176 ran, 10 failed, of which 2 are production findings and 8 are the suite assuming a non-production environment (details in finding 2). Re-run of the suspect specs alone: the skip-link test and the accessibility pass passed; the footer-on-every-route test failed again on both projects at the 60 s test timeout (my run's budget, not a page fault: every route answered in under 1 s by curl).

1. **Where:** `/pricing` against `/` and `/start/result`. **Seen:** `pricing.spec.ts` fails on production: no `subscription-offer`; the page shows "AUD 39 a month, not available yet. Coming after the document pack ..." while the home page says "AUD 39 a month keeps you audit-ready ... Cancel at any time." **Why:** `subscriptionAvailable()` is false on production because `STRIPE_PRICE_REGISTERS` is not set in Vercel; the pricing and account pages branch on it, the home and result pages (batch 45 item 9, D-2001) do not. **Severity:** major. **Fix:** (code) every page that names the subscription branches on `subscriptionAvailable()`, with one shared sentence for the off state and a spec that renders both states; (ops, Haider) create the registers Price in Stripe test mode and set `STRIPE_PRICE_REGISTERS`; (REQ-022) this is exactly the FR-1 "payments" row, so the switchboard would have caught it.
2. **Where:** the public suite as a launch check. **Seen:** against production, `home-v2.spec.ts:29` expects the "In development" badge; `req-014.spec.ts:74` treats the site's own origin as an external load (the filter strips only `http://localhost`); `legal-pages.spec.ts:72` walks every route inside one test and exceeds 60 s. **Expected:** REQ-022 FR-2 says `launch-check.mjs` is the outside check; the suite should at least be honest about what is environment-bound. **Severity:** minor. **Fix:** skip the badge assertion when `PLAYWRIGHT_BASE_URL` is https, filter same-origin loads, and give the route walk its own timeout or one test per route; then the suite is a second launch check for free.
3. **Where:** `home.spec.ts:15`, first Tab lands on the skip link. **Seen:** failed once on desktop against production ("element(s) not found"), passed alone. **Severity:** minor, unverified (hydration timing over a real network rather than the link). **Fix:** none yet; the dev's trace-on-failure rule applies if it recurs in FR-2 runs.
4. **Where:** `/path/audit-day` (signed-out, redirects to sign-in). **Seen:** one request took 25 s and timed out at my client; the next two answered in 0.5 s. **Severity:** minor, observation (a cold start). **Fix:** `smoke.mjs` records time-to-first-byte per route so a cold start is a number, not an anecdote; the REQ-010 budget job covers the warm path only.
5. **Where:** `/documents` and `/checklist` signed out, no JavaScript. **Seen:** HTTP 200 with "Loading your documents..." / "Loading your checklist..." and nothing else; `/registers` and `/account` answer 307 to sign-in. **Severity:** minor. **Fix:** the same server-side redirect for the two client-gated pages, so a crawler or a no-script reader never sees a spinner.
6. **Where:** any unknown URL. **Seen:** Next's default "404: This page could not be found." twice, no header, no link home. **Severity:** minor. **Fix:** `not-found.tsx` with the site shell, one sentence and links to the start page and the guides.

Nothing found in: security headers and CSP (spec green on production); health route; admin and job routes 404 for anonymous visitors; CSRF and abuse spec; sign-in page; questionnaire specs (all three a11y specs green on production on both projects); guides spec; writing-indicator spec; mobile layout (no sideways scroll on seven pages at 360 px).

## 2 of 7: Product manager (does it sell honestly, is the story one story)

1. **Blocker for a trial:** the subscription is sold on the home page and the result page and declared "not available yet" on the pricing and refunds pages (QA 1). A reader who follows the home page's "Refunds" link lands on "The audit-ready subscription (when available)". One root cause, one fix; until it is fixed the home page overstates.
2. **Major:** `/about` section 2 still reads "[Name and ABN to be added when registered.]" Batch 45 item 1 removed the placeholder from the home page only. **Fix:** the same `businessName()`/`businessAbn()` branch on the About page and in any legal page that names the party; REQ-022 FR-13 then asserts it end to end.
3. **Major:** the Contact link in the footer is a personal Gmail address. Right for today, wrong for a customer paying AUD 399; REQ-022 Session B gives the domain address. **Fix:** no code now; the launch gate (D-2202) carries "contact address is on the domain".
4. **Major:** `/pricing` "How the drafts are made" says "Vague wording and leftover blanks are rejected before a document reaches you", and the sample on the home page carries three "[Provider to complete: ...]" markers, "[name], [role]" and "[Easy Read version]". Both are true in their own sense (blanks the checker cannot fill are marked, not hidden), but a careful reader sees a contradiction on the first scroll. **Fix:** "Vague wording is rejected before a document reaches you; the facts we cannot know are marked for you to complete, never left blank."
5. **Minor:** `/guides/registers-an-auditor-asks-for` twice says a corporate risk register "is being added to Readyline's registers". A promise about the future on a public page; CLAUDE.md 4.2. **Fix:** say what exists today, add the sentence when it ships.

Nothing found in: the price (AUD 399, one-off, no GST line, the refund promise in the same words on `/`, `/pricing`, `/refunds`); the two halves of equal weight on `/pricing` (D-2001) read well; "What it is not" is the best paragraph on the site.

## 3 of 7: Field specialist (a sole trader on a phone)

1. **Would get it wrong:** reads the home page on the phone, decides the registers at AUD 39 a month are the reason to sign up, taps Pricing, reads "not available yet", and now does not know which page to believe (QA 1).
2. **Annoying:** a mistyped link gives a bare "404" with no way back but the browser button.
3. **Annoying:** the home page is 13,400 px tall at 360 px because the whole sample document is inline; "Show the other 13 sections" helps, but the top half of the sample (document control, plain words, Easy Read placeholder) still takes four screens before "What you can count on". **Fix:** collapse the sample to its first two sections by default on phones.

Nothing found in: the hero reads in one screen at 360 px with both buttons above the fold; the "Free, about ten minutes, no account needed" line; the start page's five-step list and the "do not enter any participant's details" warning; the sign-in page's one field and one button.

## 4 of 7: NDIS domain expert (is it right, is it sourced)

1. **Unsourced/imprecise (privacy):** `/privacy` section 5 says of Anthropic "We send it your questionnaire answers and the fixed text of the document" and nothing about where that processing happens; the Stripe line in the same section does say "may process data outside Australia". APP 8 and APP 1.4(g) want the likely overseas country named. `/about` section 5 then says "Where your data lives: In Australia, in Sydney." **Fix:** one sentence on the Anthropic line naming the United States, and the About line reads "Your account and your documents live in Sydney; the model that drafts them and the payment provider process requests overseas, see the Privacy policy." Add to `product/legal/questions-for-the-lawyer.md` (REQ-022 FR-12).
2. **Imprecise (observation):** the home page's "Hosted in Australia" and "Your business details stay in an Australian data centre" are true of the database and the app; they sit two screens below a sentence about AI drafting. Same fix as 1.

Checked and clean, unverified against the Commission's site today (ndiscommission.gov.au was not fetched in this review): the Commission's phone 1800 035 544, TTY 133 677, interpreter 131 450 in the sample; the three guides' statements about verification and certification, the mid-term audit and the two Rules named by title; the trade mark line.

## 5 of 7: NDIS provider (could I buy and use it today)

1. **Could not:** subscribe to the registers from production; the button is not offered (QA 1). Everything the result page promises about "what keeps you audit-ready" is not purchasable today.
2. **Would get it wrong:** reads the sample document, sees "[Easy Read version]" under "We keep an Easy Read version of the summary above with this document", and believes the pack ships one. Nothing on the page says the Easy Read version is the provider's to make. **Fix:** the fixed text says "You keep an Easy Read version of the summary with this document (one idea per line, a picture for each, large print); Readyline does not draft it", or the pack includes one.

Nothing found in: the refund promise ("When we are not sure, we decide in your favour"); the GST sentence; the "Buying the pack does not mean you will be registered" sentence; the pack list on `/pricing` (15 documents named).

## 6 of 7: NDIS auditor (would the documents stand up)

1. **Minor NC (if adopted as is):** a policy that states "We keep an Easy Read version" with a bracketed placeholder is a statement the provider cannot evidence (provider 2). The adopt step should refuse adoption while any "[...]" marker remains, or the sentence must not promise the artefact.
2. **Observation:** the sample's "In plain words" section still reads "Generic text: add your details." (14 Oct QA finding 2; the plain-language fixtures wait for the recording key). Still the first tailored section an auditor reads.
3. **Observation:** the sample's document control shows Approver "[name], [role]" and Approval date "[date]" with Next review already computed to 13 October 2027; a reviewer would expect the next-review date to follow the approval date, not the draft date. **Fix:** compute next review from the adoption date at adopt time (if REQ-018 adopt already does this, the sample should show an adopted document, not a draft).

Nothing found in: the change log; the related documents section; the fixed retention and complaints sections as rendered in the sample.

## 7 of 7: NDIS Commission (what would the regulator ask)

1. **Would ask:** the overseas disclosure (domain 1).
2. **Would ask:** the marketing sentence about blanks (manager 4), under the honest-marketing rule the business sets itself.
3. **Would note:** the About page's bracketed placeholder on a page that explains who runs the service (manager 2).
4. **Would note, clean:** "Independent of the NDIA and the Commission", "not an approved quality auditor and never will be", "no referral fees", and the trade mark line are present on every route's footer; the no-participant-data statement is on the home page and the start page.

## Comparison with 14 October

Fixed on production: the home page placeholder (14 Oct QA 8; now only on About); the audit-day group order and the ask words (QA 3, 4; signed-in, trusted to the green guided-path spec in PR #56's run, not seen); the account page's register sentence (QA 5; signed-in, same); the result page count sentence (QA 6; same); the price-span space (QA 7; visible text now "AUD 399 one-off"); the registers intro (QA 9; signed-in); the evidence set (QA 13). Still open: the plain-words fixtures (QA 2, auditor 2 above; waits for the recording key); the Commission's reportable incidents page URL (batch 45 item 20, unverified). New today: the subscription story (five roles), the About placeholder, the Easy Read promise, the overseas disclosure.

## Not covered, and how to cover it

The registers (incident, complaint, worker check with the new clearance number), the audit pack, the worker role, the auditor link, the import, the guided path and adopt, the purchase in fake mode, and `/account` are signed-in. Two ways, either is fine: (a) Haider signs in on production in the Claude browser pane with a test address he owns (magic link, his click), and the PO walks every signed-in page on desktop and 360 px the same afternoon; (b) the Dev runs `.claude/skills/role-review-pipeline` on a local stack at fe325d2 with the fixture tenants for the signed-in half only, writing to this folder as `dev-signed-in.md`. The PO prefers (a) for the registers and the auditor link (they are what a real auditor sees) and (b) for the pack (fixture render, no model call).

# Pull request: batch 47, the public-surface fixes from the role reviews of production fe325d2

Base: `next`. Head: `batch-47-public-review-fixes` (stacked on `req-022-launch-readiness`; the diff collapses to batch 47 once Session A is merged into `next`). Compare link: https://github.com/haideralii/readyline/compare/next...batch-47-public-review-fixes?expand=1

Title: `Batch 47: one subscription story, no placeholders on public pages, the Easy Read sentence, the overseas line, and the small ones`

---

## REQ

Batch 47 (`product/NEXT.md`, "## Batch 47", from `product/qa/role-reviews/2026-10-15/po-review.md`). Decisions D-2211, D-2212, D-2213 (Dev) in `DECISIONS.md`. Base branch: `next` (D-2205).

## What changed

1. One subscription story. `SUBSCRIPTION_OFF` ("The registers subscription is not switched on in this environment.") is the one sentence; the home page, the result step (the server page passes `subscriptionAvailable()`), the pricing page and the account page branch on it; the refunds and terms pages branch through runtime tokens in the legal markdown (`{{subscription-off}}`, `{{#subscription}}…{{/subscription}}`, D-2213) and no longer say "when available". `e2e/subscription-story.spec.ts` asserts the on state on home, pricing, refunds, terms and the result page; `e2e/subscription-off.spec.ts` asserts the off state on the same pages and runs in its own CI step with `STRIPE_FAKE=0` and no Stripe values (the state production shows until `STRIPE_PRICE_REGISTERS` is set). `playwright.config.ts` honours `STRIPE_FAKE` from the environment. The pricing page says "No instalments, no interest, no late fees." in both states.
2. No bracketed placeholder on a public page: About, Terms and Privacy carry `{{business-line}}`, filled with the home page's registered-name sentence once `BUSINESS_NAME` and `BUSINESS_ABN` are set and removed before; the copy lint bans "[… to be added" in page copy; `src/lib/legal/tokens.test.ts` refuses it, "when available" and any unknown token in the legal pages as written.
3. The Easy Read fixed text reads "You keep an Easy Read version of the summary above with this document: one idea per line, a picture for each idea, large print. Readyline does not draft it." and the "[Easy Read version]" callout is gone (sample document and three skeleton snapshots updated). Adoption did not refuse on a remaining marker; it now refuses a group while Finish-form blanks are open (D-2211), never on the signed copy's own marks (signature, date reported), which would have blocked every pack.
4. Privacy section 5: "Anthropic processes our requests in the United States."; About section 5 as the PO wrote it; the About, Privacy and Terms pages' "Last updated" is 15 October 2026.
5. Pricing, "How the drafts are made": the sentence as the PO wrote it.
6. The registers guide's "is being added" cells say what exists today (staff matrix, corporate risks, insurances and vehicles, document control, record of decisions, participant risks, conflicts of interest, delegations, improvements, onboarding checklists).
7. `/documents` and `/checklist` answer 307 to `/sign-in?next=` without a Supabase session cookie, from the proxy (D-2212), so the loading UI stays for the signed-in load; unit tests on `needsSessionRedirect`, a public e2e on the status and location.
8. `src/app/not-found.tsx` in the site shell: "That page is not here.", links to `/start` and `/guides`; `e2e/not-found.spec.ts`.
9. `home-v2.spec.ts` expects no development badge on an https base; `req-014.spec.ts` filters same-origin by the test's base; `legal-pages.spec.ts` budgets its route loop; `LAUNCH.md` step 21 runs the public suite against the domain as a second launch check. The questionnaire fill helpers moved to `e2e/helpers/questionnaire.ts` (`reachResult`) so the subscription specs reach the result page the same way.

## Security checklist (REQ-002 FR-7; tick or explain)

- [x] No new route handler or server action; the adopt action gained a refusal before any write. The proxy's redirect reads only the request path and cookie names.
- [x] No secrets, tokens or `.env` files in the diff; no new environment variable.
- [x] No log change.
- [x] Security headers and CSP unchanged (the redirect response carries no CSP; the page it leads to does).
- [x] No new external origin; no new dependency.
- [x] No customer or participant data: the legal tokens carry the business name and ABN the owner set in Vercel.
- [x] Tenant data: unchanged.

## Tests and evidence

- `npm run check`: green on the branch head (120 files, 860 tests, 6 skipped).
- Local Playwright against a production build: the touched public specs (`not-found`, `subscription-story`, `admin`, `questionnaire`, `home-v2`, `req-014`, `legal-pages`) on desktop-chromium and android-small in fake mode, 60 passed, 4 skipped; `subscription-off` against a server with `STRIPE_FAKE=0` and no Stripe values, 2 passed.
- The CI run on the pull request: public job (both subscription states), Supabase job (the guided path adopts after Finish, so D-2211 is exercised).
- Not run locally: the signed-in specs.

## Claims, brand, privacy

- [x] New copy passed `findProhibitedClaims` and the copy lint (the new "to be added" rule included); Australian spelling; no "coming" or "soon".

🤖 Generated with [Claude Code](https://claude.com/claude-code)
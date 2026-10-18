# REQ-022 Session D: the lawyer's bundle and the business identity end to end

PR into `next`, branch `req-022-session-d` from `next` 4ddf51b. Dev-1, 18 Oct 2026. Head: 92986e6.

## What this PR does

- **FR-11, the lawyer's bundle (D-2288).** `scripts/ops/legal-bundle.mjs` (`npm run legal:bundle`) writes `product/evidence/req-022/legal-bundle-<date>.md`: the FR-12 questions at its head (every "N.N" line of `product/legal/questions-for-the-lawyer.md`, the text before the role's "Read:", under their headings), then the thirteen entries in FR-11's order, each with its URL or committed path and a "Last updated" date: the five legal pages (front-matter dates), the AI and digital tools appendix (fixed text in `fixed-extras.ts`, rendered in the committed privacy policy), the Anthropic Commercial Terms with the date read and the clause as read ("Effective June 17, 2025"; section B: may not train models on Customer Content), the refund promise's two sections verbatim as `/pricing` and `/documents` read them, the pricing page, the sign-in and account-setup screens, the worker invitation and reminder templates (listed by name and file), and the committed REQ-005 sole-trader set (16 `.docx` and `sections.md`). A code surface's date is the last commit that touched its files (git); the test stubs that. No PDF, no browser, no server, no model, no customer data. The runner refuses to write an index that carries a fixture account's address or an unfilled token. `--base` is optional while the domain is unregistered; the committed index carries the site paths and says how to rebuild with the domain. Today's index is committed, so the privacy and AI pages' "as read on" sentence now says 18 October 2026 (D-2258, `vendor-terms.ts` reads the filename).
- **FR-13, the business identity (D-2289).** `e2e/business-identity.spec.ts` on the three projects, both halves of AC-7 in one file chosen by the environment: set, the same "It is registered as <name>, ABN <abn>." on the home mission, About, Terms and Privacy, "(ABN …)" in the footer of every public page, and the ABN in the home page's Organization structured data; unset, no placeholder, half sentence or ABN on any of them. CI's full run keeps the two unset; a new step runs the spec with fixture values (name "Fixture Supports", the ATO's example ABN 51 824 753 556); `playwright.config.ts` passes the two to the server only when the run sets them. Every page renders per request, so one build serves both states.
- **CI.** Two steps after the subscription-off step: the identity spec with the fixture values; the bundle built into `$RUNNER_TEMP` (AC-6's no-address rule at the point of writing).

## Not in this PR, and why

- FR-13's "invoice-style purchase confirmation": the app has no such screen. The receipt is Stripe's (REQ-007 FR-7; D-2843 says the app sends none) and the documents page links to it; the name and ABN on it come from the Stripe account's public business details, a dashboard setting. Runbook line for the PO: set them to the registered name and ABN before live mode. If an in-app confirmation naming the party is wanted, it is a new REQ line (D-2289).
- FR-12 is the PO's file; the index links it and lists its questions.
- The email templates are listed, not rendered, in the index (D-2288 (2)).

## Verification

- `npm run check`: green, 178 files, 1,308 tests.
- From the main tree's production build of the head: `business-identity`, `legal-pages` and `health` on the three projects with the variables unset; `business-identity`, `home-v2` and `legal-pages` with `BUSINESS_NAME` and `BUSINESS_ABN` exported: unset, `business-identity`, `legal-pages`, `health` on the three projects: 13 passed, 5 skipped (the set case); set, `business-identity`, `home-v2`, `legal-pages`: 18 passed, 5 skipped (the unset case); both green, no retries.
- The unit test builds the index against the repository: 13 entries in order, 40 questions at the head before the bundle, the vendor clause and read date, the refund paragraphs verbatim, no fixture address, no token, no claim word in the index's own words, the path form without `--base`.
- AC mapping: AC-6 `scripts/ops/legal-bundle.test.ts` ("the index built from this repository") and the CI bundle step; AC-7 `e2e/business-identity.spec.ts` (both cases) on the three projects, the set half in its own CI step.

## Evidence

- `product/evidence/req-022/legal-bundle-2026-10-18.md` (the index itself).
- This file at `product/evidence/req-022/pr-body-session-d.md`; D-2288 and D-2289 in `DECISIONS.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

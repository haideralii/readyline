# REQ-012: Launch readiness review: the security re-test, the accessibility audit, the claims and sources audit, and the performance budgets, as repeatable checks
Status: ready for Session A (PO, 18 Oct 2026 17:15; lawyer's and NDIS expert's reads applied as D-2905 to D-2913, D-2222)
Phase: 6   Priority: must   Owner: Dev-2
Depends on: REQ-002, REQ-004, REQ-010, REQ-015, REQ-022, REQ-029 A and REQ-030 (#112, #115 merged first)

## Why (user and business outcome)

The threat model promises a review at every phase gate. The accessibility pass, the claims lint and the mobile budgets exist, but each was written for one page, and much has been built since the 14 October ASVS re-check. This REQ makes the review scripts and tests that stay, so the next review is a run.

## Scope (in / out)

In: two sessions for Dev-2, each delivering (a) scripted checks that run in CI or on demand against a local production build and (b) one dated report under `product/qa/launch-review/<date>/` in the live-QA shape (a table per check: `#`, status, page, what was done, measured, evidence), plus fixes as separate commits with tests.

Out: the OWASP ZAP baseline scan (needs the domain; a backlog row after LAUNCH.md section 5), the restore rehearsal itself (REQ-030), copy beyond the fixes a check names, and any production run beyond SR-3.

## Domain rules that apply

`CLAUDE.md` 4.2, 4.3 and 4.6 (prohibited wording, honest claims, sourced facts); section 5 (no pressure, no dark patterns); `product/domain/ui-copy.md`; the threat model.

## Functional requirements

### Session A

- FR-1 **Security re-test.** (a) Every row in `product/security/asvs-l1-check-2026-10-14.md` re-verified against `next`, each gaining a `file:line` for the control and the test that keeps it; a row whose evidence moved or broke is `Gap` with the fix commit. (b) New rows for everything built since the re-check: REQ-020 to REQ-028 where the file has none, REQ-022 Sessions B to E (SMTP mail, the unsubscribe token, the switchboard, the domain and HSTS steps), `/api/health`, REQ-029 Session A (#112) and REQ-030: Sentry server-side only through `src/instrumentation.ts` and `src/lib/ops/sentry.ts` (no browser SDK, no CSP change; the row proves no email, free text or token reaches an event), the uptime route `src/app/api/jobs/uptime/route.ts` (its secret gate and limiter), the runbook `product/ops/INCIDENTS.md` (secrets by name only), and the weekly backup workflow with its restore rehearsal from #115 (the encrypted copy, the key holder, the 90-day retention, D-2872). (c) `npm audit --omit=dev` at every level: clean, or each advisory ruled. (d) `scripts/ops/check-headers.mjs --base <url>`: for every route class (content page, questionnaire, sign-in, guide, legal page, 404, API route, auditor page, report page, worker home, register page) compares the response headers to an expected-values table in the script (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, no `X-Powered-By`; CSP with a nonce and `strict-dynamic`, no `unsafe-inline`, `frame-ancestors 'none'`, `form-action` with the Checkout origin on the purchase route only). In CI against the production build; on demand against a URL. (e) `tests/integration/rate-limits.test.ts`: each limited route or action allows hit n-1 and refuses hit n, from the constants in `src/server/auth/rate-limit.ts` (magic link 5 per email and 20 per IP an hour; export, checkout and imports 5 an hour; register writes 60 a minute; fills 10 an hour; auditor open 60 an hour; reports 10 an hour and 50 a day; the per-instance limiters, D-424). (f) RLS coverage: a unit test reads every migration, lists every table with an `account_id` column (about 47 on `next`) and fails when any lacks a cross-tenant read, a forged insert and a cross-tenant update case in `tests/integration/*`; the report lists the table-to-test map. (g) `.gitleaks.toml` and `.gitleaksignore`: each allow-list entry and fingerprint justified or removed.
- FR-2 **Dependencies and supply chain.** `npm ci` from the committed lockfile is clean (`git status` empty after). Every `uses:` in `.github/workflows/*.yml` pinned by commit SHA with the version in a comment, or the tag kept with one line of reason (`supabase/setup-cli@v1` pins the CLI version, D-038). The open Dependabot pull requests #53, #54 and #55 (the `origin` branches are `actions/checkout-7`, `actions/setup-node-7`, `actions/upload-artifact-7` and `gitleaks/gitleaks-action-3`; the Dev maps numbers to branches, question 4), each triaged: merge, or close with the reason; a major read against its release notes first.

### Session B

- FR-3 **Accessibility audit.** (a) `e2e/launch-review-a11y.spec.ts`: axe at WCAG 2.2 AA (D-2912; `wcag22aa` in the tag set, the level in the report header) on every public route and, in the Supabase job with the fixture account, every signed-in route (checklist, documents, a set and its start-here page, account, the registers and forms, the audit pack view, the worker home, the invite and report pages) at 360, 768 and 1280 px and at 200 % text (`setTextZoom` in `e2e/helpers/width.ts`), both colour schemes: zero violations, or each ruled by axe rule id. (b) A scripted keyboard pass on the questionnaire, the account page, each register list and form, and the worker home: every interactive element reached by Tab in order, focus visible (asserted on computed style), no trap, Escape closes what Enter opened. (c) REQ-015 FR-18's screen-reader walks as two scripts in the report folder, `nvda-walk.md` (PO) and `voiceover-walk.md` (Haider): page, steps, what should be announced, a blank column for what was heard. Not CI.
- FR-4 **Claims and sources audit.** (a) `src/lib/claims.ts` (`PROHIBITED_CLAIM_RULES`, `findProhibitedClaims`; the plain-language rules sit in `src/lib/copy-lint/rules.ts`) re-read against `CLAUDE.md` 4.1 to 4.4 and extended with the rules in D-2905 and D-2906, each with a passing descriptive fixture and a failing one in `src/lib/claims.test.ts`. (b) `scripts/ops/extract-fact-sentences.mjs` walks the files the copy lint walks and prints every public sentence carrying a number, a date, a dollar amount, a time frame (the D-2905 time class), a hedge word (D-2911) or an instrument name (Act, Rules, Guidelines, Practice Standards, a section). The Dev maps each into `claims-and-sources.md` with D-2907's columns; a sentence with no source is `UNVERIFIED`, listed first. These facts are checked first, against the instrument (D-2908): no application fee (ABLIS-sourced, caveat kept); the mid-term audit "no later than 18 months" (Rules s 13B) against the guides' "about 18 months"; the 14 and 28 day report deadlines (no source id today); stage 2 within 3 months of stage 1 (no source today); the registration period of three years (Act s 73E, "usually"); the worker screening clearance of five years and the 90-day renewal window; the reportable incident 24 hours and 5 business days (Incident Management Rules s 20, s 21); the 60-day portal deletion. D-2909's wording fixes follow, through D-2222. (c) `scripts/ops/check-source-links.mjs`: every off-site link in the guides, the legal pages, `data/SOURCES.md`, About and AI answers 200 (one redirect followed, the final URL recorded); on demand. (d) A source past its read cadence (D-2910; third-party prices 30 days, D-2906) on the report date is flagged to re-fetch (`standards:verify` keeps the hashes; this flag is about age); the vendor-terms read date (`src/lib/legal/vendor-terms.ts`) and the legal pages' `updated` dates join the table.
- FR-5 **Performance.** The `performance-budget` job and the signed-in documents step lose `continue-on-error: true` and the "advisory" words (D-1013's flip, due 21 October). The report states budgets per page class with the current measured values: public content (`/`, `/pricing`, a guide), questionnaire (`/start`, `/start/business`), signed-in (`/documents`, `/registers`, the worker home), for LCP, CLS, total transfer bytes and TTFB (the script gains the last two from Lighthouse's `resource-summary` and `server-response-time` audits) beside the existing performance 90, LCP 2,500 ms, CLS 0.1 and 250 kB of questionnaire JavaScript. A page over a budget by more than 10 % is fixed in its own commit or ruled with a revisit date.

## Security and privacy requirements

- SR-1 No report, script output or fixture carries a secret, a key fragment, a real address or a person's name; the reports use the fixture accounts and the hashed or coded values the product already shows; authors and signatures are roles, URLs lose their query strings, and a git-log author check proves it (D-2913).
- SR-2 The rate-limit, RLS and signed-in axe runs use the local Supabase stack and throwaway tenants.
- SR-3 The re-test never runs against production, except the read-only header script (FR-1d) and the link script (FR-4c): GET only, no body stored.
- SR-4 A fix that loosens a header, a limit or a policy is refused by its own test.
- SR-5 The extractor reads source files only, never a database or a log.

## Data (entities, fields, retention)

No new tables. Reports and outputs are files under `product/qa/launch-review/<date>/`. The header table and the budgets live in the scripts, so a change is a reviewed diff.

## Acceptance criteria

- AC-1 Given the ASVS file, when Session A ends, then every row carries `file:line` and a test name, every REQ-020 to REQ-030 control has a row, and no `Gap` row lacks a fix commit or a dated ruling. Proof: the file diff; `npm run check` green.
- AC-2 Given a production build, when `check-headers.mjs` runs, then every route class matches the table and it exits 0; given one header changed, then it exits 1 naming the route and header. Proof: the CI step; a unit test.
- AC-3 Given the local stack, when `rate-limits.test.ts` runs, then each limited key allows hit n-1 and refuses hit n with the plain message or 429. Proof: the test output.
- AC-4 Given a migration adds a table with `account_id` and no RLS test names it, when `npm test` runs, then the coverage test fails naming the table. Proof: the test; a throwaway red run cited.
- AC-5 Given `npm audit --omit=dev` at any level, when Session A ends, then the output is clean or every advisory carries a ruling. Proof: the output.
- AC-6 Given the workflows, when `scripts/ci/workflows.test.ts` runs, then every `uses:` is a SHA or carries a reason comment. Proof: the test; the Dependabot rulings.
- AC-7 Given every public and signed-in route at the three widths and 200 % text in both schemes, when the axe spec runs, then there are zero violations or each has a ruling. Proof: the spec in CI; the table.
- AC-8 Given the questionnaire, account, registers and worker home, when the keyboard spec runs, then every interactive element is reached, focus is visible and no trap is found. Proof: the spec.
- AC-9 Given the extractor's sentences, when the claims report is written, then each is mapped to a source id and fetched date or marked `UNVERIFIED`, `UNVERIFIED` first, both counts on the first line. Proof: the report; a unit test over fixtures.
- AC-10 Given the link script, when run on demand, then every off-site link's final status is listed and any non-200 named. Proof: the output file.
- AC-11 Given a source past its D-2910 cadence, or a third-party price older than 30 days, then its row is flagged. Proof: a unit test with a fixed date per kind.
- AC-15 Given each D-2905 and D-2906 rule, when its fixtures run, then the descriptive sentence passes and the promise fails; and the public copy passes the lint or each hit has a D-2222 fix. Proof: `claims.test.ts`; the lint run.
- AC-16 Given the claims table, then every row carries the D-2907 columns, the eight D-2908 facts carry their instrument or `UNVERIFIED`, and every hedge sentence (D-2911) is sourced or reworded. Proof: the table; a unit test over the columns.
- AC-12 Given `ci.yml` after Session B, when a page is over budget on a pull request, then the job fails; and three consecutive runs on `next` are green. Proof: the diff; the run links.
- AC-13 Given the budget table, then every page class shows LCP, CLS, bytes and TTFB against its budget, and any over by more than 10 % has a fix commit or a ruling. Proof: `out/lighthouse-budget.txt`.
- AC-14 Given the report folder, when `gitleaks`, the participant-data detector and the git-log author check run over it, then nothing is found. Proof: the outputs.

## Test expectations

Unit: header comparison, RLS coverage, workflow pins, the extractor, the cadence flag, each claims rule, the table's columns. Integration: rate limits. E2E: the axe and keyboard specs on three projects; the header script in CI. Manual: the screen-reader walks.

## Evidence required on delivery

`product/qa/launch-review/<date>/session-a.md` and `session-b.md` in the live-QA table shape; the scripts' outputs; the ASVS file diff; the Dependabot decisions; the three green budget runs; the claims-and-sources table; CI green.

## Questions for Dev to answer before building

1. **axe at 200 % text.** (a) `setTextZoom` (root font size, as REQ-015 does), (b) CDP `Emulation.setPageScaleFactor`, (c) both. Recommendation: (a); the layout rules target root font size and WebKit has no CDP; browser zoom is the manual walk's job.
2. **Can the budget job block without flaking?** (a) median of three as now, (b) median of five with one retry of the job, (c) block the public pages only. Recommendation: (b), retries printed in the report; a flake rate over one in ten in a week comes back to the PO.
3. **The sentence extractor's precision.** (a) regex on digits, month names, `$`, the time and hedge classes, instrument words, (b) a part-of-speech pass, (c) regex plus an allow-list of noise sentences. Recommendation: (c); print precision (mapped over found).
4. **The Dependabot majors.** `actions/upload-artifact` v7 and `gitleaks/gitleaks-action` v3: (a) merge on green, (b) merge after reading the release notes (artifact naming; the licence-key change), (c) close and pin v4 and v2 by SHA. Recommendation: (b) for both (nine `upload-artifact` uses; REQ-002 Q2's licence note re-checked); `checkout` and `setup-node` read the same way; state the PR-to-branch map.

## PO decisions

- **D-2899** The review is repeatable, not one-off: every check is a script or a test that stays in the repo; the dated report is its output, never its substitute.
- **D-2900** The ASVS target stays as set: `product/security/threat-model.md` names Level 2 as the target, and REQ-002's re-check of 14 October verified at Level 1. This review re-verifies at Level 1 and lists the unmet Level 2 rows as gaps, without closing them.
- **D-2901** The budget job becomes blocking at Session B's end (D-1013's flip), public pages and the signed-in step alike unless question 2's numbers say otherwise.
- **D-2902** Dependabot: patch and minor updates merged on green by the PO; majors ruled by the Dev's reading in the report, one line each.
- **D-2903** The claims audit's output is a table the lawyer role reads next; any wording change goes through D-2222, never straight to the page.
- **D-2904** The screen-reader walks are Haider's live items (VoiceOver on iPhone), the PO's NVDA walk recorded separately in the same folder; neither blocks the merge, both block launch.
- **D-2905 New claims rules (PO, 2026-10-18; lawyer's read L1, L3, L4).** `src/lib/claims.ts` gains, each with a passing descriptive fixture and a failing one: `(?:fully\s+)?compliant\b` as a promise about the customer; `certif(?:ied|ies)\b` outside "certification audit"; `audit[\s-]?ready\b` as a promise; `ensures?\s+(?:you|your)`; `will\s+pass`; `ready\s+to\s+register`; a `free-with-fee` rule that fails "free" within 40 characters of "pack", "subscription", "trial" or a dollar amount. The extractor gains the time class `\b(?:in|within|under)\s+\d+\s+(?:minutes?|hours?|days?)`, so any such sentence needs a source or an `UNVERIFIED` row.
- **D-2906 Comparative and price rules (L2).** A rule for `cheaper|cheapest|better than|unlike other`. Every third-party price in the guides (`content/guides/ndis-registration-cost.md` names five competitors) carries its read date in the sources audit, flagged at 30 days.
- **D-2907 The claims table's columns (L5, L8, N1, N7).** Sentence (verbatim); route and `file:line`; claim type (regulatory fact, price, time, comparative, outcome, AI disclosure); primary instrument cited (a fact sourced only to a Commission web page is `VERIFIED-SECONDARY`); source id and URL; source version label; fetched date; read-by (role); last lawyer read date for the legal pages; stale-on date for dated facts (the SIL 1 October 2026 deadline, the 1 January 2027 platform conditions, s 13BA); status `VERIFIED`, `VERIFIED-SECONDARY`, `UNVERIFIED` or `CHANGED`; `UNVERIFIED` first.
- **D-2908 The facts checked first (N1).** The eight facts in FR-4b, against the instrument named there, before the long tail.
- **D-2909 Three wording fixes (N2, N3, N4).** "Start preparing 12 months in" is reworded to "we suggest" or cited. Screening fees are marked state-sourced with the unit named, and nothing attributes a fee schedule to the Commission. The verification and certification sentences are checked per class, and any "lower-risk groups get verification" sentence carries "any higher-risk group makes the whole registration certification" in the same sentence.
- **D-2910 The read cadence replaces the flat 90 days (N5).** Commission reform and apply pages 30 days; Practice Standards module pages and PDFs 90 days; legislation.gov.au compilations on each watch-changes run and every REQ-023 batch; the `standards:verify` hashes trigger a re-read regardless of age.
- **D-2911 Hedge words (N6).** The extractor gains a hedge-word class ("most providers", "usually", "typically", "in practice", "auditors expect", "auditors look for", "a key part", "the Commission suggests"); each such sentence maps to a source or is reworded in the copy as "sector practice, not a rule".
- **D-2912 WCAG 2.2 AA is the targeted level (L6).** Recorded in the report header and the axe tag set; the repo's older 2.1 AA mentions (`CLAUDE.md`, REQ-013) are amended to 2.2 AA in one docs commit. `UNVERIFIED` as a legal requirement; the defensible floor for a product sold to disability-sector businesses.
- **D-2913 Reports carry roles, not people (L7).** Author fields by role only; the manual walks signed by role; final URLs stripped of query strings; a git-log author check over the report folder, so names and emails never appear.

## Dev response

**Dev-2, 18 Oct 2026 (Session B), on `req-012-session-b` from `next` b14206d.** Session A's response above stands; questions 1 to 3 taken as recommended: 1 (a) the root font size through `setTextZoom` (REQ-015's way; WebKit has no CDP), 2 (b) the median of five with one retry of the job, retries printed in the report, 3 (c) regex plus an allow-list of noise sentences with precision printed. D-2939 read: Dependabot stands under D-2902.

**Order, one commit each, `npm run check` before each push, `next` merged first (D-2827).**

1. ASVS row 4 (the PO's 21:50): `src/server/supabase/server.test.ts`, the session cookie flags asserted on the adapter (HttpOnly, SameSite=Lax, Secure exactly when the site URL is https, D-2344), so no re-verification row is without a test; the row's test cell updated once `next` carries the table.
2. FR-3a, public: `e2e/launch-review-a11y.spec.ts` with `e2e/helpers/launch-review-a11y.ts` (the WCAG 2.2 AA tag set, the three widths, the two schemes, the rulings map); the routes from `/sitemap.xml` plus the pages the sitemap leaves out and the 404; zero violations of any impact or a ruling by rule id; the iPhone project's `testMatch` gains the spec.
3. FR-3a, signed in: `e2e/signed-in/launch-review-a11y.spec.ts` in the Supabase job: a subscribed owner over the checklist, documents, account, every register list and `new` form, the audit-day and renewal pages, the audit pack view through a seeded auditor link, the worker home through a worker member, the invite and report pages through seeded tokens; the set and its Start here page through the guided-path spec's purchased set (the one spec that has one), which gains the same axe pass.
4. FR-3b: `e2e/launch-review-keyboard.spec.ts` (public: the questionnaire) and its signed-in half (the account page, each register list and form, the worker home): every interactive element reached by Tab in document order, a visible focus ring asserted on computed style, no trap, Escape closes what Enter opened, on REQ-015's `tabUntil` and `KeyboardWalk` helpers.
5. FR-3c: `nvda-walk.md` and `voiceover-walk.md` in the report folder, page by page, with a blank column for what was heard (not CI; D-2904).
6. D-2912: the docs commit amending the 2.1 AA mentions to 2.2 AA (`CLAUDE.md` section 8, REQ-003, REQ-008, REQ-013, the theme tokens' comment, the questionnaire a11y spec's comment).
7. D-2939: `.github/dependabot.yml` restored (npm in two groups and the actions, weekly, grouped, majors by hand) and re-verification row 17 set to Met, once `next` carries Session A.
8. FR-4: the D-2905 and D-2906 rules in `src/lib/claims.ts` with fixtures; `scripts/ops/extract-fact-sentences.mjs` with the time, hedge and instrument classes and the noise allow-list; `claims-and-sources.md` with D-2907's columns, the eight D-2908 facts first; D-2909's wording through D-2222; `scripts/ops/check-source-links.mjs`; the D-2910 cadence flag with the vendor-terms and legal `updated` dates; unit tests over fixtures for the extractor, the cadence and the columns.
9. FR-5: the budget job and the signed-in documents step lose `continue-on-error` and "advisory"; the budget table per page class with LCP, CLS, bytes and TTFB (the script gains the last two from Lighthouse's audits); a page over budget by more than 10 % fixed or ruled with a revisit date; three green runs on `next` cited.
10. The report `session-b.md` with the outputs beside it; the evidence block here.

**Assumptions, taken unless you say otherwise.**

- (a) The 38 registration-group pages share one template, so two take the full matrix (three widths, two schemes, 200 % text) and the other 36 one pass at 360 px in the light scheme; every other public route takes the full matrix. On the two phone projects the matrix is the project's own width, both schemes and 200 % text; the desktop project carries the three widths. Said in the spec and the report.
- (b) The signed-in axe spec runs in the Supabase job alone (D-2205: nothing drives the hosted auth from a laptop); its first run is the PR's.
- (c) The set and Start here pages are reached through the guided-path spec's purchased set rather than a seeded `version_sets` row, since the pages read storage objects a seed would have to fake.
- (d) The keyboard pass asserts the focus ring on computed style as REQ-015's helper does (outline or box-shadow on the element or, for a visually hidden input, its label).
- (e) FR-5's blocking flip lands at Session B's end as D-2901 says; until the three green runs are cited the job stays advisory on `next`.

**Estimate:** ten commits over three evenings; FR-4's table is the long one.

## Delivery evidence

**Session A (Dev-2, 18 Oct 2026)** on `req-012-session-a` c7f57c6 (from `next` 5d6cea7, merged forward to b14206d; PR to `next`; body: `product/evidence/req-012/pr-body-session-a.md`; report: `product/qa/launch-review/2026-10-18/session-a.md` with `headers-local-build.json`, `npm-audit.json`, `rls-coverage-map.md` and `check-report-authors.txt` beside it). Commits: 5578791 the Dev response; 1785a32 and 9ad2ec5 FR-2 (every `uses:` a commit SHA with its version, the lockfile asserted after `npm ci`, `workflows.test.ts`); 6517553 FR-1d (`check-headers.mjs`, its table and unit test, the CI step, `npm run headers`); c055884 FR-1e (`rate-limits.test.ts`, `memory-limits.test.ts`, `rate-limit-callers.test.ts`); 54216f6 FR-1f (`rls-coverage.ts` and its test, `account-tables.ts`, `rls-coverage-cases.test.ts` for the fourteen tables); a6cabc3 and c87abe4 FR-1g (the allow-lists justified, `gitleaks-config.test.ts`, the four D-2927 fingerprints); 12e8d00 FR-1a and FR-1b (the re-verification table, 99 rows, `asvs-recheck.test.ts`); bcf35ee and eac584d the merges of `next` with the two new workflows pinned and the shared parser; c7f57c6 the report, the author check, D-2347 and this block. No migration.

- AC mapping: AC-1 → the re-verification table and `asvs-recheck.test.ts` (101 assertions; one Gap row, Dependabot, pending the PO's D-2005 against D-2902 ruling); AC-2 → `check-headers.test.ts` and the CI step (13 route classes on the local production build); AC-3 → `rate-limits.test.ts` (the Supabase job on the PR); AC-4 → `rls-coverage.test.ts` (the `widgets` fixture names all three kinds) and `rls-coverage-cases.test.ts`; AC-5 → `npm-audit.json` (0 at every level, 18 Oct 2026); AC-6 → `workflows.test.ts` (30 `uses:` lines pinned) and the rulings in the report; AC-14 (the report folder) → `check-report-authors.txt` (0 hits) and the gitleaks scan on the PR.
- `npm run check`: green, 201 files (1 skipped), 1,534 tests, 6 skipped. The once-a-session public run (D-2319) was not repeated this session: the branch changes no page and no public spec; CI's e2e job on the PR is the proof.
- Decisions: D-2347 under "REQ-012 Session A (Dev-2)" in `DECISIONS.md`.
- For the PO: the Dependabot ruling (D-2005 or D-2902); the rule ids on the four new fingerprints (gitleaks' defaults, proven by the next `main` scan); the one ASVS row without a test (the session cookie flags, row 4), a Session B item.
- UNVERIFIED: the gitleaks-action v3 licence note against the v3 README (the API allowance ran out); the rule ids of the four fingerprints until the push scan runs on `main`.

## PO review

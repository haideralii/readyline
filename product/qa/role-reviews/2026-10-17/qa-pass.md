# QA pass over `next` at 641c667 (merge of PR #81)

Run by the PO's QA role on Haider's ask of 17 Oct 2026 ("ask our QA agent to do the testing after the fixes and share his findings"), over `next` at 641c667 (the merge of #81). Screenshots and logs stay in the QA folder; the findings cite files and lines.

Date: 17 Oct 2026 (Sydney). Build: `origin/next` 641c667, detached checkout at
`<a local working copy>`.
Cloud container only; no production, no sign-in, no accounts, no Docker/Supabase.
Screenshots: `<qa folder, not committed>/shots/`.
Raw logs: `<qa folder, not committed>/logs/`.
Scripts used: `explore.mjs`, `explore2.mjs`, `explore3.mjs`, `axe.mjs`, `axe2.mjs` in the `qa-pass` folder.

Note on the checkout: the local mirror `scratchpad/repo` was stale (origin/next at 8cdae10, PR #77); after `git fetch` from GitHub in the mirror, `origin/next` resolved to 641c667 as expected. The untracked `scripts/ux-shoot.mjs` from the design audit fails `prettier --check`, so it was moved out of the tree (to `scratchpad/ux-audit/ux-shoot.mjs.bak`) before the gate ran. Nothing was committed.

## 1. What was run and the results

### 1.1 Unit/lint gate: `npm run check` (lint, format:check, typecheck, vitest)

- `eslint`: clean (no output).
- `prettier --check .`: "All matched files use Prettier code style!" (after moving the untracked design-audit script aside; with it in place the gate fails on that file alone).
- `next typegen && tsc --noEmit`: "Types generated successfully", no errors.
- `vitest run`: **Test Files 1 failed | 143 passed | 1 skipped (145); Tests 4 failed | 1058 passed | 6 skipped (1068)**; duration 152.6 s. Exit 1.
  - All four failures are in `src/lib/text/encoding.test.ts` ("mojibake detection and repair (D-1507)"): `round trip of the characters the repo uses` (`→: expected 0 to be greater than 0`), `a line encoded twice and three times comes back whole`, `a run mixing depths (the nonce line) is restored in one call`, `reports the line number of each run` (`expected [] to deeply equal [2, 4]`).
  - Diagnosis: environment, not product. The test's `corrupt()` helper decodes UTF-8 bytes with `new TextDecoder("windows-1252")`; this container's Node 22.22.0 (`/opt/node22/bin/node`, ICU 77.1) drops the C1 bytes 0x80–0x9F instead of mapping them (`decode([0x86,0x92,0xe2])` returns `"â"`), so the fixture never contains mojibake and nothing is found. The same test file is green on the PR runs that merged tonight (GitHub's Node). Not reported as a finding.

### 1.2 Build and public end-to-end

- `npm run build` (with `NEXT_PUBLIC_SITE_URL=http://localhost:3000`): exit 0. Two Turbopack warnings, "Dynamic filesystem access causes tracing of the whole project", at `src/lib/guides/pages.ts:151` (`readdirSync`) and one more of the same kind.
- Server: `npm run start` with the `webServer.env` values from `playwright.config.ts` (`STRIPE_FAKE=1`, display prices, local CRON_SECRET, no Supabase). The server logs the expected SupabaseEnvError warning and serves.
- `npx playwright test --project=desktop-chromium --project=android-small --workers=4 e2e/*.spec.ts` (every public spec, 33 files; the `iphone` project needs WebKit, which is not installed, so it was not run):
  **226 tests: 207 passed, 2 failed, 17 skipped (4.6 min).**
  - Failed: `e2e/questionnaire-a11y.spec.ts:38 › every questionnaire step has no serious or critical accessibility violations` on both projects: "Test timeout of 30000ms exceeded" at `helpers/result.ts:16` (`openResultSections`). Re-run alone with `--workers=1`: **2 passed** (11.6 s and 11.0 s). The spec runs axe on six steps inside one 30 s test; under four parallel workers on this host it took >30 s. CI runs one worker. Load-sensitive timeout, not a product defect (see note N2).
  - Skipped (17): the EVIDENCE=1 screenshot tests (legal-pages, questionnaire-screenshots, req-013-screenshots, req-014, req-025-evidence), `magic-link-any-device` (needs Supabase), `subscription-off` (needs `STRIPE_FAKE=0`), `writing-indicator` D-2006 CPU test; each on both projects, as in CI.
- `npx playwright test e2e/subscription-off.spec.ts --project=desktop-chromium --project=android-small` against a second server start with `STRIPE_FAKE=0` (CI's extra step): **4 passed**.

### 1.3 Exploratory testing (own Playwright scripts, 360×740 and 1280×900, light; 360 dark)

Covered: home; `/start`; the questionnaire end to end as "Sunrise Supports" sole trader, NSW, 0107, 3 workers, restrictive practices "Not sure" (helper: locks yes, holds no, medication no) and as Company (Pty Ltd), VIC, 0120, 3 workers, RP "No"; the step-2 hint under both structures; the "What these words mean" disclosure on every page that carries one; the result page's order, counts and first-screen button; "Start again"; browser back/forward through the steps; empty-submit validation on steps 1 and 2 and the ABN and workforce edge values; a keyboard-only walk of step 1; the sample page and a HEAD on its Word link; pricing; the guides index and the cost guide's calculator; the five legal pages; the 404 page; the sign-in page (rendered, not submitted). Results feed the findings below; the things that passed:

- Step-2 hint differs by structure (D-2730): sole trader reads "Not sure? Most sole-trader support workers choose Assistance with daily personal activities and Household tasks."; company reads "Not sure? Many small providers start with Assistance with daily personal activities and Household tasks." A direct open of `/start/supports` with no draft redirects to step 1 (no "no structure" case reachable this way).
- Glossary disclosure: present and opens, with the attribution line and one `dt`/`dd` per counted term, on `/start` (5), step 2 (1 sole / 2 company), step 3 (3), step 4 (2), result (7 sole-not-sure / 6 company), home (5), sample (3), pricing (2), guides index (3), cost guide (4). Steps 1 and 5 and the five legal pages carry no disclosure (no glossary term on them). Hyphenated words in meanings render inside `white-space: nowrap` spans (`sole-trader`, `risk-assessed`, `four-digit`, `higher-risk`, `lower-risk`), as A2 intended. Every meaning ends with a full stop.
- Result page order (360, sole trader): summary section (audit kind, group tag, Documents/Registers/Checklist lines, ready line, **Start getting ready** primary, checklist sign-in link, buy link, "Next:" line) → What these words mean → Why this result → Documents you will need → Registers to keep → the two-halves list → What happens next → notice → contact. Counts agree across the page in all four answer sets tried (e.g. "Documents: 24" = "Documents you will need (24)"; "Checklist: 43 items" = "Open your checklist (43 things)"). At 360×740 the primary button's bottom edge is at 699 px with no scroll (h1 at 241, button 651–699). Screenshot `shots/sole-360-result-top.png`.
- Back/forward: back from the result lands on step 5 with its answers kept, back again on step 4 with workers=3; forward twice returns to the result with the result rendered.
- Start again: the confirm box appears ("Clear your answers and start again? Your result goes with them." / Keep / Yes, start again); after confirming, localStorage is empty, `/start/business` has an empty trading name, `/start/result` redirects to step 1. (Landing page: see F7.)
- Empty submit: step 1 lists three errors in the summary box ("Trading name: Enter your trading name", "Business structure: Choose your business structure", "States and territories: Choose at least one state or territory") and moves focus to the box; step 2 lists "Choose at least one registration group". ABN: `12345678901` and `abc` are refused with "Enter an 11-digit ABN (for example 51 824 753 556), or leave it blank"; `51 824 753 556` and `51824753556` pass. Workforce: 0 workers → "Count yourself as a worker"; 0 key personnel → "Enter at least 1 key person"; 100000 → "Enter 500 or fewer workers".
- Keyboard, step 1 (both widths): Tab order is h1 (auto-focused, no ring) → Trading name → the checked/first structure radio → NSW … NT → ABN → Save and continue; Space checks the focused radio and checkbox; ArrowDown moves and checks the next radio; Enter on the submit button moves to step 2 and focus lands on the step-2 heading (or the error box when the step is invalid); the submit's focus ring is `solid 2px rgb(180,70,31)`. Enter while a state checkbox is focused also submits the form (Chromium's implicit submission); with a valid form that is harmless.
- Sample: `HEAD /sample/complaints-policy.docx` → 200, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `content-disposition: attachment; filename="sample-complaints-policy-example-supports.docx"`; GET body 18,260 bytes. `/sitemap.xml` and `/robots.txt` 200.
- Pricing: AUD 399 pack, AUD 39 a month subscription, the GST line, the Terms/Privacy/Refunds links; 2 glossary terms.
- Guides: five guides linked; the cost guide's calculator changes its answer on a tick and filters on "household" (3 rows).
- Legal pages (light and dark, both widths): no raw `{{token}}` anywhere; every page's "Last updated 16 October 2026". `/privacy` has "as read on 16 October 2026" and "Office of the Australian Information Commissioner"; `/ai` has "as read on 16 October 2026"; `/terms` has "speak to a lawyer". "speak to a lawyer" is on `/terms` only (not privacy, refunds, ai, about), and "keeps your evidence in one place" is on none of the five: the D-2265 line is on the home page as "…so your evidence sits in one place when renewal comes." (`src/lib/home-copy.ts:29`). The "as read on" date is the page's own `updated` date, which is the documented fallback (D-2248) because `product/evidence/req-022/` does not exist in the repo (see N4).
- 404: `/no-such-page-qa` → HTTP 404, h1 "That page is not here.", the two links. Title: see F9.
- Sign-in: renders "Sign in", "We email you a link; there is no password…", the email field (`autocomplete="email"`, `inputmode="text"`), "Email me a sign-in link". Not submitted.
- No horizontal overflow at 360 on any public page scanned (home, start, pricing, sample, sign-in, the five legal pages, guides index, two guides, 404).
- No `pageerror` or console errors on any questionnaire run.

### 1.4 axe-core (@axe-core/playwright 4.x, tags wcag2a/2aa/21a/21aa/22aa + best-practice)

Run on 18 public URLs (home, /start, /start/business, pricing, sample, sign-in, the five legal pages, guides index, all five guides, the 404) plus the six questionnaire states (step 1 with errors, steps 2–5, result closed, result with every disclosure open, result with the Start-again confirm, and at 360 the result with the stepper list open), in light and dark × 360 and 1280. **110 page-states with zero violations.** Violations and items axe could not decide:

- **Violation, serious, `color-contrast` (WCAG 1.4.3), dark mode only, `/guides/ndis-registration-cost`, 38 nodes** (both widths): `<span class="font-mono text-zinc-500">0101</span>` etc. in the calculator list: foreground `#5e6866` on `#141c1b`, ratio **3.01:1**, expected 4.5:1, 14 px normal weight. → F2.
- Violation, moderate, best-practice `landmark-unique`, `/guides/registers-an-auditor-asks-for` at 1280, light and dark: two `role="region"` table wrappers share the accessible name "Table: Record, What it proves, Where to keep it" (`[data-testid="data-table"]:nth-child(16) > .hidden.overflow-x-auto.sm:block`). → F10.
- Incomplete (needs review), `aria-prohibited-attr`, on every questionnaire step and the result, both schemes and widths: the stepper's circle `<span aria-current="step" aria-label="Step N, …: current">` and `<span aria-disabled="true" aria-label="Step N, …: not yet">` (`stepper.tsx`): `aria-label` on an element with no role. → F3.
- Incomplete `color-contrast` on text over the group tags/gradients (2–18 nodes per step); axe could not compute a background. Spot-checked visually; nothing obviously low except F2.

### 1.5 Source review of tonight's signed-in changes

Read: `src/server/path/state.ts`, `src/server/path/actions.ts`, `supabase/migrations/20261016040000_adoption_per_version.sql`, `src/server/registers/seed.ts` (`markAdopted`), `src/server/checklist/actions.ts`, `src/server/registers/actions.ts` (policy-review save), `src/server/generation/rerender.ts`, `src/lib/legal/vendor-terms.ts`, `src/lib/legal/tokens.ts`, `src/server/legal/render.ts`, `src/lib/copy-lint/glossary.ts`, `src/lib/copy-lint/rules.ts`, `tests/glossary-lint.ts`, `tests/integration/adoption-per-version.test.ts`, `e2e/signed-in/guided-path.spec.ts` (A0 assertions), `e2e/helpers/session.ts` (`deleteTenant`), the register and membership RLS/grants in earlier migrations. What held up:

- `adopt_document_version`: parameters are typed (`uuid`, `uuid`, `date`), no dynamic SQL, `search_path` pinned; the owner path requires `is_owner(p_account)` (which also refuses a deleted account) and the version's `account_id` must equal `p_account`; the service path additionally requires a live account; the version must be in the account's newest ready set and the latest of its type; every refusal is `42501`. The grant/revoke on the function and on `document_versions`/`memberships` match the code's use (session clients only select from `document_versions` and select/delete from `memberships`; inserts go through the admin client or definer functions). The guard trigger and the mirror upsert keep the `last_reviewed_on >= adopted_on` CHECK satisfied (`greatest` ignores nulls).
- Dates: every "today" is `(now() at time zone 'Australia/Sydney')::date` in SQL and `Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Sydney'})` in JS; `adopted_on` travels as a `YYYY-MM-DD` string through PostgREST with no `Date` conversion, so no off-by-one across midnight UTC. A carried day is capped at Sydney today and honoured for the service role alone.
- `listAdoptedDates`: orders by `version desc` and keeps the first row per type, so the newest adopted version's day wins; the set is the newest `ready` set by `created_at`, the same rule the function uses.
- The carry in `adoptGroupAction` cannot erase a Finish-page facts-edit nudge: `rerenderSetWithFacts` writes a new version only when the model differs (`rerender.ts:153`), so a type whose newest version already carries the current facts keeps `adopted_on = null` and `!d.adopted_on` is false only for versions this re-render wrote.
- The integration test for D-2449 asserts the right things (carried day on v3, `listAdoptedDates` reads it, the mirror unmoved, an owner's passed day ignored).

Defects and weak spots found are F1, F4, F5, N3, N5, N6 below.

### 1.6 Known issues from `product/CHAT.md`

The committed `product/CHAT.md` is 248 lines and ends at "Dev, 15 Oct 2026 13:26" (batch 46); tonight's chat is not in the checkout. I used `DECISIONS.md` D-2248–D-2267, D-2427–D-2449, D-2730, the PR #77/#79/#80/#81 commit messages and the e2e comments (D-2435, D-2448, D-2449, D-2266) as the record of what was known. Nothing below contradicts a decision that says it was fixed; where a finding is the documented behaviour I say so.

## 2. Findings (most severe first)

### F1. major (low likelihood, silent): `adoptGroupAction` reports success when no version was adopted
- `src/server/path/actions.ts:268-282`; `src/server/registers/seed.ts:105-117`.
- Steps: the adopt step's page is open for a ready set; before the owner clicks "These are our policies", that set stops being the account's newest ready set (a regeneration finishes, or a second ready set exists). The action checks only that the set is the viewer's and `ready` (line 161), not that it is the newest. `markAdopted` then gets `42501` from `adopt_document_version` (not the newest set), logs `registers.adopt.failed` and returns `null`; the action ignores the return value for the group's own documents (line 271) and returns `{ ok: true }`.
- Expected: the owner is told the adoption did not take ("This set is no longer your current pack…"), and the checklist is not ticked.
- Actual: the checklist rows were already upserted to `have` (lines 222-237) and the circulation rows inserted (248) before the adopt; the response is ok; the path strip still shows the group as left to adopt; the owner can click again with the same silent result. The same ordering means a throw inside `rerenderSetWithFacts` (266) also leaves the checklist ticked and nothing adopted. `adoptDocumentVersionAction` (324-329) does check the return value, so the pattern is one line away.

### F2. major (accessibility, WCAG 1.4.3 AA): dark-mode contrast failure on the cost guide's calculator codes
- `src/app/guides/[slug]/cost-calculator.tsx:80`: `<span className="font-mono text-zinc-500">{g.code}</span>` has no `dark:` variant.
- Reproduce: `prefers-color-scheme: dark`, open `/guides/ndis-registration-cost`, scroll to "Work out your own audit type and price". axe: `color-contrast` serious, 38 nodes, `#5e6866` on `#141c1b` = 3.01:1 (needs 4.5:1), 14 px.
- Expected: at least 4.5:1 in both schemes (the site's other muted text uses `text-zinc-600 dark:text-zinc-400`). Light mode passes. The page is in CI's `guides.spec.ts` but the a11y pass (`req-015-a11y.spec.ts`) does not list the guides and runs in light mode only, which is why it was not caught.
- Screenshot: `shots/calculator-codes-dark-360.png` (compare `shots/calculator-codes-light-360.png`).

### F3. minor (accessibility, WAI-ARIA 1.2): stepper circles are named with `aria-label` on a plain `span`
- `src/app/start/_components/stepper.tsx:143-156`: the current step's circle is `<span aria-current="step" aria-label="Step N, …: current">N</span>` and each not-yet step is `<span aria-disabled="true" aria-label="Step N, …: not yet">N</span>`. `aria-label` is prohibited on the `generic` role; Chrome/NVDA and VoiceOver ignore it, so the circles read as the bare digit. axe flags it as `aria-prohibited-attr` (needs review) on every step and the result. The done steps are links (named correctly), and the phone's "Show steps" list carries sr-only names, so the information is reachable elsewhere.
- Expected: `role="img"` on the span or the name as sr-only text, as the list already does (lines 95-102).
- Screenshot of the row: `shots/sole-360-result-top.png`.

### F4. minor: "Done" on the checklist adopts a version with none of the adopt step's gates
- `src/server/checklist/actions.ts:103-111` calls `markAdopted(admin, accountId, documentTypeId, null)` on `status === "have"`, which now writes `document_versions.adopted_on` through `adopt_document_version` (A0). The adopt step refuses while blanks are open (D-2211) and while the account has no name fact (D-2244, "adoption is approval by a named person"); the checklist tick enforces neither, so a document can be adopted (dated, mirrored, "adopted" on the register and in the pack) with blanks still open and no approver. Unticking later does not un-adopt. Pre-existing rule (REQ-009 FR-7), but A0 made the tick write the authoritative date, which widens the gap.

### F5. minor (wording/format): the policy-reviews register prints the adopted day as `2026-10-16`
- `src/app/registers/policy-reviews/page.tsx:63`: ``Adopted ${r.adopted_on}; every ${r.review_cycle_months} months.``; `[id]/page.tsx:50`: `["Adopted", row.adopted_on ?? "Not yet"]`. The rest of the product says "16 October 2026" (`formatDateAu` in `src/lib/generator/fixed-text.ts:36`; the legal pages; the date fact written by the adopt step). `e2e/signed-in/guided-path.spec.ts:536-538` asserts the ISO form (`/Adopted \d{4}-\d{2}-\d{2}; every \d+ months\./`), so the test pins the wrong format. The page intro (`page.tsx:49`) still says "Ticking Done on the checklist sets the adopted date" while the adopt step is now the usual writer.

### F6. minor (wording): the calculator says "drafted for these 1 group"
- `src/app/guides/[slug]/cost-calculator.tsx:112-114`: `for these {chosen.length} {chosen.length === 1 ? "group" : "groups"}`. With one group ticked the sentence reads "Readyline document pack: AUD 399 one-off, drafted for these 1 group." Expected: "for this group" / "for these 2 groups".
- Screenshot: `shots/calculator-360-light.png`.

### F7. minor: "Start again" lands on step 1, not the intro the code sends it to
- `src/app/start/_components/step-shell.tsx:56-59` calls `clearDraft()` then `router.push("/start")`; `clearDraft` empties the answers synchronously (`questionnaire-provider.tsx:158-160`), the result step's guard (`step-page.tsx:36-39`) sees an unreachable step and `router.replace("/start/business")`, and the replace wins every time (6 of 6 tries at 360). `e2e/req-025-b.spec.ts:167` tolerates both (`/\/start(\/business)?$/`). Harmless for the customer (step 1 is empty and the stepper reset), but the intended destination is unreachable and the test cannot tell.

### F8. minor (usability): validation messages and `aria-invalid` stay after the field is fixed
- All steps validate on submit only (`business-step.tsx:82-97` and the same shape elsewhere). After an empty submit, filling the trading name, choosing a structure and a state leaves the red summary box listing all three errors and `aria-invalid="true"` on the trading name until the next submit; on step 2 the "Choose at least one registration group" box stays after a group is ticked. A screen-reader user who fixed the field is still told it is invalid. The next submit clears everything, so nothing is blocked. Screenshot of the state: `shots/sole-360-step1-errors.png`.

### F9. minor (accessibility, WCAG 2.4.2): the 404 page has the home page's title
- `src/app/not-found.tsx` sets no `metadata`; `/no-such-page-qa` returns 404 with `<title>Readyline: registration-readiness for small NDIS providers</title>`, the same as `/`. Every other page has its own title ("Pricing | Readyline", "Your result | Readyline" …). `e2e/not-found.spec.ts` does not assert the title.

### F10. minor (best practice): two identically named table regions on the registers guide
- `/guides/registers-an-auditor-asks-for` at ≥640 px: two data tables share the caption "Record, What it proves, Where to keep it", so their `role="region" aria-label="Table: …"` wrappers are indistinguishable to a landmark list (axe `landmark-unique`, moderate). A heading-based label would fix it.

### F11. minor (visual, phone): the calculator's placeholder and a long group name clip at 360
- `shots/calculator-codes-light-360.png`: the search placeholder "Household tasks, personal care, SIL…" is cut at "SIl"; "Accommodation/tenancy assistance" breaks mid-word ("tenan / cy") rather than at the slash. Cosmetic.

## Notes (not defects, or not tonight's)

- N1. Unit gate: the four `encoding.test.ts` failures are the container's Node (see 1.1), not the code.
- N2. `e2e/questionnaire-a11y.spec.ts` runs six axe passes inside one 30 s test; it needs ~11 s alone and failed at 4 workers here. CI uses one worker. A `test.setTimeout` or a `test.slow()` would stop local red runs.
- N3. Lint bypass, documented by D-2267 but worth knowing: `tests/glossary-lint.ts:362-366` marks a file `computed` whenever `<GlossaryTerms ids={…}>` receives anything that is not an array literal or a module-level const array, and `glossaryFindings` (line 432) then skips every term finding for that file. A page that passes e.g. an empty computed list and is not visited by the e2e render check passes the lint with no meaning on the page. Today the three computed pages are all in the e2e. Separately, `BANNED_WORDS` matches `N/A` case-sensitively (`rules.ts:35`), so "n/a" passes.
- N4. `vendorTermsDate()` (`src/lib/legal/vendor-terms.ts`) reads `product/evidence/req-022/` at request time; the folder does not exist in the repo, so both pages show the page's `updated` date, as D-2248 says. When the bundle index lands, the Vercel function must include that folder (output file tracing); today the guides' `readdirSync` forces whole-project tracing (build warning), which happens to carry it, but a tighter trace later would silently return the fallback.
- N5. `deleteTenant` (`e2e/helpers/session.ts:275-285, 321-323`): a failed `memberships` read is treated as "no accounts" (falls back to `tenant.accountId` only) and `deleteUser` errors are swallowed, so a leaked auth user or an unseen account is never printed. A job already executing inside the job route when its row is deleted still completes against a vanished account (the window the comment describes is narrowed, not closed).
- N6. `adoptGroupAction` writes the checklist and circulation rows before the re-render and adoption (see F1); with no transaction across the three, a half-done group is possible. Order the adopt first or check its result before ticking.
- N7. With `STRIPE_FAKE=0` the Terms page reads "The registers subscription is not switched on in this environment. The audit-ready subscription is charged in advance…": two names for one product in adjacent sentences, and "in this environment" is operator language on a legal page. Pre-existing (batch 47 item 1), unchanged tonight.
- N8. `NumberInput` strips non-digits (`fields.tsx:108`), so "2.5" workers silently becomes 25 and "-1" becomes 1. The 1–500 range check still applies.
- N9. The migration applies the backfill before creating the guard trigger and sets the `readyline.adopting` GUC with `is_local = true`, which needs a transaction; the Supabase CLI runs each migration in one, so this is fine, and the GUC is only needed by the trigger that does not yet exist at that point.

## 3. What could not be tested, and why

- The signed-in flows (account setup, purchase in fake Stripe, generation, finish, adopt, registers, audit pack, admin, team) need the local Supabase stack (Docker), which is not available here. They were audited from source (1.5) and from the e2e specs; the adopt-step CI screenshots (`product/evidence/req-017/`) are uploaded as a CI artifact and not committed, so no screenshot of tonight's adopt screen was available to read. The `tests/integration/*` RLS tests were not run for the same reason.
- The `iphone` Playwright project (WebKit) is not installed in `/opt/pw-browsers`, so the iPhone column of CI was not reproduced; everything above is Chromium (desktop and the 360×740 Android descriptor).
- The Lighthouse performance budget job and the docx-render job were not run.
- The magic-link sign-in was not submitted (rule: never sign in); the sign-in page was only rendered.
- Production (`readyline-zeta.vercel.app`) was not visited.

## 4. Release verdict

**Go, with two fixes recommended before promotion.** The gate is green apart from an environment-only unit failure; all 207 runnable public end-to-end tests pass on both Chromium projects (the two timeouts pass at CI's worker count) and the subscription-off step passes; the seven merged changes behave as described on the public surface (the D-2730 hint keys on structure, the glossary disclosure opens and lists meanings with hyphens kept whole on every page that carries one, the result page's order and first-screen button hold at 360×740, the legal second-draft sentences render with no raw tokens); the new SQL function checks ownership, account liveness, set recency and version recency and is injection-safe, and no time-zone or off-by-one was found in the adoption dates. Nothing found is a blocker. The two items I would not ship without are F2 (a real WCAG AA contrast failure in dark mode on a public guide, a one-class fix) and F1 (the adopt action can report success after a silent refusal and has already ticked the checklist; one `if (!adopted)` and reordering the writes). F3–F11 are small and can follow in the next batch.

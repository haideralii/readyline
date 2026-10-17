# REQ-028 Session C: delivery evidence

Dev, 17 Oct 2026. Branch `req-028-session-c` from `next` c343642 (A1, A2, A3 and B in), PR #96 into `next`. The session's scope is the public flow on a laptop: FR-5 (the questionnaire), FR-6 (the result, with D-2805's named test changes), FR-10 (home and pricing), FR-11 (the reading pages), with AC-4's fold, AC-5, AC-8 and AC-10, QA F10 and F11, and the baselines and the after set. The Dev's calls are D-2276 in `DECISIONS.md`; the plan was item 8 under the REQ's Dev response with its five defaults (a) to (e), accepted by the PO at 18:55 and 19:45 with the caution on (a).

## Commits

| # | Commit | What |
| --- | --- | --- |
| 1 | c7cbdad | The baselines from `next` c343642: `e2e/req-025-c.spec.ts` holding the home height at 360 to its `before` file plus 160 (`home-height-before-*.json`, 4,602 px at 360); the three heights before C (`heights-c-before-*.json`: supports 6,802, result open 6,708, which-audit guide 6,532 at 1280); the Lighthouse before (`c-lighthouse-before.md`) |
| 2 | 7c674cc | FR-5, the questionnaire on a laptop: the header grid with the stepper as a subgrid, the form as its own twelve-column grid (`.step-form`, `.step-side`, `.step-side-col`), the aside column (the hint's copy, the glossary, "Ticked so far") sticky from `lg`, the one-line hint and the two-column class rows, the practices examples beside the question; `e2e/req-028-c.spec.ts` (AC-5). Went up red on two specs (the local gate's flaw, D-2276 (6)) |
| 2a | fe46e95 | The reds of 7c674cc: the fieldset measured for the seven columns, the render-time glossary count kept (D-2276 (3)), two phone specs tapping the hint's summary first, AC-5's two figures quarantined with their numbers (D-2276 (7)), the aside column as one sticky grid item |
| 3 | 26eff8b | FR-6, the result on a laptop: 5 + 7 with the card and the glossary sticky, the three sections open at `lg` on a first visit (D-2813's controlled pair), D-2805 as written, the two phone exceptions; the remembered-sections bug the fold found (D-2276 (9)); the named test changes plus `checklist.spec.ts`, `req-025.spec.ts` and `req-025-b.spec.ts` |
| 4 | 4bb7719 | FR-10, home and pricing: the hero 7 / 5 with the example card, the two-cell price strip (D-2806), the sample 7 / 5, the trust cards 2 × 2, the mission and the testimonials eight columns; `PricingCard`, both buttons secondary (D-2816), the one no-interest sentence under both, "Registers subscription" everywhere (QA N7); AC-8's two tests |
| 5 | 48fa8b7 | FR-11, the reading pages: `JumpTo`, the guide's aside (Jump to, Last reviewed, the short answer) with the phone's own copies, the legal pages onto the shell's reading kind with the aside, the account page's in-page nav, the group pages' Jump to; QA F10 (`tableHeadings`), QA F11; the specs and a new signed-in spec |
| 5a | 83aa27f | The one red of the CI-mode run: batch 49's guide test read the article's "Short answer" heading at 1280, where FR-11 hides the article's copy; it reads the aside's copies from `lg` and the article's under it |
| 6 | (this) | The after set, the home height after, the Lighthouse after, the CLS probe, this file and D-2276 |

## Acceptance criteria in C's scope

| AC | Test | Level | Result |
| --- | --- | --- | --- |
| AC-4 (the result's fold and the two phone exceptions) | `e2e/req-028-c.spec.ts` "the result at 1280 …": the card in five columns and sticky, the sections in seven and open on a first visit, the checklist link heading the documents section; at 360 the stepper as line one alone, the sections closed, the button inside the viewport; `e2e/req-015-a11y.spec.ts`'s result cases (the fold, the remembered state through a reload at both widths) | e2e, both projects | green locally and on #96's runs |
| AC-5 (the questionnaire) | `req-028-c.spec.ts` "at 1280: seven and four columns …" (the widths against the shell's columns, the aside's order and stickiness, the two-column rows, the landmark) and "at 360: the hint one line until tapped …" (no landmark, the question before the examples) | e2e, both projects | green |
| AC-5's two figures | `req-028-c.spec.ts`, two `fixme` tests carrying the measured numbers (4,752 px against 3,400 at 1280 with every group open; 915 px against 600 for the first class at 360) | e2e, quarantined | for the PO's ruling (D-2276 (7), CHAT 20:17) |
| AC-8 (home and pricing) | `req-028-c.spec.ts` "home: the strip's cells …" (the two cells' words, 16 px, one weight, tabular figures, the links to the cards, the sentences under the strip; at 1280 the example card in five columns beside the h1 and the trust cards 2 × 2; at 360 the cells stacked) and "pricing: …" (the h1, the skeleton, 30 px figures, no primary inside the cards, the sentence under both, equal heights across columns 2 to 11 at 1280); `req-025-c.spec.ts` at 360: 4,686 px against the baseline 4,602 + 160 | e2e, both projects | green |
| AC-10 (CLS with `OpenOnLarge` in place) | The CLS probe at 1280 on a production build of the head (the browser's layout-shift entries over two seconds after load): supports step 0 (0 before), result 0.539 (0.513 at `next` c343642 before any change of C's), home 0 (0 before); the Lighthouse after (`c-lighthouse-after.md`) with CLS 0 on /, 0 on /pricing, 0 on /start, 0 on /start/business on the four budget pages | probe and Lighthouse | the supports step and the four budget pages hold CLS at 0 with `OpenOnLarge` in place; the result page's CLS is 0.5 before and after, pre-existing: the result view mounts on the client after the draft is read, so the footer moves down when it appears; `OpenOnLarge` adds about 0.03 inside that. Open for the PO: a reserved height or a server-rendered frame for the result would take it under 0.1, not in C's scope |
| FR-11 (the reading pages) | `req-028-c.spec.ts` "a guide: …" (the aside with its three blocks at 1280, the current section marked after a jump, the aside stuck at 6 rem; the short answer first, the inline Jump to and no landmark at 360) and "a legal page: …" (the aside with the updated line and the numbered headings' links at 1280, none at 360; F10's heading-based names on the registers guide, all distinct); `guides.spec.ts` and `legal-pages.spec.ts` (the landmark's count by width); `e2e/signed-in/req-028-c.spec.ts` (the account page's nav in three columns, the ten links, the current section after a jump, sticky at 6 rem; absent under `lg`) | e2e; the account spec on the Supabase job | public green; the signed-in spec on #96's run |
| D-2805's named test changes | `e2e/req-027.spec.ts`, `tests/path-screens.test.ts`, `req-015-a11y.spec.ts` (two cases), `result-copy.test.ts`, the copy lint's comment; plus `checklist.spec.ts`, `req-025.spec.ts`, `req-025-b.spec.ts` for the moves D-2805's list did not name | unit and e2e | green |

AC-1 to AC-3, AC-6, AC-7 and AC-9 were A1's, A2's and B's.

## Heights at 1280 (`heights-c-before-*.json` from `next` c343642, `heights-c-*.json` from the head)

| Page | Before | After |
| --- | --- | --- |
| Supports step, every group open | 6,802 | 6,747 (the evidence spec ticks SIL and 0107, so the SIL eligibility questions are on the page; AC-5's spec with 0107 alone measured 4,752 at 2a) |
| Result, sections open | 6,708 | 5,555 |
| Which-audit guide | 6,532 | 6,108 |

Home at 360 (`home-height-before-android-small.json`, `home-height-c-android-small.json`): 4,602 before, 4,686 after; the gate is the baseline plus 160 (AC-8) under REQ-025 FR-12's 5,000 px cap.

## Lighthouse (`c-lighthouse-before.md`, `c-lighthouse-after.md`)

| Page | Performance before | after | LCP before | after | CLS before | after | JS before | after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | 91 | 91 | 1931 ms | 1989 ms | 0 | 0 | 145.5 kB | 145.5 kB |
| /pricing | 93 | 90 | 1832 ms | 1959 ms | 0 | 0 | 145.9 kB | 145.9 kB |
| /start | 86 | 81 | 1761 ms | 1779 ms | 0 | 0 | 192.9 kB | 192.9 kB |
| /start/business | 95 | 92 | 1823 ms | 1793 ms | 0 | 0 | 213.2 kB | 214.4 kB |

The budgets job is advisory on this machine (D-1013); `/start` scored 86 at `next` itself before any change of C's and 81 after, `/pricing` 93 then 90, with LCP within 130 ms of before on every page, CLS 0 on every page both times and the JavaScript unchanged on three pages and 1.2 kB heavier on `/start/business` (the stepper's new props); the performance scores on this laptop move by several points between runs of the same build, so CI's budgets job on #96 is the reading to keep, and the after run's vitest exit was 1 on the `/start` score alone.

## Runs

- `npm run check` green on every pushed commit (lint, format, typecheck, unit: 164 files, 1,178 tests at the head).
- A production build from the main tree at every pushed commit with the public specs the commit touches on `desktop-chromium` and `android-small`: 2a 76 passed; 3 68 passed; 4 91 passed; 5 93 passed.
- 7c674cc went to the branch red on two specs because the local chain's push guard matched the unit test's "passed" line after a `head` filter cut Playwright's summary; the guard now reads Playwright's own `SPECS GREEN` marker (D-2276 (6)), and every later push went up green.
- The whole public set in CI mode on the three projects from a production build of the head: 302 passed, 31 skipped, 1 failed (8.7 min) from 48fa8b7: the one red was batch 49's guide test reading the article's short-answer heading at 1280, where FR-11 hides the article's copy and the aside carries it, fixed in 83aa27f (5a), which then ran that spec with req-028-c.spec.ts and guides.spec.ts in CI mode on the three projects: 45 passed, 6 skipped, none failed.
- PR #96's CI: the runs at the earlier commits were cancelled by the next push each time; the run at the head is the one to read, the new signed-in spec on its Supabase job.

## Screenshots (the after set, D-2271 (12))

`e2e/req-028-evidence.spec.ts` with `EVIDENCE=1 EVIDENCE_TAG=c` from a production build of the head wrote the fourteen public states in both schemes at 360 and 1280 (`*-c-light-*.jpg`, `*-c-dark-*.jpg`) under `product/evidence/req-028/`, beside A1's before and after; the `c-before` run's screenshots were discarded and its heights kept.

## Open for the PO

- FR-5's glossary count from the step's data (D-2721 amended) against REQ-027's presence check: the render-time count stands (D-2276 (3), CHAT 19:50).
- AC-5's two figures (D-2276 (7)): the layout moves or the figures do.
- The pack card's bullets (D-2276 (12)): the skeleton has the slot; the copy has no three lines for it.
- The example card's phone order (D-2276 (11)) and the two-copies pattern on the guide's aside (D-2276 (14)).
- SR-2's client list should name `JumpTo` (D-2276 (13)).

## Not in C

The hallway test and the VoiceOver note (Haider's, after C, D-2809); the promotion to `main` (Vercel's limit); the auditor's page.

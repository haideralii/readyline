# REQ-031 Session B: the sheet on /sample, the third step and the what-changed reading mark

PR into `next`, branch `req-031-session-b` stacked on `req-031-session-a` (9d3b70e; opens after #116 merges), `next` bd9550e merged before the push (D-2827). Dev-1, 18 Oct 2026. Head: 4dd6334.

## What this PR does

- **FR-4, the third step (D-2889).** `start-here.json`'s `next` list carries "Check your systems before the audit: /path/audit-day/check" after the checklist and the audit day, so the Word file, the page and the sample read it from the one place. The route exists (D-2889's UNVERIFIED resolved). The REQ-026 evidence sheet and its Word file are regenerated.
- **FR-3, the sheet on `/sample` (D-2888, D-2896).** The Start here sheet is one component the owner's page (`/documents/[setId]/start-here`) and `/sample` share: with a set id it links into the set; with none it is read-only, every line to do, the Open line and section 5 plain text, no link to `/documents`, `/checklist` or `/path`, no footer. The sample's sheet is the sole-trader reference case built once at module load through `buildStartHere` (the shipped version as the latest, nothing adopted, no subscription), under the sample document and above "See which audit I need", with D-2896's line above it. A unit test holds its lines equal to `product/evidence/req-026/start-here-sole-trader.txt`. The page's one glossary disclosure covers the sheet's words (the sample component's `moreText`).
- **FR-5, the reading mark (D-2890; question 4 (a)).** Migration `20261018190000_what_changed_read_at.sql` adds `registration_periods.what_changed_read_at timestamptz null`; the row's policies are unchanged (members read, the owner writes). A client component on the what-changed page calls `markWhatChangedReadAction` once after render; the action writes `now()` on the current period with the owner's session. `renewalSteps` takes `whatChangedReadAt` and `latestChangeAt` and the step reads "Read on <date>", done, while the reading is newer than the newest row in the registers the summary reads, else "to read"; the action reads "Read it again" once read; the audit-day link carries the same words in brackets.

## Notes for the PO

- **One deviation from FR-5's wording.** The REQ compares the reading with `latestChangeOn`, the newest typed day among the rows. A typed day cannot order a reading and an incident logged for the same day, and AC-10's second given (an incident then logged for today makes the step "to read" again) needs that order. The step therefore compares the reading with the rows' own `updated_at` (`latestRegisterChangeAt` over incidents, complaints, worker clearances, policy reviews and commission changes): a row written after the reading counts whatever day it is dated for. Two lines to revert if you want the typed days (D-2298).
- The sample document above the sheet is Example Supports'; the sheet is Sunrise Supports', as D-2896 names it. Say if you want one name on the page.
- No log line for a reading: the column is the record (D-2298).

## Verification

- `npm run check`: lint, format, typecheck green; 188 test files, 1,358 tests passed, 6 skipped.
- From the main tree's production build of the head, on desktop and Android: `result-print`, `home-v2`, `req-025`, `req-013-p2`, `req-015-a11y` and `health` on desktop-chromium and android-small, 34 passed in 2.1 min (the home spec carries AC-8; the signed-in spec and the integration case run in CI's Supabase job).
- Unit: `start-here.test.ts` (AC-9: section 5's three steps in order, on the sheet and in the Word model), `sample-start-here.test.ts` (the sample's sheet: Sunrise Supports, every line to do, the three next steps, no claim, the lines equal to the evidence file), `renewal.test.ts` (AC-10 over `whatChangedReading` and the steps); the copy, class and path-screen lints green.
- Integration (the Supabase job): `tests/integration/what-changed-read.test.ts` (null on a new period; the owner's session sets it; a member reads the same value and updates no row; the newest change is the newest row's own timestamp).
- E2E: `e2e/home-v2.spec.ts` AC-8 on the three projects (the D-2896 line with "fictional", the sheet under the document and above the button, the five headings, three steps, every line to do, no tick, no link into an account, the glossary disclosure, widths, axe); `e2e/signed-in/req-031-b.spec.ts` AC-10 (to read; the open records the reading; "Read on <today>" on the step and the audit-day link; an incident after it makes "to read" again).
- AC mapping: AC-8 home spec; AC-9 `start-here.test.ts`; AC-10 `renewal.test.ts`, the integration case (the member's branch), the signed-in spec.

## Evidence

- `product/evidence/req-031/pr-body-session-b.md` (this file); `product/evidence/req-026/start-here-sole-trader.txt` regenerated with the third step. Screenshots of `/sample` with the sheet come from the CI run's artefacts.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

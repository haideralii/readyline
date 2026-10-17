# REQ-024 Session C: delivery evidence

Dev-1, 18 Oct 2026. Branch `req-024-session-c`, stacked on `req-024-session-b` (bec2c93) with `next` b603ec2 under it (REQ-023 Session B's period helper), PR into `next` (the PO opens it). The session's scope is Session C of the Scope: keeping it current: the supervision rows (FR-11), the derived states on the audit-day page, the checklist and the self-check (FR-10), ending a worker (FR-12), the staff-matrix import (FR-13), the period on the pack and the pack's two audiences (FR-6, D-2407); AC-5's two audiences, AC-9, AC-10, AC-13 unchanged. The Dev's calls are D-2283 to D-2287 in `DECISIONS.md`; the plan was the Dev response of 01:30 with its four questions, answered 04:10 (D-2829 to D-2833).

## Commits

| # | Commit | What |
| --- | --- | --- |
| 1 | 333bf8f | `20261017140000_worker_supervision_c.sql` (`supervision_entries` with the kind-shaped CHECKs, RLS, grants, the trigger on `last_supervision_on`, the trail's and the imports' CHECKs); `supervision.ts` (the strict form, the words, the derivations); the owner's one action and the Supervision section; the worker file's entry rows, the account export's two CSVs, `PERIOD_COLUMNS`; `worker-supervision-c.test.ts`; D-2283 |
| 2 | cfddbe2 | FR-10 (`workerStatesLine`, the checklist override, the audit-day line, the self-check's live state) and FR-12 (the `ended` event once, the membership revoked, "Past workers"); `worker-ending-c.test.ts`; D-2284 (after the merge of B's W-1 fix, bec2c93) |
| 3 | 3ae8ea6 | FR-13: the staff matrix on the import page, the template, the duplicate and already-listed rules, the derived checklist per imported row, the undo's checklists; D-2285 |
| 4 | a9ee5dc | The period on the pack and the lists' "as at" (D-2832), the pack test with an entry, the iPhone project's spec list, `e2e/signed-in/worker-supervision.spec.ts`, D-2286; then 375521d the merge of `next` a02f2d1 (four conflicts with REQ-023 D's `commission_changes` import, both sides kept) and 186e126 the merge of B's f190a70 |
| 5 | c1d1ece | #104's first run: the migration moved to hour 14 with the two CHECK lists starting from what `next` leaves (D-2835); an ended worker stays on the screening list with the end date (AC-10), AC-13's day-after-the-end case changed with it; D-2287 |
| 6 | (this) | This file and the PR body |

## Acceptance criteria in C's scope

| AC | Test | Level | Result |
| --- | --- | --- | --- |
| AC-9 (two entries in the file with kind, date and code; the row's date the later one) | `src/lib/registers/worker-exports.test.ts` (the rows); `tests/integration/worker-supervision-c.test.ts` (the trigger on insert, update and delete); `worker-supervision.spec.ts` (the history and the row's fact) | unit, integration, e2e | unit green; the rest on the PR's run |
| AC-10 (an ended worker under past workers with the end date; the membership revoked) | `tests/integration/worker-ending-c.test.ts`; `worker-supervision.spec.ts` (the list, the worker's session sent back, the pack's index and list) | integration, e2e | on the PR's run |
| AC-5's two audiences (the link's zip holds the same number columns and no fill column) | `worker-exports.test.ts` (every header inside `csv.ts` with an entry present); `worker-supervision.spec.ts` (both zips' worker file compared) | unit, e2e | unit green; e2e on the PR's run |
| AC-13 (the s 20 reconstruction) | `worker-exports.test.ts`: the four unchanged cases and the day after an end, which now lists the ended worker with the date (D-2287, for the PO to confirm); `worker-ending-c.test.ts` reads the ended worker on the list as at today and before the end | unit, integration | unit green; integration on the PR's run |
| FR-10 (the derived states where the owner looks) | `worker-states-line.test.ts`, `checklist/worker-states.test.ts`; `worker-supervision.spec.ts` (the audit-day line, the checklist's line) | unit, e2e | unit green; e2e on the PR's run |
| FR-11's shape (a review has an outcome and no note; nothing else has an outcome; the supervisor a staff code; the note capped) | `supervision.test.ts` (the form); `worker-supervision-c.test.ts` (eight CHECK refusals) | unit, integration | unit green; integration on the PR's run |
| FR-13 (the template, the refusals, the derived checklist, nothing imported into it) | `import.test.ts`; `worker-supervision.spec.ts` (the import with a name refused; the checklist derived with no date on any item) | unit, e2e | unit green; e2e on the PR's run |
| SR-6 (the participant-shape refusal on the import's free text) | `import.test.ts` | unit | green |
| Data, finding 175 (the grants line) | `tests/integration/service-role-grants.test.ts` (`supervision_entries`: delete, insert, select, update) | integration | on the PR's run |

## Runs

- `npm run check` green on every commit (lint, format, typecheck, unit): 176 files, 1,283 tests at the head.
- A production build from the main tree at every pushed commit with public specs: green each time.
- The whole public set in CI mode on the three projects from a production build of 186e126 (commit 4 with both merges): 306 passed, 29 skipped, 1 failed (8.9 min), the failure the public sign-in spec on desktop-chromium with a retryable fetch error from the hosted auth on the magic-link request; the set re-run on desktop-chromium from the same build, 121 passed, 12 skipped, none failed (5.0 min). Commit 5's changes are a migration and the screening list's rule, which no public page reads; they ran through `npm run check`, a production build and two public specs.
- The two integration tests and the signed-in spec run on the PR's Supabase job alone (the standing rule keeps them off this machine, whose environment points at the hosted project).

## Screenshots

`worker-supervision.spec.ts` writes `supervision-c-*`, `audit-day-people-c-*`, `staff-import-c-*` and `past-workers-c-*` under `product/evidence/req-024/` with `EVIDENCE=1` on the Supabase job's run (the `signed-in-screenshots` artefact), at 360, desktop and the iPhone width.

## Said, not built

The worker's page shows none of the supervision history (the table has no worker policy; D-2283 (3)); entries are added and never edited or removed from the screen (a correction is the owner's through the API's grants, which the trigger follows). The import's "already on the list" count comes back on the action's result and is logged; the import form's redirect shows the imported count alone, as REQ-020 built it.

## UNVERIFIED

None of the Commission's: the session adds no regulatory sentence. The note's helper is the lawyer role's (D-2833), applied verbatim.

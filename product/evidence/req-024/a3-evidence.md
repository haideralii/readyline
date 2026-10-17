# REQ-024 Session A3: delivery evidence

Dev, 17 Oct 2026. Branch `req-024-session-a3` from `next` (the sync head c33e766), PR #92 into `next`. Scope: the recorded days (D-2272 as amended, the PO's first item), the worker file export and the workers index, the two Worker Screening Rules lists, the account export's worker tables (FR-6c), the one-time fill with its three handlers (FR-6b; SR-7, SR-8), the privacy policy's SR-1 sentences, the worker's collection notice (AC-11) and the auditor page's recipients line. The Dev's calls are D-2273 in `DECISIONS.md`.

## Commits

| # | Commit | What |
| --- | --- | --- |
| 1 | 3d4b2e8 | The recorded days are the Sydney day: three table defaults and `submit_incident_report` on `sydney_today()`; integration cases; D-2272 amended |
| 2 | 4727dd9 | `CSV_COLUMNS` lists; `worker-exports.ts` (index, worker file, s 17 and s 18 lists, the s 20 reconstruction); the pack writes `workers/` and the two lists for both audiences; the pack spec reads them |
| 3 | 7ef1c21 | FR-6c: seven worker tables as CSV in the account export; the privacy export line |
| 4 | fef187f | The one-time fill: the export screen, the fill fields, the printable notice, three handlers as one, the limiter, the redaction keys, the switchboard row, the handler and integration tests |
| 4a | aecf6f4 | The routes through the validation layer; the guard names the handler; the privacy date kept |
| 5 | (this) | SR-1's privacy sentences, the worker collection notice, the auditor recipients line, the A3 journey, D-2273, this file |

## Acceptance criteria in A3's scope

| AC | Test | Level | Result |
| --- | --- | --- | --- |
| AC-5 | `worker-exports.test.ts` (the pack's files: names, every header inside csv.ts, no fill column); `audit-pack.spec.ts` (the link's pack reads `workers/index.csv` and the two lists back); `worker-exports.spec.ts` second test (the owner's pack) | unit, e2e signed-in | unit green locally; e2e on the Supabase job |
| AC-10 | `worker-exports.test.ts` (past workers after current with the end date); `worker-exports.spec.ts` (W-002 under past) | unit, e2e | as above |
| AC-11 | `team.spec.ts` (the notice first, its words, the button, the home once seen) | e2e signed-in | on the Supabase job |
| AC-12 | `fill.test.ts` (brackets unticked, values ticked, an empty cell keeps its bracket); `fill-route.test.ts` (attachment, no-store, the value in the body and in no log line or inserted row); `tests/integration/fill.test.ts` (no table and no audit row holds the value after a filled download); `worker-exports.spec.ts` | unit, integration, e2e | unit green locally; the rest on the Supabase job |
| AC-13 | `worker-exports.test.ts` (the five days the REQ names, the fixed note, a closed segment) | unit | green locally |
| AC-16 | `fill.test.ts` and `fill-route.test.ts` (the tick unset refused in the fixed sentence; over the limit the form returns with the value under no-store; a paused subscription is not a gate on the fill or the export); `worker-exports.spec.ts` (the refused form in the browser); `session-c.test.ts` (the seven tables on a tenant with no subscription) | unit, integration, e2e | as above |
| SR-7 | `redact.test.ts` (the five keys omitted); `fill-route.test.ts`; `tests/integration/fill.test.ts` | unit, integration | as above |
| SR-8(e) | `routes.test.ts` (the literal in each route file); the switchboard row and `LAUNCH.md` line 17 | unit | green locally |
| D-2272 | `registers-rls.test.ts` and `audit-day-rls.test.ts` (the recorded days on the Sydney day) | integration | on the Supabase job |

## Runs

- `npm run check` green at every pushed commit but fef187f (D-2273 (10)), 157 files and 1,151 tests at the head.
- The signed-in specs and the integration suite run on the Supabase CI job only (the local `.env.local` points at the hosted project; D-2266's rule).
- PR #92's runs: the PO posts the lines; the first run (3d4b2e8) is the migration's.

## Screenshots

From the Supabase job's EVIDENCE run, under this folder: `export-screen-<project>.jpg`, `export-screen-fill-<project>.jpg`, `export-screen-refused-<project>.jpg`, `worker-notice-print-<project>.jpg` (the A3 journey) and `worker-notice-<project>.jpg` (the team journey), on `desktop-chromium`, `android-small` and `iphone`.

## Left for the PO and the lawyer

- SR-1's lawyer questions (a) to (f) are unanswered; the worker line Session E already placed on the privacy page is the candidate text SR-1 says not to apply until (b) and (f) are answered (D-2273 (7)).
- `privacy.md`'s `updated` stays 2026-10-16 while `legal-copy.test.ts` pins it.
- `release-20261017b` is redundant after #93 and can be deleted.
- FR-6a's `role-assessment-due` reminders at 10 and 20 business days were A1's (the kind and the subject table exist); nothing in A3 changes them.

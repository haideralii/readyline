# Launch readiness review, Session A: the security re-test and the supply chain (Dev-2, 18 Oct 2026)

Branch `req-012-session-a` from `next` 5d6cea7, merged forward to `next` b14206d (#115, #118); PR to `next`. REQ-012 FR-1 and FR-2; written for the PO's acceptance read and the lawyer role's later pass. Author: Dev-2 (role). Every check below is a script or a test that stays in the repository (D-2899); this file is their output on the day. Targets: ASVS Level 1 re-verified, Level 2 listed as gaps (D-2900). Nothing here ran against production (SR-3); the headers script ran against a local production build and the rest in unit tests or on the local Supabase stack with throwaway tenants (SR-2).

## The checks

| # | Status | Page or scope | What was done | Measured | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | pass | ASVS re-verification (FR-1a) | Every row of `product/security/asvs-l1-check-2026-10-14.md` re-read against `next`; a re-verification table appended, one row per earlier row with the control's `file:line` and symbol and the test that keeps it; `src/lib/ops/asvs-recheck.test.ts` opens each | 88 earlier rows re-verified; 99 rows in the table; 101 assertions green; 1 Gap (row 17, Dependabot, see 12 below); 6 Level 2 items listed | the file's last section; commit 12e8d00 |
| 2 | pass | New controls since 14 Oct (FR-1b) | Rows for REQ-021, REQ-022 Sessions B, D and E, `/api/health`, REQ-025 to REQ-029 Session A; REQ-030 A and B rows re-verified with anchors (Sentry server-side only, no browser SDK, no CSP change; the uptime route's gate; the runbook by name; the backup, its key holder and the 90 days) | 11 new rows; REQ-030 rows 81 to 88 | the same table, rows 81 to 99 |
| 3 | pass | `npm audit --omit=dev` at every level (FR-1c, AC-5) | Run on the branch's lockfile, every severity | 0 advisories (info, low, moderate, high, critical) over 288 production dependencies | `npm-audit.json` beside this file |
| 4 | pass | Security headers, every route class (FR-1d, AC-2) | `scripts/ops/check-headers.mjs` against a local production build of the branch on port 3100; the table in `check-headers-lib.mjs`; in CI the e2e job starts the build on port 3200 and runs it before the specs; `npm run headers -- --base <url>` on demand (GET only) | 13 route classes match: content, purchase, questionnaire, sign-in, guide, legal, 404, API, auditor and report pages with an unknown token, worker home, register page, the proxy's own redirect; 8 unit tests | `headers-local-build.json`; `scripts/ops/check-headers.test.ts`; commit 6517553 |
| 5 | ruled | The proxy's own redirects (`/documents`, `/checklist` signed out) | The 307 the proxy answers before the policy is built carries the static headers (HSTS, nosniff, referrer, permissions, X-Frame-Options DENY) and no Content-Security-Policy | a redirect with no body has nothing a policy governs; the table records the class as `csp: "none"` so a page there would fail | `check-headers-lib.mjs`, `ROUTE_CLASSES`; revisit if a redirect ever carries a body |
| 6 | pass | Rate limits (FR-1e, AC-3) | `tests/integration/rate-limits.test.ts`: thirteen database-backed limits pinned to the REQ's numbers and run against `auth_rate_limit_hit` on the local stack (hit n allowed, hit n+1 refused, a sibling key untouched, a fresh key per run, the anon key refused); `src/lib/ops/memory-limits.test.ts` for the three per-instance limiters (D-424); `src/server/auth/rate-limit-callers.test.ts` for every call site's plain refusal | 13 limits × 3 cases; 3 memory limiters × window and reset; 10 call sites, each a 429 or a plain message | the three files; commit c055884; the Supabase job's run on the PR |
| 7 | pass | RLS coverage (FR-1f, AC-4) | `src/lib/ops/rls-coverage.ts` computes the table-to-test map over the 48 `account_id` tables from the migrations and the integration tests' blocks; `rls-coverage.test.ts` fails on any missing kind; the `widgets` fixture fails naming all three kinds (the throwaway red cited) | first run: 14 tables short (account_facts; conflicts_of_interest, delegations, insurance_items, participant_risks; generation_jobs, generation_log, generation_quota, subscriptions, version_sets; policy_circulations, questionnaire_drafts, reminder_settings, risk_assessed_roles); after `tests/integration/rls-coverage-cases.test.ts`: 0 gaps | `rls-coverage-map.md` beside this file; commit 54216f6 |
| 8 | pass | gitleaks allow-lists (FR-1g) | `.gitleaks.toml` (one path list, `data/sources/`) and `.gitleaksignore` (six fingerprints) justified in place with the review date; `scripts/ci/gitleaks-config.test.ts` holds each to a reason and every inline marker to a fixture shape | 1 path list kept (32 Commission snapshots); 6 fingerprints kept (the e2e cron fixture in two commits before its marker; the scrub test's fake Stripe key and JWT-shaped cookie in 4c39a57; the same fake key in REQ-030's AC-2 at 269a96e); 0 removed | commits a6cabc3, c87abe4; D-2927 |
| 9 | pass | `npm ci` from the lockfile (FR-2) | Run locally from a clean `node_modules`; the e2e job now asserts the lockfile and the tree are unchanged after `npm ci` | tree clean; 815 packages | `.github/workflows/ci.yml` "The lockfile is what npm ci installed from" |
| 10 | pass | Actions pinned by commit SHA (FR-2, AC-6) | Every `uses:` in the seven workflows is a 40-hex commit with the version in a comment; `scripts/ci/workflows.test.ts` holds the shape or a `# tag kept:` reason | 30 `uses:` lines; 0 tags kept | commits 1785a32, 9ad2ec5, bcf35ee |
| 11 | ruled | Dependabot majors (FR-2, D-2902, D-2925) | Release notes read 18 Oct 2026; (b) for every major, pinned as SHAs | checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2, gitleaks-action v3.0.0, supabase/setup-cli v3.0.1, cache v6.1.0 (the kick workflow); #49, #50, #51, #52 and #54 superseded (the PO closes them); #53 and #55 the PO's merges on green | the Dev response in the REQ (question 4); the pins |
| 12 | gap | Dependabot itself (ASVS row 17) | `.github/dependabot.yml` was removed on 14 Oct 2026 by D-2005 ("off until launch"); REQ-012 D-2902 reads as if it runs | 0 configuration files on `main` or `next`; the open pull requests predate the removal | the PO's ruling asked 18 Oct 2026 (CHAT-2 20:27): keep D-2005 and close the pull requests as stale, or restore the file in one commit |
| 13 | pass | Report hygiene (SR-1, D-2913, D-2926) | `scripts/ops/check-report-authors.mjs` over this folder: no `git log` name or email and no address shape inside any file | 0 hits over the folder's files | `check-report-authors.txt` beside this file |

## Dependabot rulings, one line each (D-2902)

- `actions/checkout` 4 → 7 (#51): pinned to v7.0.1; the one default change blocks fork checkouts under `pull_request_target` and `workflow_run`, which no workflow here uses; ESM is internal.
- `actions/setup-node` 4 → 7 (#50): pinned to v7.1.0; automatic caching needs a `packageManager` field, which `package.json` lacks, and `cache: npm` stays explicit; the `NODE_AUTH_TOKEN` change concerns registry auth not used here.
- `actions/upload-artifact` 4 → 7 (#54): pinned to v7.0.2; default zipped uploads unchanged, `archive: false` is opt-in; the nine uses keep their `with:`.
- `gitleaks/gitleaks-action` 2 → 3 (#49): pinned to v3.0.0; "no changes to inputs, outputs, or behavior", Node 24; the licence applies to organisation repositories and this one is a personal account's (UNVERIFIED against the v3 README until the API allowance returned; the v2 reading stands).
- `supabase/setup-cli` 1 → 3 (#52): pinned to v3.0.1; installs from npm, `version: 2.120.0` stays a fixed pin, `github-token` removed and no longer passed; D-038's reason (the anonymous GitHub API limit) disappears with npm as the source.
- `actions/cache` 4 → 6 (no pull request; the kick workflow is new): pinned to v6.1.0 for Node 24.
- #53 (the npm development group, five updates) and #55 (`zod` 4.6.5 → 4.6.6): the PO's merges on green.
- Why move at all: every `v4` and `v2` action ran on Node 20; every job on 18 Oct carried the annotation "being forced to run on Node 24", and GitHub's dates (the default flipped 2 June 2026; Node 20 gone from hosted runners after 16 September 2026) say the forcing is the last stage.

## Fixes as separate commits (FR scope: "fixes as separate commits with tests")

- 1d69726 (on `req-030-session-b`, found by this review's rehearsal): the expired auditor link's fixed token made the suite fail on a restored stack; per run now.
- 54216f6: fourteen tables gained their RLS cases (see 7).
- c87abe4: four fingerprints for fixture literals the push scan flagged (D-2927).
- No header, limit or policy was loosened (SR-4): the header table, the limits and the coverage test refuse a loosening by failing.

## What this session did not do

- The OWASP ZAP baseline scan (out of scope until the domain; a backlog row after LAUNCH.md section 5).
- A route-level test of `/api/jobs/uptime`'s three answers and a stubbed-transport test for Sentry's AC-1 (named in `product/evidence/req-030/self-check.md`; the controls hold by the boundary test and `sentryOptions`).
- An automated assertion of the session cookie flags (ASVS re-verification row 4, the one row without a test): a Session B item for the Supabase job.
- Session B's accessibility, claims and performance work (FR-3 to FR-5).

## Counts

- `npm run check` on the branch head: green, 201 files, 1,534 tests.
- The Supabase job's integration half (rate limits, RLS cases) runs on the PR; no Docker on the Dev machine.

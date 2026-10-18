# REQ-030 Session A evidence (Dev-2, 18 Oct 2026)

Branch `req-030-session-a` from `next` 41825d4; commits 269a96e (the Dev response in the REQ, D-2344), 4c39a57 FR-1, 6fe69ad FR-3, f68f2ca FR-4, dfc0870 FR-6, and the evidence commit (the head) with D-2345, the ASVS rows and the PR body. No migration. D-2866 and D-2876 read first: the passphrase and the DSN are Haider's values, never held here; CI sees fixtures only. Session D's files of REQ-022 are untouched; Session B of this REQ (the backup, the restore rehearsal, the data-promises check, the legal lines, the backup row) is not started.

## FR and AC mapping

- FR-1, AC-1, AC-2 → `src/lib/ops/sentry.ts` and `sentry.test.ts`: no DSN, no options (nothing initialised); with a fixture DSN the options carry VERCEL_ENV, the sha, sampleRate 1, tracesSampleRate 0, sendDefaultPii false; `scrubEvent` leaves `[email]`, `[redacted]` and `[free-text omitted]`, strips `user`, cookies, body and query, keeps four headers, redacts URL path segments, keeps the `errorId` tag, never mutates the input. `src/instrumentation.ts` initialises for Node and Edge when enabled and exports `onRequestError` with the digest as the `errorId` tag; `src/app/error.tsx` shows the digest as the reference. No `withSentryConfig`, no browser SDK.
- FR-3, AC-6 → `scripts/ops/uptime-lib.mjs` and `uptime.test.ts`: the probe (health 200 with ok, home 200 with the brand; a network error is a failed probe), the judge (two strikes open, two passes close, a lone failure between passes opens nothing), the issue (one open issue reused; title `Site down <date>`; body of statuses and times only), the report (up and the two statuses with the bearer; skipped without the secret). `scripts/ops/uptime.mjs` is the command; the step in `.github/workflows/generate-kick.yml` runs ahead of the gate on `PROD_URL` alone with the state file cached; `scripts/ci/workflows.test.ts` asserts the shape.
- FR-3, AC-7 → `src/app/api/jobs/uptime/route.ts`: 404 without the bearer, `{ skipped }` off production (`cron-auth.ts`, the same gate as the other job routes), one `jobs.uptime.ran` row through `recordJobRun`; `handlers.test.ts` asserts the validation import and the gate. The row's first real write is the kick job's first run with the secret.
- FR-4, AC-10 → `product/ops/INCIDENTS.md` and `src/lib/ops/incidents-runbook.test.ts`.
- FR-6 → `launch.ts`, `launch-facts.ts`, `launch.test.ts`: **Uptime check within 90 minutes** (`UPTIME_WINDOW_HOURS` 1.5; set at 60 minutes, mismatched at 120, unset with no row) and **Error reporting** (`SENTRY_DSN` set or not, the value never in a sentence); `LAUNCH.md` steps 18a and 19b.
- SR-1 → the scrub test and the runbook test; SR-3 → `workflows.test.ts` (permissions) and `uptime.test.ts` (the issue's words); SR-4 → the route; SR-5 → runbook section 3 step 7.

## Counts

- `npm run check`: green, 181 files (1 skipped), 1,319 tests, 6 skipped.
- The once-a-session public run (D-2319), every public spec in CI mode on the three projects from a production build of dfc0870 on port 3100: 311 passed, 35 skipped, none failed in 20.2 minutes. The build carries `@sentry/nextjs` in `instrumentation.ts` only; `next.config.ts` is unchanged.

## Said, not built

- AC-12 is Haider's: the real DSN with one deliberate test error carrying no email, the first green **Uptime** row, the Sentry region and retention noted (LAUNCH.md 19b).
- The uptime check's state key is per run with a prefix restore, so a gap between runs restores the newest state; a cache eviction (seven days unused) starts the count from zero, which is the safe side.
- `npm install` in the Dev-2 tree fails on an npm arborist fault for this package's peer set (`Cannot read properties of null (reading 'edgesOut')`, npm 10.9.2); `--legacy-peer-deps` installed it but left the lockfile with one inconsistent nested `picomatch` entry, which `npm ci` refused; the lockfile was re-resolved from `next`'s with npm 12.2.0 (`npx npm@latest install @sentry/nextjs@11.8.0`), and `npm ci` with the system npm 10.9.2 from a clean `node_modules` then succeeds (674 packages); no `.npmrc` exists in the repository or the tree. Sentry's one peer, `next ^14 || ^15 || ^16.0.0-0`, fits 16.4.0.

# REQ-030 Session A: server-side error reporting, the uptime check, the incident runbook, their rows

Branch `req-030-session-a` from `next` 41825d4; PR to `next`. Dev-2, 18 Oct 2026. The Dev response first (in the REQ, on this branch), then one commit per FR with its tests, then the evidence. No migration. D-2866 and D-2876: the passphrase and the DSN are Haider's values; CI sees fixtures only.

## What this PR does

- **FR-1, Sentry server-side (D-2865, D-2875).** `@sentry/nextjs` 11.8.0, initialised in `instrumentation.ts` for Node and Edge only when `SENTRY_DSN` is set, from pure options in `src/lib/ops/sentry.ts`; every event passes `scrubEvent` (redact over message, exceptions, breadcrumbs, headers and extra; user, cookies, body and query stripped; URL path segments redacted); no tracing, no replay, no browser SDK, no `withSentryConfig`, no CSP change. `onRequestError` tags the request's `errorId` (Next's digest), which `src/app/error.tsx` shows the reader as the reference. AC-1 and AC-2 are unit tests.
- **FR-3, the uptime check (D-2867).** One step inside `generate-kick.yml` ahead of its gate, on `PROD_URL` alone; `scripts/ops/uptime.mjs` probes `/api/health` and `/`, keeps a two-strike count in a state file the Actions cache carries, opens one `Site down <date>` issue with `GITHUB_TOKEN` on the second consecutive failure and closes it after two passes, and reports to `/api/jobs/uptime` with `CRON_SECRET`; the route writes one `jobs.uptime.ran` row. AC-6 and AC-7's gates are tested; `workflows.test.ts` asserts the step, its condition, `issues: write` and the cache.
- **FR-4, the runbook (D-2868).** `product/ops/INCIDENTS.md`, eight sections for a non-infrastructure reader, held by `incidents-runbook.test.ts` (AC-10).
- **FR-6, the rows.** **Error reporting** and **Uptime check within 90 minutes** on `/admin/launch`; `LAUNCH.md` steps 18a and 19b. The backup row is Session B's.

## Checks

- `npm run check`: green, 181 files (1 skipped), 1,319 tests, 6 skipped.
- Every public spec in CI mode on the three projects from a production build: 311 passed, 35 skipped, none failed in 20.2 minutes.
- Evidence: `product/evidence/req-030/a-evidence.md`; D-2344 and D-2345 in `DECISIONS.md`; the ASVS rows under "REQ-030 Session A additions".

## For the PO

- The Dev response's fifth question (the two-strike memory as a cached state file) is built as recommended; if you would rather the issue itself be the memory, the judge's inputs are the same and only the command changes.
- `npm install` in the Dev-2 tree needs `--legacy-peer-deps` for this package (an npm arborist fault on its peer set); the lockfile is consistent and CI's `npm ci` is unaffected.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

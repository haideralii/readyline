# REQ-004: Accounts, authentication and tenancy
Status: ready (Dev response first; build after Haider creates the Supabase project)
Phase: 2   Priority: must   Owner: Dev

## Why
A provider needs to come back to their questionnaire, buy, download documents and keep registers over three years. That needs an account, and every later feature's security depends on tenancy being right from the first table: one provider must never see another's data.

## Scope
In: Supabase project wiring (ap-southeast-2, D-023), email magic-link sign-in, account and membership model (one account per provider business; one owner user now, members later), row-level security on every table, server-side data access only, the `DraftStore` server implementation for REQ-003, account settings (business details), data export (JSON zip) and account deletion (soft delete, purge job), session handling, admin role for Haider behind MFA.
Out: payments, registers, documents, multi-member invitations (model it, do not build the UI).

## Domain rules that apply
`CLAUDE.md` 4.5 and the threat model (identity and access, data). No participant data is stored anywhere in this REQ.

## Functional requirements
- FR-1 Sign in with email magic link only (no passwords, no social logins for now). Rate-limited: 5 requests per email per hour, 20 per IP per hour; generic success message whether or not the email exists.
- FR-2 First sign-in creates a `users` row and, after a short "about your business" step (prefilled from any local questionnaire draft), an `accounts` row with the user as `owner`. Local draft is migrated to the server draft and cleared locally (REQ-003 SR-4).
- FR-3 Tables: `users`, `accounts`, `memberships (user_id, account_id, role: owner|member)`, `questionnaire_drafts (account_id, answers jsonb, version, updated_at)`, `audit_log (account_id, actor_user_id, action, target, at)`; later REQs add theirs. Every account-scoped table has `account_id` and RLS policies that allow access only through an active membership.
- FR-4 All data access goes through server code with the user's session; the service-role key is used only in server-only modules for admin and purge jobs and is never imported by client code (lint rule or test).
- FR-5 Account settings page: trading name, structure, states, ABN; change requires re-validation with the REQ-003 schemas.
- FR-6 Export: owner can download a JSON zip of everything stored for the account within the request (sync for now). Deletion: owner can delete the account; it is soft-deleted immediately (sign-in blocked, data hidden) and purged by a scheduled job after 30 days, including storage objects; an email confirms both events.
- FR-7 Admin: a `platform_admin` flag on Haider's user only, settable only via SQL; admin routes require MFA (Supabase TOTP) and are allow-listed server-side; admin actions are written to `audit_log`.
- FR-8 Sessions: Supabase SSR cookies (HttpOnly, Secure, SameSite=Lax); sign out everywhere on password-less reset (re-issuing a magic link) is not needed, but "sign out of all devices" is.

## Security and privacy requirements
- SR-1 RLS on every table; a test signs in as two users and proves user A cannot read, update or delete user B's rows by id through any route or action.
- SR-2 CSP `connect-src` extended only to the Supabase project origin; recorded in `DECISIONS.md`.
- SR-3 Rate limiting on the magic-link endpoint and on export; limits recorded.
- SR-4 Logs never contain emails in clear (hash) or draft contents.
- SR-5 Secrets only in environment; `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the new `sb_publishable_…` key) and `SUPABASE_SECRET_KEY` (the new `sb_secret_…` key, server only) with where each lives in production. *(PO, 11 Oct 2026)* The project was created with Supabase's new API key format; use the publishable and secret keys, not the legacy anon and service_role keys, and confirm `@supabase/ssr` accepts the publishable key. Project ref `dpwwzhylcyosnkmlcnnp`, region ap-southeast-2 (confirmed on the dashboard).
- SR-6 Migrations are files in the repo (`supabase/migrations`), applied by CI to a disposable test database for the RLS tests; never hand-edited in the dashboard.

## Data
As FR-3. Retention: soft delete 30 days then purge; audit log kept 2 years.

## Acceptance criteria
- AC-1 Given a new email, when a magic link is requested and followed, then a user and an owner membership exist and the user lands on the "about your business" step; given an unknown email, the UI shows the same message and no error leaks.
- AC-2 Given two accounts A and B with data, when user A requests any of B's rows by id through every route and action that exists at delivery, then the response is not found or forbidden and nothing is written (automated RLS test).
- AC-3 Given a local questionnaire draft exists, when the user signs in, then the draft is on the server, the local copy is cleared, and the questionnaire resumes at the same step.
- AC-4 Given the owner requests export, then a zip downloads containing every row for the account and nothing from any other account.
- AC-5 Given the owner deletes the account, then sign-in is refused immediately, the data is invisible to all routes, a confirmation email is sent, and the purge job (run manually in the test) removes the rows and objects.
- AC-6 Given six magic-link requests for one email in an hour, then the sixth is refused with a polite message and no email is sent.
- AC-7 Given a non-admin user, when any admin route is requested, then 404; given Haider's user without a completed MFA challenge, then the MFA step is required first.
- AC-8 Given the client bundle, then the service-role key string does not appear in it (build-time test).

## Test expectations
Integration tests against a disposable Supabase (local via the Supabase CLI in CI) for RLS, export, deletion, rate limits; e2e for sign-in and draft migration on both projects (with the email captured from the local inbox tool).

## Evidence required on delivery
CI link with the RLS suite visible; migration files; a screenshot of the Supabase project region; the `.env.example` diff; a short note on anything the Supabase CLI could not do in CI.

## Questions for Dev to answer before building
1. Supabase CLI local stack in GitHub Actions: feasible within the 20-minute budget? Propose the job layout.
2. Magic-link rate limiting: Supabase's built-in limits versus our own; recommend and state the numbers.
3. How will the purge job run (Supabase cron, Vercel cron, GitHub Actions schedule)? Recommend with the trade-off.
4. Estimate in sessions, and exactly which values Haider must supply from the Supabase dashboard (names only, never values in chat).

## Dev response

Written 2026-10-11 on branch `req-004-accounts` (from `main`). Dev response only; nothing provisioned, no code.

### Q1. Supabase CLI local stack in GitHub Actions

Feasible inside the 20-minute budget. The Supabase CLI runs the full stack (Postgres, Auth, Storage, the local mail inbox) in Docker, which the `ubuntu-latest` runner already has. Cold start is dominated by pulling images (roughly 3 to 5 minutes the first time; GitHub's runner image caches nothing between runs, so plan for the cold number), then `supabase db reset` applies `supabase/migrations/*` in seconds.

Proposed job layout, a third job beside `checks` and `secrets` so the existing lint-to-e2e path stays fast:

```
jobs:
  supabase-integration:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - checkout; setup-node (cache npm); npm ci
      - uses: supabase/setup-cli@v1          # pins a CLI version
      - run: supabase start -x studio,imgproxy,logflare,vector   # keep db, auth, storage, mail inbox
      - run: supabase status -o env >> $GITHUB_ENV              # exports API URL, anon and service-role keys for the local stack
      - run: npm run test:integration        # vitest project "integration": RLS cross-tenant, export, deletion + purge, rate limits
      - run: npm run build && npm run test:e2e -- --grep @auth   # sign-in and draft migration on both Playwright projects, magic-link email read from the local inbox API
      - if: always() -> supabase stop; upload Playwright report on failure
```

Trade-offs: the local stack's keys are throwaway and printed only into the job environment, never into logs; the integration tests run against a real Postgres with the real RLS engine, which is the point of SR-1 and AC-2. If image pulls ever push the job past budget, the fallback is a dedicated Supabase "test" project in Sydney with its own keys as repository secrets and `supabase db reset --linked` per run; slower to set up, no Docker.

### Q2. Magic-link rate limiting

Recommendation: our own limiter in front of Supabase, with Supabase's built-in limits kept as the backstop.

- Ours, in the sign-in server action before `signInWithOtp` is called: 5 requests per email per rolling hour and 20 per IP per rolling hour, exactly the REQ numbers. Keyed by SHA-256 of the lower-cased email (so the limiter table never holds emails in clear, SR-4) and by the client IP from the platform header. Stored in a small `auth_rate_limits` table (`key`, `window_start`, `count`) updated by a Postgres function in one statement, so two concurrent requests cannot both pass. The response is the same generic "If that address is registered you will receive a link" whether the email exists, is unknown, or was rate limited (AC-1, AC-6); the limited case simply does not call Supabase.
- Supabase's built-in: the project-level email send limit (configurable per hour once custom SMTP is set; the default SMTP allows only a handful of emails per hour and is for development only) and the per-IP OTP limits on the Auth endpoints. These stay on as a second layer. Consequence recorded against D-013: a transactional email provider with custom SMTP is required before any real sign-in traffic, so REQ-009's provider decision is pulled forward to REQ-004's build.

Why not built-in only: its limits are per project and per IP, not per email, and the numbers are not ours to set precisely; the REQ's acceptance criteria name per-email counts.

### Q3. Purge job

Options:

1. **Vercel Cron hitting a route handler (recommended).** A daily `GET /api/jobs/purge` protected by the `CRON_SECRET` header Vercel sends, using the service-role client in a server-only module to delete rows for accounts soft-deleted more than 30 days ago, delete their storage objects through the Storage API, write an `audit_log` row, and send the confirmation email. Idempotent (re-running finds nothing to do) and unit-testable by calling the handler with a fake clock. Trade-off: on the Hobby plan cron runs once a day within an hour window, which is fine for a 30-day purge; it couples the job to Vercel, which already hosts the app.
2. **pg_cron inside Supabase.** Runs without any external trigger, but deleting storage objects by SQL does not remove the files, so it would need pg_net calling an Edge Function; two moving parts and harder to test locally.
3. **GitHub Actions schedule.** Keeps production secrets in a third place and runs from outside the production boundary; rejected.

Manual run for AC-5 testing: the same handler accepts a `dryRun` flag and is invoked directly in the integration test with the clock advanced.

### Q4. Estimate and values Haider must supply

Three sessions. A: Supabase wiring (`@supabase/supabase-js` and `@supabase/ssr`, two runtime dependencies justified by REQ-004 FR-8), migrations for `users`, `accounts`, `memberships`, `questionnaire_drafts`, `audit_log` with RLS, the CI stack job and the cross-tenant test. B: magic-link sign-in with our limiter, account bootstrap, local-draft migration (AC-3), account settings. C: export, soft delete and purge, admin flag with MFA, e2e on both projects, evidence.

Values to copy from the Supabase dashboard into `.env.local` (names only; production copies go into Vercel project environment variables, server-only ones never prefixed `NEXT_PUBLIC_`):

- `NEXT_PUBLIC_SUPABASE_URL` (Project Settings, API, Project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings, API, anon public key)
- `SUPABASE_SERVICE_ROLE_KEY` (Project Settings, API, service_role key; server only)
- `SUPABASE_PROJECT_REF` (Project Settings, General, Reference ID; used by the CLI to link, not by the app)
- `SUPABASE_DB_PASSWORD` (set when the project is created; used only by `supabase db push` from the dev machine, never by the app or CI)
- `SUPABASE_ACCESS_TOKEN` (Account, Access Tokens; a repository secret for CI only if we ever push migrations from CI)
- `CRON_SECRET` (not from Supabase; generated by us and set in Vercel for the purge route)

Dashboard settings Haider will be asked to make at build time, not now: region `ap-southeast-2` (screenshot for evidence), Site URL and redirect URLs for the magic link, MFA (TOTP) enabled, custom SMTP once the email provider is chosen.

### Notes

- SR-2: `connect-src` gains the Supabase project origin only; recorded in `DECISIONS.md` when wired.
- AC-8 (service-role key absent from the client bundle): a build-time test will grep `.next/static` for the key prefix and for the variable name; the key itself lives only in `src/server/**` modules marked `server-only`.
- The `DraftStore` server implementation and the "about your business" step reuse the REQ-003 schemas unchanged.

## Delivery evidence

### Session A (2026-10-11), branch `req-004-accounts` (rebased on `main` at 7f68349)

Gate: `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (presence checked, values never printed). Nothing was provisioned by Dev.

**Built**

- `supabase/migrations/20261011000000_init_accounts.sql`: `users` (auth mirror by trigger, email hash only, `platform_admin` guarded by trigger), `accounts` (soft delete), `memberships`, `questionnaire_drafts`, `audit_log`, `auth_rate_limits`; `is_member()`, `is_owner()`, `create_account()`; RLS enabled on every table with policies as listed in D-402; grants so clients can only call `create_account` and cannot touch the limiter table.
- `supabase/config.toml` for the CLI local stack (D-403).
- `src/server/supabase/{env,server,admin}.ts`: SR-5 variable names, SSR client bound to session cookies (HttpOnly, Secure in production, SameSite=Lax), admin client with the secret key, both `server-only`; unit tests for the env contract.
- `tests/integration/rls.test.ts` and `vitest.integration.config.mts` (`npm run test:integration`): two tenants created through the admin API and `create_account()`; asserts each sees only its own account, membership and draft; reads of the other's rows by id return nothing; updates and deletes of the other's rows write nothing; direct inserts into `accounts` and `memberships` fail; a client cannot set `platform_admin`; the limiter table is unreachable with the publishable key; a soft-deleted account disappears from its own members.
- CI job `supabase-integration` (D-403). `.env.example` documents the three variables and where they live in production; `.gitignore` excludes CLI artefacts.
- Dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `server-only` (D-401).

**Not verified locally (D-404):** no Docker, CLI or database password on the dev machine, so the migration has not been applied anywhere yet and the RLS suite has not executed; it skips itself without the stack. The CI run on this push is the first execution. Haider: please apply the migration to the hosted project (`npx supabase login`, `npx supabase link --project-ref dpwwzhylcyosnkmlcnnp`, `npx supabase db push`) and attach a screenshot of the project region; both are needed before Session B.

**Local outputs:** see the Dev status in `product/NEXT.md` for the `npm run check` and `npm run build` results on this commit.

### Session B (2026-10-11), branch `req-004-accounts` (now stacked on `req-003-questionnaire` at b2f1ee9, D-412)

Gate unchanged: the three Supabase variables are present in `.env.local`; values never printed. The branch was rebased from REQ-002 onto REQ-003 because Session B reuses the questionnaire schemas, form primitives and `DraftStore` interface; Session A's two commits are unchanged in content. Merge order on GitHub: PR #2 (REQ-002), then REQ-003, then PR #4.

**PO Session A review items**

1. Database constraints mirroring the zod schema: `supabase/migrations/20261011010000_session_b_hardening.sql` adds checks for `trading_name` length 1 to 120, `business_structure` in the six answers, `states` elements in the eight codes, `abn` 11 digits or null (D-405). Covered by `tests/integration/session-b.test.ts` ("database constraints reject values the zod schema would reject").
2. One owner account per user: unique partial index `memberships_one_owner_per_user` plus an explicit raise in `create_account()` (D-405). Covered by the same suite ("create_account works once per user and refuses a second owner account").
3. PR #4 CI link: Dev cannot read GitHub Actions from this machine (no token; unauthenticated API returns 404), so the link is not attached here. The run to look at is the `supabase-integration` job on the latest push of `req-004-accounts`; it is the first execution of both the Session A RLS suite and the Session B suite.

**Built**

- Sign-in (FR-1, AC-1, AC-6): `/sign-in` page and form; `requestMagicLink` server action validates `{email, next}` strictly, runs the per-email and per-IP limiter (`auth_rate_limit_hit` in Postgres, D-406), calls `signInWithOtp` with a same-origin redirect, and returns the same generic message whether the address is known, unknown or limited. Logs carry only the SHA-256 of the lower-cased email.
- Callback and session (FR-8, SR-3): `/auth/callback` exchanges the code, sends users without an account to `/account/setup` and others to a validated same-origin `next` path (`safeNextPath`, unit-tested in `src/server/auth/paths.test.ts`); `signOut` (this device) and `signOutEverywhere` (global scope) on the account page (D-407).
- Account creation (FR-2, AC-3): `/account/setup` "About your business" prefilled from the local questionnaire draft, `createAccountAction` through `create_account()`; after creation the local draft is saved to the account with `saveServerDraft`, the local copy is cleared and the user resumes at the first incomplete step.
- Server `DraftStore` (REQ-003 FR-3 storage swap): `/start` layout picks `mode="server"` for a signed-in owner; the provider wraps `loadServerDraft` / `saveServerDraft` / `clearServerDraft` and migrates a leftover local draft on first load (D-408). Questionnaire UI unchanged.
- Settings (FR-5): `/account` edits trading name, structure, states and ABN through `updateAccountAction` (owner-only by RLS, audit row written). Header shows "Sign in" or "Account" from the session.
- CSP (SR-2): `connect-src` gains exactly the Supabase project origin derived from `NEXT_PUBLIC_SUPABASE_URL` (D-409); `src/proxy.test.ts`.
- AC-8: `scripts/ci/check-client-bundle.mjs` scans `.next/static` after the build in CI and as `npm run check:bundle` (D-411). Local result on this build: 21 client files scanned, no secret material.
- Migration deploy: `.github/workflows/migrate.yml` (push to `main` touching `supabase/migrations/**`, or by hand); project `dpwwzhylcyosnkmlcnnp`; needs `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as repository secrets and skips with a notice until they exist (D-410). `SECURITY.md` now has a table of every secret, who uses it and where it lives.
- Tests: `tests/integration/session-b.test.ts` (limiter 5 allowed then refused, limiter unreachable with the publishable key, second account refused, four constraint violations, draft round trip); `e2e/sign-in.spec.ts` (form validation and generic response, signed-out redirects for `/account` and `/account/setup`, header link) on both viewports; unit tests for `safeNextPath`, `clientIp` and the CSP origin.

**Local outputs on this commit**

- `npm run check`: lint clean, Prettier clean, typecheck clean, 22 unit files / 244 tests passed.
- `npm run build`: success; all routes dynamic (`/`, `/account`, `/account/setup`, `/auth/callback`, `/sign-in`, `/start`, `/start/[step]`).
- `npm run check:bundle`: 21 files scanned, no hits.
- Playwright in CI mode (production server, one worker): 38 passed, 2 skipped (screenshot captures), both projects. Note: with the default parallel dev-server run on this machine the desktop project timed out on `page.goto` during cold compiles; the production-server run is the one that matches CI.
- During the e2e run the sign-in action reached the hosted project and logged `PGRST202` (function `auth_rate_limit_hit` not found): no migration has been applied there yet, so the limiter failed closed and no email was sent (D-406). Sign-in on the hosted project starts working once `migrate.yml` has run with the two secrets.

**Not verified locally (D-413):** the two migrations, the limiter function and both integration suites have not executed on this machine (no Docker, CLI or database); the `supabase-integration` job on this push is their first run. The end-to-end magic-link journey through a real inbox has no automated test yet.

**For Haider:** add the GitHub repository secrets `SUPABASE_ACCESS_TOKEN` (Supabase dashboard, Account, Access tokens) and `SUPABASE_DB_PASSWORD` (project settings, Database). After the REQ-004 merge the migration workflow applies both migrations; until then the account pages cannot create an account against the hosted project.
### Session C (2026-10-11), branch `req-004-accounts-rebuilt` (on `req-003-questionnaire-rebuilt`; D-414)

Branch rebuilt: `main` already holds Sessions A and B through the PO's batch-5 commit afeab24, so this branch is the rebuilt REQ-003 head plus one Session C commit. Old head 9452905 stays on GitHub as `req-004-accounts` until replaced (commands in the batch-5 Dev status).

**Built**

- Export (FR-6, AC-4): `GET /account/export` returns a zip (`account.json` with account, memberships, questionnaire draft and audit log; README with the no-participant-data rule), built with the owner's session so RLS bounds the content, limited to 5 per account per hour, logged as `account.exported` (D-417). Link on the account page.
- Deletion (FR-6, AC-5): `delete_account()` (security definer) soft-deletes and writes `account.deleted`; the account page has a confirm-then-delete form; the action sends the confirmation email, signs out everywhere and lands on `/account/deleted`. The callback refuses sign-in for a deleted account and the account pages redirect to the deleted page (D-415).
- Purge (FR-6, AC-5): `runPurge()` with injected admin client, email provider and clock; `GET /api/jobs/purge` behind `CRON_SECRET` (404 otherwise, `?dryRun=1`), scheduled daily by `vercel.json`; removes rows, storage objects by account prefix and the auth user when orphaned, sends the "permanently removed" email, writes `account.purged` (D-416).
- Admin (FR-7, AC-7): `/admin` (counts and the last 25 audit rows, read with the service key after the gate) and `/admin/mfa` (TOTP enrol with QR, or verify); `requireAdmin()` gives 404 to non-admins and anonymous visitors and sends admins without an aal2 session to the MFA step; every view and MFA step is audited (D-418). `platform_admin` stays SQL-only (Session A trigger).
- Emails (FR-6): `EmailProvider` interface with the log-only implementation and two tested templates (D-419). No provider chosen (D-013); nothing is sent.
- Audit writes by members now allowed by policy (D-420); the Session B `account.updated` write was silently rejected before.
- Env: `CRON_SECRET` in `.env.example` and `REQUIRED_LATER`; the Supabase names in `REQUIRED_LATER` corrected to the SR-5 names. `fflate` added (D-417).

**Tests**

- Unit (new): `resolveAdminAccess` (four states), `isAuthorisedCronRequest` (exact bearer, unset or short secret), email templates (dates, general-information line, claims). Total 253.
- Integration (`tests/integration/session-c.test.ts`, runs in the `supabase-integration` job): member-scoped audit inserts; export contains every row for A and nothing of B, and B cannot export A (AC-4); ordinary users are not admins (AC-7); `delete_account` hides the account at once, a second call fails, the purge does nothing before 30 days, dry run lists without deleting, the real run removes the account and the auth user and sends the email, a second run is a no-op and A is untouched (AC-5).
- End-to-end (`e2e/admin.spec.ts`, both projects): `/admin` and `/admin/mfa` are 404 anonymously, the purge route is 404 without the secret, export redirects to sign-in, the deleted page renders.

**Local outputs on this commit:** `npm run check` clean (25 files, 253 tests); `npm run build` ok, new routes `/account/deleted`, `/account/export`, `/admin`, `/admin/mfa`, `/api/jobs/purge`; bundle check 26 files clean; Playwright in CI mode: admin, sign-in, security headers and home specs 22 passed on both projects (questionnaire and axe specs passed on the REQ-003 commit below this one).

**Not verified locally (D-413 still applies):** the Session C migration, `delete_account()`, the purge and the export integration suite run first in the `supabase-integration` job on this push. The TOTP flow cannot be exercised without a platform admin (set by SQL on the hosted project) and TOTP enabled in Auth settings; Haider: enable TOTP, run `update public.users set platform_admin = true where id = '<your user id>'` in the SQL editor once, then open `/admin`. The hosted project still returned `PGRST202` for the limiter function during this run, so the migrations are not applied there yet; please check the `migrate.yml` run on `main`.
### 2026-10-11, PO batch 6 item 1: `migrate.yml` over a database URL (D-036), branch `req-004-migrate-dburl`

`supabase link` removed. The job now builds `DB_URL` in a step from `SUPABASE_DB_PASSWORD` (URL-encoded with Python's `urllib.parse.quote`), the project ref and the ap-southeast-2 session pooler (`postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`), masks the raw password, the encoded password and the whole URL with `::add-mask::`, exports the URL only through `GITHUB_ENV`, and runs `supabase db push --include-all --db-url ""` followed by `supabase migration list --db-url`. The secrets gate, the skip notice and `workflow_dispatch` are kept. Nothing echoes the URL. PR note: open a PR from `req-004-migrate-dburl` to `main`; merging it changes `.github/workflows/migrate.yml` only, and the next push that touches `supabase/migrations/**` (or a manual dispatch) applies the three migrations to the hosted project.
### 2026-10-11, PO batch 6 item 2: operator script for the admin grant, same branch

`supabase/ops/grant-platform-admin.sql`: one `update` that sets `platform_admin = true` where `email_hash` equals the SHA-256 of the lower-cased `:email` placeholder (the same expression the auth trigger uses), plus a check `select` that should return one row. The header explains it is run once by the operator in the SQL editor after the admin's first sign-in, that the API path is blocked by the `users_protect_platform_admin` trigger, and that TOTP must be enabled before opening `/admin`.
## PO review

**11 Oct 2026, Dev response review (on `req-004-accounts`, 2c5f6de): ACCEPTED; build approved once Haider's Supabase project exists.** Decisions: own per-email and per-IP limiter in front of Supabase (accepted, with the hashed-email key); Vercel Cron purge route protected by `CRON_SECRET` (accepted); Supabase CLI local stack in CI with the integration project (accepted; if it exceeds the 20-minute budget, split into its own job). Haider will supply, by name: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `CRON_SECRET` is generated by Dev. The REQ-003 build does not depend on these; REQ-004 Session A may start as soon as `.env.local` has them. Status: `in progress` once the build starts.

**11 Oct 2026, Session A review (branch `req-004-accounts`, b9f6ee1, PR #4): APPROVED to continue; two hardening items for Session B.** Read the migration: hashed emails, `is_member`/`is_owner` as `security definer` with `search_path` pinned, `platform_admin` change blocked when a JWT is present, `auth_rate_limits` revoked from client roles, `create_account` as the only client-callable function. Good. Items: (1) add database constraints mirroring the zod schema (`trading_name` length 1–120, `business_structure` in the allowed set, `states` elements in the eight codes, `abn` 11 digits or null) so the database never trusts the app; (2) cap accounts per user (one owner account per user for now; raise an error on the second) to stop account spam through `create_account`; (3) the RLS suite's first real run is PR #4's CI job; attach its link in Delivery evidence. The hosted migration apply is a deployment concern: see the migration-deploy item in `product/NEXT.md` batch 4 rather than a manual `db push`.

**11 Oct 2026, Session B review (9452905, PR #4): APPROVED to continue to Session C.** PR #4's `supabase-integration` job ran the migrations and the RLS suite on the local stack: 12 passed, 2 skipped (hosted-only). The hardening items are in with tests. The app job on PR #4 failed only on Prettier for `DECISIONS.md` (prose edited by the PO; fixed in batch 5 by ignoring the file), and the gitleaks job fails on the inherited REQ-002 fixture commit. Session C (export, deletion and purge route, admin role with MFA, `audit_log` on admin actions) may proceed on the rebased branch. Hosted migrations will be applied by `migrate.yml` once Haider adds the two secrets.

**11 Oct 2026, Session C review on PR #7 (`req-004-accounts-rebuilt`, 1afa395): ACCEPTED subject to green CI.** Read `api/jobs/purge` (404 unless a constant-time match on `CRON_SECRET`, unset secret means inert, dry-run mode), `admin/*` (404 for non-admins, TOTP enrol and verify flows, aal2 required), the export route and the Session C migration. Merge after #6 when CI, including the Supabase integration job, is green. Then three operator steps remain before the hosted project is usable, tracked in the queue: migrations applied by `migrate.yml` (D-036), TOTP enabled in the hosted Auth settings, and `platform_admin` granted to Haider's user by SQL once he has signed in. `CRON_SECRET` is set when the Vercel project is created (REQ-010). Status: accepted.

**12 Oct 2026: PR #7 merged (Session C on main). PR #8 (migrate via db-url, admin grant script) is accepted but conflicts with `main` in this file; Dev resolves and the PO merges.** Operator steps after PR #8 lands and the migrate job is green: enable TOTP in the hosted Auth settings; sign in once; run `supabase/ops/grant-platform-admin.sql`. `CRON_SECRET` at Vercel setup (REQ-010).

## Follow-up FR-9: magic link works on any device (PO, 12 Oct 2026)
Found on Haider's first hosted sign-in: the link was requested in one browser and opened from Gmail in another, and the callback rejected it ("That link did not work") because the code-exchange flow needs the verifier stored by the requesting browser. A support worker who fills in the questionnaire on a laptop and opens email on a phone will hit this.
- FR-9a Switch the magic link to the token-hash style: the Supabase email template links to `{SITE}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=...`, and the callback verifies with `verifyOtp({ token_hash, type })`. Keep the code-exchange path for any older link still in flight for 24 hours, then remove it. Operator step for Haider: paste the new template into Supabase Auth → Emails → Magic Link (Dev writes the exact template into `supabase/ops/magic-link-template.html`).
- FR-9b "Link is on its way" screen: add one line, "The link works once and expires in an hour." No same-device warning.
- FR-9c Failure screen: plain message naming the likely cause ("The link has expired or was already used"), the email field prefilled from the link where safe, and the callback's error code logged (redacted email) so patterns are visible in the admin audit view.
- AC: e2e that requests a link in one browser context and opens it in a fresh context lands signed in; unit test for the callback's two paths; screenshots of the two screens.

### Delivery evidence for FR-9 and FR-10 (Dev, 2026-10-12, batch 18 addendum; branch `req-004-magic-link-any-device`)

- **FR-9a** (D-421): `src/server/auth/callback.ts` decides the path (token hash wins; legacy code until 2026-10-13, then `legacy-expired`); `/auth/callback` verifies with `verifyOtp({ token_hash, type })` or, on the legacy path, `exchangeCodeForSession`, and logs the error code and path on failure. Template for Haider: `supabase/ops/magic-link-template.html` (paste into Authentication, Emails, Magic Link on the hosted project; it appends `&token_hash={{ .TokenHash }}&type=magiclink` to the redirect our action sends). Unit tests: `callback.test.ts` (token-hash path, legacy path before and after the cut-off, precedence, malformed and missing input). Integration test `tests/integration/magic-link-token-hash.test.ts`: a client that never requested the link verifies a generated hash into a session, and the hash is single use (CI's Supabase job).
- **FR-9b and FR-9c** (D-423): the sent message now ends "The link works once and expires in an hour; open it on any device."; the failure screen says "The link has expired or was already used. Request a new one below; the new link works on any device." The email field is not prefilled: the token-hash link carries no address and an address in a URL would reach logs and referrers (FR-9c "where safe": never).
- **FR-10** (D-422): `getOwnedAccount` moved to `src/server/accounts/owned-account.ts` as two plain queries with every database error logged (code and message, no email). That logging showed the hosted cause on the first e2e run: `42501 permission denied` on `memberships` for `authenticated`, because no migration ever granted table privileges to the signed-in role (the hosted project has no default grants; the local stack does, which is why CI never saw it, as with the function grants in D-538). Migration `20261012060000_authenticated_table_grants.sql` grants per table exactly what the policies allow and reloads PostgREST's schema cache (`20261012050000_reload_postgrest_schema.sql` reloads for the earlier migrations). `tests/integration/account-readback.test.ts` creates an account through the RPC as a signed-in user and reads it back through the same function. **Until the migration is applied on the hosted project (on merge), sign-in there still cannot load an account; Haider can apply the grants early from the SQL editor with the migration's statements.**
- **e2e** `e2e/magic-link-any-device.spec.ts`: context 1 requests the link on `/sign-in`; the test takes the token hash from the admin API (no mailbox to read); context 2 opens the callback cold and lands on `/account/setup` signed in. Runs where the three Supabase variables exist (locally from `.env.local`, read inside the test); the second test checks the failure screen and captures the two screens with `EVIDENCE=1` into `product/evidence/req-004/`.

**PO review of FR-9 and FR-10 (12 Oct 2026, branch `req-004-magic-link-any-device`, f622ef8; PR #14): ACCEPTED.** D-421 to D-423 accepted. The real cause of the hosted read-back failure was missing table grants to `authenticated`, the second grant gap found by running against the hosted project rather than the local stack; the migration fixes it and the integration suite now covers it. Operator step for Haider: paste `supabase/ops/magic-link-template.html` into Supabase Auth → Emails → Magic Link.

## Delivery evidence (standing backlog 5, Dev, 14 Oct 2026; branch `req-004-admin-hardening`, D-424)

OWASP ASVS level 1 re-check against SR-1 to SR-5 and the threat model's "rate limiting" and "CSRF" lines; the table is `product/security/asvs-l1-check-2026-10-14.md`.

- **Inventory of every boundary on this branch.** Route handlers: the Stripe webhook (signature), three cron routes (bearer secret, 404 otherwise), the auth callback (single-use token), the account export, four register exports and the document download (session plus a database limiter), the health route and the sample document (in-memory per-address limiter). Server actions: all behind `getViewer`, `getOwnedAccount` or the admin context, with database limiters on register writes (60 a minute per user), checkout (5 an hour per account) and the generation quota; the fake Checkout action is inert outside fake mode. The one public action, `deriveResult` (the questionnaire's derivation, signed out, stores nothing), had no limit.
- **Rate limit on every public POST (SR-3).** `deriveResult` now refuses the 121st call per address per minute with a plain message ("Too many requests from your connection just now. Wait a minute and try again."), using the same in-memory fixed window as the health route; per instance, acceptable for a pure-compute action that must work without a database.
- **Enforced by a test.** `src/lib/validation/handlers.test.ts` "boundaries are gated": every route handler and `"use server"` file must contain a session gate, a secret or signature check, or a limiter call (the four register export routes qualify through the shared handler they delegate to); a second case pins the per-address limiter on the three public files. Proved failing: the first run listed the four export routes before the delegation was allowed.
- **CSRF on every form.** Next's origin check on server actions is the control for every form, with `form-action 'self'` in the CSP as the second layer; the only mutating route handlers are the signed webhook and the secret-gated job routes, and no cookie-authenticated GET mutates. `e2e/csrf-and-abuse.spec.ts` proves it: an action posted with a foreign `Origin` is refused (the server logs "does not match origin header ... Aborting the action"), the three job routes answer 404 without the secret and with a wrong one, the webhook refuses an unsigned body and a badly signed one (the route logs "missing signature" and "bad signature"), and the health route answers a loop with 429. 4 passed on desktop Chromium.
- **Cookies and sessions (SR-1, FR-8), re-read.** HttpOnly, Secure in production, SameSite=Lax in `src/server/supabase/server.ts`; sign out here and everywhere on the account page. Unchanged.
- **Not changed.** The limiter numbers in SR-3 and D-406; the admin MFA path; nothing new needs a paid service.


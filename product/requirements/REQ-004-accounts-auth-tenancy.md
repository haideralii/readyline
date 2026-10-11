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
### 2026-10-11, PO batch 6 item 1: `migrate.yml` over a database URL (D-036), branch `req-004-migrate-dburl`

`supabase link` removed. The job now builds `DB_URL` in a step from `SUPABASE_DB_PASSWORD` (URL-encoded with Python's `urllib.parse.quote`), the project ref and the ap-southeast-2 session pooler (`postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`), masks the raw password, the encoded password and the whole URL with `::add-mask::`, exports the URL only through `GITHUB_ENV`, and runs `supabase db push --include-all --db-url ""` followed by `supabase migration list --db-url`. The secrets gate, the skip notice and `workflow_dispatch` are kept. Nothing echoes the URL. PR note: open a PR from `req-004-migrate-dburl` to `main`; merging it changes `.github/workflows/migrate.yml` only, and the next push that touches `supabase/migrations/**` (or a manual dispatch) applies the three migrations to the hosted project.
## PO review

**11 Oct 2026, Dev response review (on `req-004-accounts`, 2c5f6de): ACCEPTED; build approved once Haider's Supabase project exists.** Decisions: own per-email and per-IP limiter in front of Supabase (accepted, with the hashed-email key); Vercel Cron purge route protected by `CRON_SECRET` (accepted); Supabase CLI local stack in CI with the integration project (accepted; if it exceeds the 20-minute budget, split into its own job). Haider will supply, by name: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `CRON_SECRET` is generated by Dev. The REQ-003 build does not depend on these; REQ-004 Session A may start as soon as `.env.local` has them. Status: `in progress` once the build starts.

**11 Oct 2026, Session A review (branch `req-004-accounts`, b9f6ee1, PR #4): APPROVED to continue; two hardening items for Session B.** Read the migration: hashed emails, `is_member`/`is_owner` as `security definer` with `search_path` pinned, `platform_admin` change blocked when a JWT is present, `auth_rate_limits` revoked from client roles, `create_account` as the only client-callable function. Good. Items: (1) add database constraints mirroring the zod schema (`trading_name` length 1–120, `business_structure` in the allowed set, `states` elements in the eight codes, `abn` 11 digits or null) so the database never trusts the app; (2) cap accounts per user (one owner account per user for now; raise an error on the second) to stop account spam through `create_account`; (3) the RLS suite's first real run is PR #4's CI job; attach its link in Delivery evidence. The hosted migration apply is a deployment concern: see the migration-deploy item in `product/NEXT.md` batch 4 rather than a manual `db push`.

**11 Oct 2026, Session B review (9452905, PR #4): APPROVED to continue to Session C.** PR #4's `supabase-integration` job ran the migrations and the RLS suite on the local stack: 12 passed, 2 skipped (hosted-only). The hardening items are in with tests. The app job on PR #4 failed only on Prettier for `DECISIONS.md` (prose edited by the PO; fixed in batch 5 by ignoring the file), and the gitleaks job fails on the inherited REQ-002 fixture commit. Session C (export, deletion and purge route, admin role with MFA, `audit_log` on admin actions) may proceed on the rebased branch. Hosted migrations will be applied by `migrate.yml` once Haider adds the two secrets.

**11 Oct 2026, Session C review on PR #7 (`req-004-accounts-rebuilt`, 1afa395): ACCEPTED subject to green CI.** Read `api/jobs/purge` (404 unless a constant-time match on `CRON_SECRET`, unset secret means inert, dry-run mode), `admin/*` (404 for non-admins, TOTP enrol and verify flows, aal2 required), the export route and the Session C migration. Merge after #6 when CI, including the Supabase integration job, is green. Then three operator steps remain before the hosted project is usable, tracked in the queue: migrations applied by `migrate.yml` (D-036), TOTP enabled in the hosted Auth settings, and `platform_admin` granted to Haider's user by SQL once he has signed in. `CRON_SECRET` is set when the Vercel project is created (REQ-010). Status: accepted.


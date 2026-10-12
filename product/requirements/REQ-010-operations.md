# REQ-010: Operations: first deploy, backups, monitoring, runbook, export and deletion
Status: part 1 ready (written 13 Oct 2026)   Priority: must   Owner: Dev
Phase: 5   Depends on: REQ-004, REQ-005, REQ-007, REQ-008

## Why
Nothing can be trialled with a real provider until the app runs on a public address with the hosted Supabase project, Stripe test mode and the model key behind it. Part 1 is the smallest deploy that lets two or three providers try the full path (sign in, questionnaire, pay in test mode, download). Part 2 (backups, monitoring, incident runbook, export and deletion) follows before launch.

## Rules that apply
- Haider does every account, secret and billing step himself on his personal accounts (CLAUDE.md section 4; never company resources). Dev and PO prepare exact instructions; they never hold a secret value.
- Vercel Hobby for the trial (D-053). Sydney region (`syd1`) for functions.
- No new external origin reaches the browser without a CSP change in the same PR.

## Part 1: first deploy (this batch)

### Functional requirements
- FR-1 **Deploy runbook** `supabase/ops/DEPLOY.md` (plain language, numbered, for a non-infra reader): create the Vercel project from the GitHub repo on a personal account; region; the full list of environment variable names with one line each on where the value comes from (Supabase dashboard, Stripe dashboard, Anthropic console, Resend, a generated `CRON_SECRET`), which are server-only, and which are safe as `NEXT_PUBLIC_`; the Supabase redirect URLs to add (`https://<domain>/auth/callback` and the Vercel preview pattern) and the Site URL; the Stripe webhook endpoint to create (`https://<domain>/api/stripe/webhook`, the events it needs) and where to paste the signing secret; how to confirm the cron fired. Values never appear in the file.
- FR-2 **Environment check at boot**: a server-side check that every required variable is present (names only in the log) and the app refuses to start in production with one missing; `GENERATION_ENABLED` documented as the switch to turn the model on for the trial.
- FR-3 **`.env.example` is the single source of names**: reconcile it with what the code actually reads (the payments branch introduced `STRIPE_PRICE_PACK`, `PACK_PRICE_AUD_CENTS`, `GST_LINE`, `SUBSCRIPTION_PRICE_AUD_CENTS`; the example still lists `STRIPE_PRICE_DOCUMENT_SET` and `STRIPE_PRICE_SUBSCRIPTION_MONTHLY`). One name per setting; a unit test that every variable read through the env module appears in `.env.example`.
- FR-4 **Health route** `/api/health` returning `{ ok, version, region }` with the git SHA, no secrets, no database call, rate-limited like the others; used by the smoke test.
- FR-5 **Production smoke test** `npm run smoke -- --base https://<domain>`: health, home, pricing, legal pages (200 and the footer links), sign-in page, and the CSP header present. Read-only; no sign-in.
- FR-6 **Preview deployments**: PR previews must not run the daily purge against production data; the cron route checks it is on the production deployment (`VERCEL_ENV === "production"`) before doing anything.

### Security requirements
- SR-1 Secrets live only in Vercel project settings (server-only, not exposed to the browser) and GitHub secrets; the runbook says which go where.
- SR-2 Supabase Site URL and redirect list contain only the production domain and the Vercel preview pattern; `localhost` is removed from the hosted project after the first successful hosted sign-in (PO does this).
- SR-3 The Stripe webhook route verifies the signature before anything else and returns 400 on failure; already in REQ-007, re-tested against the real endpoint at the first deploy.

### Acceptance criteria
- AC-1 Runbook complete enough that Haider can finish the deploy with no questions; the PO reads it first.
- AC-2 `next build` with the production env check passes; a build with one required variable missing fails with the variable named.
- AC-3 Smoke test green against the deployed site (PO runs it after Haider deploys).
- AC-4 Hosted sign-in, questionnaire, test-mode payment with Stripe's test card, download: the PO walks it once on the deployed site and records the result in the PO review.

### Questions for Dev to answer before building
1. Does `next build` on Vercel need `GENERATION_ENABLED` at build time, or only at request time?
2. Any env variable read in a client component that is not `NEXT_PUBLIC_`? (Should be none; confirm.)

## Part 2 (later): backups (Supabase daily plus a weekly export to Haider's own storage), uptime check, error reporting (Sentry DSN already in the example), the incident runbook, account export and deletion jobs (REQ-004 FR-6 and the privacy policy promise of 30 days).

## Dev response

**2026-10-13 (batch 21, item 1; branch `req-010-deploy` from `main` 2b26e77).**

1. **`GENERATION_ENABLED` is read at request time only.** `isGenerationEnabled()` reads `process.env` when `/documents` renders or the generate action runs; nothing bakes it into the build. The same holds for every other server-only variable: `next build` needs none of them to compile (the prebuild check is the only thing that looks at them, and only on the production deployment). Two switches exist and the runbook names both: `GENERATION_ENABLED` shows the free "Generate my documents" button (REQ-005 FR-9) and is `false` for the trial; `GENERATION_LIVE=1` (D-708) makes the paid job call the model for real and is required for the trial's paid path. The REQ's "documented as the switch to turn the model on for the trial" therefore points at `GENERATION_LIVE`; recorded in D-1002 so the naming is not a surprise.
2. **No client component reads a non-`NEXT_PUBLIC_` variable.** A sweep of every `"use client"` file finds no `process.env` read at all; the only `NEXT_PUBLIC_` reads anywhere are `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_BRAND_NAME` (the brand constant is inlined into both bundles by design). The existing CI step `check-client-bundle.mjs` keeps the Supabase secret out of the client bundle (REQ-004 AC-8).

Shape of the work: the boot check gains a production list; a `prebuild` script runs the same check before `next build` so AC-2 is a build failure, not only a start failure; `.env.example` is reconciled and a unit test keeps it the single source of names; `/api/health`; `npm run smoke`; a preview guard on the two scheduled routes and the webhook's post-response run; the runbook.

## Delivery evidence

### Part 1 (2026-10-13, batch 21 items 1 to 3), branch `req-010-deploy` (D-1001 to D-1004)

- **FR-1 Runbook** `supabase/ops/DEPLOY.md`: what Haider already has in `.env.local` by name and what is still to create (item 2); the versions the deploy expects (Node 22, Next 16.4.0, Supabase CLI 2.120.0, `syd1`); ten numbered sections: create the project, project settings (Node 22, Sydney functions, previews), the variable table with where each value comes from and its exposure, first deploy and how to read the `check-env` line, Supabase Site URL and the two redirect URLs with the preview pattern, migrations, the Stripe webhook endpoint with its three events and where the signing secret goes (plus the dashboard test that proves the signature check), cron and how to confirm a run, the smoke test, the PO's first walk-through, and a failure table. No value appears anywhere.
- **FR-2 Boot check.** `PRODUCTION_REQUIRED` in `src/lib/env.ts` (the basic list plus the Supabase, cron, Anthropic, contact, Stripe and display-price names); `validateEnv(source, { production })`; `isProductionDeployment()` is true only when `VERCEL_ENV === "production"`, so previews, CI's `next start` and local runs keep the short list. `exitIfEnvInvalid()` uses it at boot; `scripts/ops/check-env.ts` runs it as `prebuild` (Node's `--experimental-strip-types`, `.env*` loaded the way Next loads them, values never printed). Unit tests: every production name is reported when missing and the full set passes; the deployment test; `.env.example` lists every production name.
- **FR-3 `.env.example`.** Rewritten as the single list with the production-required names at the top, exposure stated per section, the two generation switches explained, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` removed (never read). `src/lib/env-names.test.ts` scans `src/` and `scripts/` for every environment read (plus the name tables) and fails on any name absent from the example, excluding platform variables; it also rejects the three retired names. It caught one stray name (`SMOKE_BASE_URL`) on the first run, which was then removed from the smoke script.
- **FR-4 Health** `/api/health`: `{ ok, version, sha, region, deployment }` with the package version plus the short `VERCEL_GIT_COMMIT_SHA`, `VERCEL_REGION`, no database call, no query parameters (400), `Cache-Control: no-store`, and an in-memory per-address limiter (60 a minute) because the route must not touch the database; `health.test.ts` (3) and `e2e/health.spec.ts` (both projects: shape, no secret-shaped string, 400 on a query).
- **FR-5 Smoke** `npm run smoke -- --base https://<domain>` (`scripts/ops/smoke.mjs`): health 200 with `ok` and `version`, home, pricing and sign-in 200 with a CSP header, the five legal pages 200 each linking to all five, the general-information statement on home and no "is being built". Read-only; exits 1 on the first failure naming it.
- **FR-6 Previews.** `mayRunScheduledJobs()` (`cron-auth.ts`, unit-tested): on Vercel only the production deployment runs; the purge route, the generate route and the webhook's post-response run all return or log "skipped" otherwise; local and CI runs are unaffected.
- **SR-1 to SR-3** are runbook content (exposure column, Site URL and redirect list with the localhost removal left to the PO, the webhook's dashboard test).
- **AC-2 proven locally.** `VERCEL_ENV=production npm run build` with the dev machine's `.env.local` stopped in `prebuild` with exit 1 and printed exactly the three names that machine lacks: `CRON_SECRET`, `CONTACT_EMAIL`, `STRIPE_WEBHOOK_SECRET` (and, with no `.env.local` loaded, all eleven production names). A normal `npm run build` passes with `check-env ok (basic list; values not shown)` and lists `/api/health`.
- **Pre-deploy sweep (item 3).** `npm run check` green; `npm run build` green; `npm audit --omit=dev --audit-level=high` clean; both Playwright projects in CI mode: see the status for the counts. gitleaks could not run on the tree here (not installed on the dev machine; CI's secret-scan job covers every push). Versions recorded in `DEPLOY.md`.
- **Not done (AC-1, AC-3, AC-4).** The PO reads the runbook; the smoke test and the walk-through run against the deployed site after Haider deploys.

## PO review
**13 Oct 2026, part 1 (branch `req-010-deploy` 5ae48cc; PR #20): ACCEPTED on content.** D-1001 to D-1004 accepted. Runbook read in full (AC-1): a non-infra reader can follow it; every value has a source and none appears in the file. The `GENERATION_LIVE` vs `GENERATION_ENABLED` distinction is the right call and is named in the runbook. AC-2 proven on the dev machine. AC-3 (smoke) and AC-4 (walk-through with Stripe's test card and a refund) are the PO's, after Haider deploys; results will be appended here. One note for Haider's run, not a change request: the `STRIPE_SECRET_KEY` the runbook asks for is a *restricted* key; `.env.local` holds the standard test secret key, which also works for the trial, so he may copy that and tighten later. Part 2 stays draft until the site is up.

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
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)

# Deploy runbook: first deploy to Vercel (REQ-010 part 1)

For Haider, on personal accounts only (CLAUDE.md section 4; D-053: Vercel
Hobby for the private trial). Every step says where a value comes from.
**No value is written in this file, ever.** The PO reads this first; the
smoke test at the end tells you the deploy worked.

**You already have these in `.env.local` (copy them across by name, same
values):** `NEXT_PUBLIC_SITE_URL` (change to the production domain),
`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `STRIPE_SECRET_KEY`,
`STRIPE_PRICE_PACK`, `PACK_PRICE_AUD_CENTS`, `GST_LINE`,
`SUBSCRIPTION_PRICE_AUD_CENTS`. **Still to create:** `CRON_SECRET`,
`CONTACT_EMAIL`, `STRIPE_WEBHOOK_SECRET` (step 7), `GENERATION_LIVE=1`.
Your `.env.local` also holds four names the code no longer reads
(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_DOCUMENT_SET`,
`STRIPE_PRICE_SUBSCRIPTION_MONTHLY`, and the empty `EMAIL_*`/`SENTRY_*`
pairs are for later); leave them out of Vercel.

## What the deploy expects

| Thing        | Version                                 | Where it is pinned                                                     |
| ------------ | --------------------------------------- | ---------------------------------------------------------------------- |
| Node         | 22 (LTS)                                | `.nvmrc`, `package.json` `engines.node` `22.x`; set the same in Vercel |
| Next.js      | 16.4.0                                  | `package.json` (exact)                                                 |
| Supabase CLI | 2.120.0                                 | CI (`supabase/setup-cli`); migrations                                  |
| Region       | Sydney, `syd1`                          | Vercel project settings (step 2)                                       |
| Build        | `npm run build` (runs `prebuild` first) | `package.json`                                                         |

The `prebuild` step runs `scripts/ops/check-env.ts` with Node's
`--experimental-strip-types` flag (Node 22.6 or later). On the production
deployment it refuses to build when a required variable is missing and
prints the names; previews and local builds only need
`NEXT_PUBLIC_SITE_URL`. The same check runs again when the server starts.

## 1. Create the Vercel project

1. Sign in to Vercel with your personal GitHub account and choose **Add
   New → Project**.
2. Import `haideralii/readyline`. Framework preset: Next.js (detected).
   Root directory: the repository root. Leave the build command as
   `npm run build` and the output as detected.
3. Do **not** deploy yet: open **Environment Variables** on the same screen
   (or the project's Settings → Environment Variables after creation) and
   add the variables in step 3 first. If Vercel deploys before they exist,
   the production build fails on purpose with the missing names; that is
   the check working, not a broken repo.

## 2. Project settings

1. Settings → General → **Node.js Version**: 22.x.
2. Settings → Functions → **Function Region**: Sydney (`syd1`).
3. Settings → Git: production branch `main`. Previews are off in
   `vercel.json` (`git.deploymentEnabled`: every branch `false`, `main`
   `true`; D-2239): a push to a pull-request branch creates no deployment
   at all. That is the only setting that saves the Hobby cap, because a
   build the Ignored Build Step cancels still counts as a created
   deployment (Vercel, project settings, "Ignored Build Step", read 16 Oct
   2026). Nothing to paste for it; it ships with the code. **Ignored Build
   Step** (batch 46, D-2206) is the second layer, for `main` itself: paste
   `bash scripts/ops/vercel-ignore-build.sh`; with it a commit on `main`
   that changes only `product/` and markdown builds nothing (tests in
   `scripts/ops/vercel-ignore-build.test.ts`). CI's Playwright run against
   a production build covers what previews did. If a preview of `next` is
   ever wanted, set `"next": true` beside `main` in `vercel.json`, and
   first tick two variables for the Preview environment,
   `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_BRAND_NAME` (see section 3);
   without them every preview fails at `check-env`, and each merge to
   `next` then spends one of the day's deployments.
4. Settings → Domains: add your domain when you have it; until then the
   `*.vercel.app` address is the production domain. Whatever it is, that
   is `<domain>` below.

## 3. Environment variables

Add each one under Settings → Environment Variables. **Environment:
Production only** for everything marked server-only; tick **both
"Production" and "Preview"** for `NEXT_PUBLIC_SITE_URL` and
`NEXT_PUBLIC_BRAND_NAME`, and nothing else for Preview. A variable added as
Production-only (the default when you re-add one) is invisible to preview
builds, which then fail at `check-env`; a preview with the two public
variables builds and serves the public pages, while sign-in and payments
stay unavailable there by design.
Leave **"Expose to the browser" / "Sensitive"** as Vercel suggests: every
name without the `NEXT_PUBLIC_` prefix is server-only and must stay
unexposed.

**Three traps found at the first deploy (batch 23):**

- Vercel refuses to save a `NEXT_PUBLIC_*` variable whose type is
  **Secret** (the edit silently never saves), and the "paste a whole .env
  file" flow marks every row Secret. Add the public names
  (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BRAND_NAME`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) one
  at a time with type **Config**, or change the type per row before saving.
- Stripe **sandboxes are separate accounts** with their own keys, Prices and
  webhooks. `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PACK` and the webhook
  endpoint must all come from the same account in the same mode. The check:
  in the Stripe dashboard the account name in the top-left is "Readyline"
  and the page title carries "[Test]" on every page you copy from.
- The Supabase redirect allow-list matches the **full** redirect URL
  including the query string, so an exact `/auth/callback` entry does not
  match `/auth/callback?next=…`. Step 5 below uses the trailing `*`.

| Name                                   | Where the value comes from                                                                                                                                              | Exposure    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `NEXT_PUBLIC_SITE_URL`                 | `https://<domain>` with no trailing slash                                                                                                                               | public      |
| `NEXT_PUBLIC_BRAND_NAME`               | `Readyline` (optional; the code defaults to it)                                                                                                                         | public      |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase dashboard → Project Settings → API → Project URL                                                                                                               | public      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Project Settings → API Keys → publishable key                                                                                                      | public      |
| `SUPABASE_SECRET_KEY`                  | Supabase dashboard → Project Settings → API Keys → secret key                                                                                                           | server-only |
| `CRON_SECRET`                          | Generate one: `openssl rand -hex 32` (or any 64 random hex characters). Vercel Cron sends it; the routes check it.                                                      | server-only |
| `HASH_PEPPER`                          | Generate one: `openssl rand -hex 32`. The HMAC key behind hashed viewer addresses and invitation emails; set once, never rotate (open invitations would stop matching). | server-only |
| `ANTHROPIC_API_KEY`                    | Anthropic console → API keys (set a monthly spend cap on the key)                                                                                                       | server-only |
| `ANTHROPIC_MODEL`                      | `claude-sonnet-5-5` (D-048); optional, the code defaults to it                                                                                                          | server-only |
| `GENERATION_LIVE`                      | `1` for the trial: real model calls for paid packs (D-708). Without it a purchase cannot be fulfilled.                                                                  | server-only |
| `GENERATION_ENABLED`                   | `false` (keeps the free "Generate" button hidden; the paid path does not need it)                                                                                       | server-only |
| `CONTACT_EMAIL`                        | The address you answer from; shown in the footer and used for refund requests                                                                                           | server-only |
| `BUSINESS_ABN`                         | Optional, 11 digits; shown in the footer once set                                                                                                                       | server-only |
| `STRIPE_SECRET_KEY`                    | Stripe dashboard (test mode for the trial) → Developers → API keys → a restricted key with Checkout Sessions write, PaymentIntents read, Prices read                    | server-only |
| `STRIPE_PRICE_PACK`                    | Stripe dashboard → Product catalogue → "Readyline document pack" → the AUD 399 Price id (`price_…`)                                                                     | server-only |
| `PACK_PRICE_AUD_CENTS`                 | `39900` (must equal the Price's amount; a live key refuses to start on a mismatch)                                                                                      | server-only |
| `GST_LINE`                             | The sentence beside the price, for example `No GST while Readyline is not registered for GST.`                                                                          | server-only |
| `SUBSCRIPTION_PRICE_AUD_CENTS`         | `3900` (display only, "coming soon")                                                                                                                                    | server-only |
| `STRIPE_WEBHOOK_SECRET`                | Step 7 below (needs the domain first). Add a placeholder now so the first build passes, then replace it.                                                                | server-only |

Never set `STRIPE_FAKE`, `GENERATION_RECORD` or `EMAIL_*`/`SENTRY_*` in
Vercel for this deploy.

## 4. First deploy

1. Deploy (or push to `main`). Watch the build log for `check-env ok
(production list; values not shown)` near the start; a failure here
   lists the missing names.
2. When the deployment is live, open `https://<domain>/api/health`. You
   should see `{"ok":true,"version":"0.1.0+<sha>","region":"syd1",...}`.
3. Open the home page and the pricing page.

## 5. Supabase: Site URL and redirect URLs

Supabase dashboard → Authentication → URL Configuration.

1. **Site URL**: `https://<domain>`.
2. **Redirect URLs**, add both, each with the trailing `*` (the list is
   matched against the whole URL including `?next=…`):
   - `https://<domain>/auth/callback*`
   - `https://*-haideralii.vercel.app/auth/callback*` (the Vercel preview
     pattern; use the pattern Vercel shows for your account if different).
3. Keep `http://localhost:3000/auth/callback*` for now; the PO removes it
   after the first successful hosted sign-in (REQ-010 SR-2).
4. The magic-link email template is already the any-device one
   (`supabase/ops/magic-link-template.html`); nothing to change.

## 6. Database migrations

`migrate.yml` applies `supabase/migrations/**` to the hosted project on
every merge to `main`, so by the time the deploy is live the tables and
grants exist. If a merge happened while the workflow was broken, run it by
hand from GitHub → Actions → "migrate" → Run workflow, then check
`https://<domain>/api/health` still answers.

## 7. Stripe webhook

Stripe dashboard (test mode) → Developers → Webhooks → **Add endpoint**.

1. Endpoint URL: `https://<domain>/api/stripe/webhook`.
2. Events: `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `charge.refunded`.
3. After creating it, reveal the **Signing secret** (`whsec_…`) and paste it
   into Vercel as `STRIPE_WEBHOOK_SECRET` (Production), replacing the
   placeholder. **Redeploy** (Deployments → the latest → Redeploy) so the
   running app picks it up.
4. Test it: in the endpoint page use **Send test event** →
   `checkout.session.completed`. The app answers 200 with
   `{"ok":true,"outcome":"invalid"}` (a test event carries no account),
   which proves the signature check passed. A wrong secret answers 400.

### 7a. Registers subscription (REQ-009 Session C)

1. Products → **Add product**: "Readyline registers", recurring, monthly,
   AUD, the price in `SUBSCRIPTION_PRICE_AUD_CENTS` (test mode for the
   trial). No trial, no setup fee. Copy the Price id (`price_…`) into
   Vercel as `STRIPE_PRICE_REGISTERS` (Production); until it is set the
   Subscribe button is hidden and the pricing page says "coming".
2. Webhook endpoint (section 7): add the events
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` and `invoice.payment_failed`.
3. Settings → Billing → **Subscriptions and emails** → retry schedule:
   retry failed payments for **7 days**, then mark the subscription
   **unpaid** (D-056: the app revokes only on `canceled` or `unpaid`,
   never on `past_due`, so Stripe's retries are the grace period). No
   late fees anywhere.
4. Settings → Billing → **Customer portal**: enable cancelling (immediately
   or at period end, your choice) and updating the payment method; the
   return URL is `https://<domain>/account`. The app opens the portal
   from the account page's "Manage billing" button.

## 8. Cron

Vercel reads `vercel.json` and creates three cron jobs (`/api/jobs/purge`
daily at 16:00 UTC, `/api/jobs/generate` daily at 16:30 UTC,
`/api/jobs/reminders` daily at 20:00 UTC, which is 06:00 or 07:00 in
Sydney so the register reminders arrive in the morning). It sends
`Authorization: Bearer <CRON_SECRET>` itself. To confirm a run: Vercel
project → **Cron Jobs** tab shows the schedule and the last run; the
function log for `/api/jobs/generate` shows `jobs.generate.ran`. To run one
by hand from your machine:

    curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/jobs/generate

(Hobby runs cron at most daily, D-053; the paid job is carried by the
webhook's own run and the route's self-kick, the cron is the backstop.)

### 8a. The GitHub Actions kicker (batch 32, D-1006; schedule and dispatch per D-059)

The chain only progressed while a browser was open (D-057), so
`.github/workflows/generate-kick.yml` calls `/api/jobs/generate` with the
bearer until the route answers `"more": false` or twenty minutes have
passed. It starts two ways: the app dispatches it the moment a pack is
paid for or the documents page nudges a stalled job (needs the token in
step 3), and a schedule every thirty minutes is the safety net. It needs
two values in the GitHub repository (Settings → Secrets and variables →
Actions) and one in Vercel:

1. **Variable** `PROD_URL`: `https://<domain>` with no trailing slash
   (the same value as `NEXT_PUBLIC_SITE_URL`).
2. **Secret** `CRON_SECRET`: the same value as the Vercel variable. Copy it
   from Vercel (Settings → Environment Variables → reveal) and paste it as
   the secret; nobody else sees it.
3. **Vercel variable** `GITHUB_DISPATCH_TOKEN` (server only, optional): a
   fine-grained personal access token. GitHub → your profile → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token. Resource owner: you. Repository access: **Only
   select repositories**, this one alone. Repository permissions:
   **Contents: Read and write**, nothing else (the `repository_dispatch`
   endpoint is listed under Contents, write, in GitHub's "Permissions
   required for fine-grained personal access tokens"; Actions: write does
   not cover it). Set an expiry (a year) and note the date in the
   calendar. Paste it into Vercel as `GITHUB_DISPATCH_TOKEN`, server only,
   and redeploy. Without it the app logs
   `payments.generation.dispatch-skipped` once per kick and the schedule
   picks the job up within thirty minutes, which the documents page copy
   already allows for.

Until the first two exist the workflow skips with a notice. To confirm it
works: Actions → "Kick paid generation" → run it by hand
(`workflow_dispatch`) while a pack is generating; the log shows one line
per call (`kick 1: runs=1 more=true`) and the Vercel function log shows
`payments.generation.tick` with `kicked_by: "kicker"`. To confirm the
dispatch: buy a pack in test mode and look for a run whose trigger reads
`repository_dispatch` and a Vercel log line `payments.generation.dispatched`
with `kicked_by: "webhook"`. Scheduled workflows pause after 60 days
without a push to the repository; a push resumes them.

**Minutes.** A scheduled run with nothing to do makes one call and ends,
about one runner minute, so `*/30` is about 1,440 minutes a month against
GitHub's 2,000 free for a private repository; a dispatched run costs only
while a pack is generating. If the trial shows more than about 60 packs a
month, Vercel Pro and its one-minute cron replace all of this (D-053).

**Function duration.** The generate route declares `maxDuration = 300`,
Hobby's maximum with Fluid compute (Vercel docs, "Configuring Maximum
Duration", duration limits table, updated 24 Aug 2026). Check Settings →
Functions → **Fluid compute** is on; without it Hobby stops at 60 seconds
and the deploy refuses the value.

## 9. Smoke test (PO runs it; you can too)

    npm run smoke -- --base https://<domain>

It checks health, home, pricing, sign-in, every legal page with its footer
links, and the CSP header. It signs nothing in and changes nothing.

## 10. The first real walk-through (PO, AC-4)

Sign in on the deployed site with a magic link, finish the questionnaire,
buy the pack with Stripe's test card `4242 4242 4242 4242` (any future
date, any CVC), watch `/documents` move from "Preparing" to ready, download
the zip. Then refund that payment in the Stripe dashboard and confirm the
downloads close (`supabase/ops/refund.md`).

## Limits (the free tiers; batch 46, D-2207)

Every service here is on a free tier, and the limits shape how work ships.
Anything that would push against one of them is said in `product/CHAT.md`
before it is done, by the PO or by Dev.

| Service           | Limit                                                                                                                                                                                                           | What we do about it                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel Hobby      | 100 deployments created a day, 100 an hour, 60 in five minutes; 100 GB bandwidth a month (vercel.com/docs/limits, page dated 16 Sep 2026, read 16 Oct 2026)                                                     | Work merges to `next`; the PO merges `next` into `main` once a day, twice at most (D-2205). Previews are off at the Git integration, so a branch push creates no deployment (D-2239); the Ignored Build Step (section 2) skips docs-only commits on `main` (D-2206). A cancelled build still counts, so the script alone never saved the cap. Forward-merge a chain once, after the last fix, not after every fix; PRs to `next` one or two at a time (the `free-tier` skill). |
| GitHub Actions    | 2,000 minutes a month while the repository is private                                                                                                                                                           | A full CI run is about 45 job minutes. No re-run of a red job without reading its trace or annotations first; `cancel-in-progress` stays on; docs-only pushes to `main` run nothing (`paths-ignore`).                                                                                                                                                                                                                                                                          |
| Supabase Free     | Two projects; a project pauses after 7 idle days                                                                                                                                                                | The daily crons (section 8) keep the project warm. Migrations reach it once a day with the `next` merge, through `migrate.yml`.                                                                                                                                                                                                                                                                                                                                                |
| Amazon ECR Public | Unauthenticated pulls: 500 GB a month and 1 pull a second (AWS docs, read 16 Oct 2026); CI's `supabase start` pulls the local stack's images this way, sharing the allowance with every anonymous GitHub runner | A "toomanyrequests: Data limit exceeded" line in the Supabase job means the stack is incomplete; read that job's failures against the log, no re-run until the pull succeeds (the `free-tier` skill, rule 7). Credentials or an image cache would remove the dependency; not done.                                                                                                                                                                                             |
| Stripe            | Test mode only until launch                                                                                                                                                                                     | Live keys arrive with REQ-022's launch pass, never before every row on `/admin/launch` is green (D-2202).                                                                                                                                                                                                                                                                                                                                                                      |

## If something fails

- Build fails with "check-env": add the named variables (Production
  environment) and redeploy.
- `/api/health` is 404: the deployment did not finish; check the build log.
- Sign-in link lands on "That link did not work": the redirect URL in
  step 5 is missing or the Site URL is wrong.
- Buy button says "Buying is not available": one of the three Stripe
  variables is missing in Production.
- Webhook answers 400 in the Stripe dashboard: the signing secret in Vercel
  does not match the endpoint; paste it again and redeploy.
- Documents stay "Preparing" for more than 15 minutes: see "The paid
  generation job did not finish" in `supabase/ops/refund.md`.

# REQ-022 Session C evidence, the code half (Dev-2, 18 Oct 2026)

Branch `req-022-session-c`, cut on batch C (`qa-live-20261018-c`, PR #108) and flattened onto `next` when #108 merged (D-2827); commits a996d88 FR-8, 5532448 FR-9, fc923df FR-10, cb21928 FR-1, 3ab97f8 the health spec's siteUrl key, and the evidence commit (the head) with D-2343 and the ASVS rows. No migration. The runbook pass on the real domain is Haider's and stays in `product/ops/LAUNCH.md` section 5; the fixture domain in every test is `readyline.example`. Dev-1 has Session D (the legal bundle script, the About page, the footer); none of those files is touched.

## FR mapping

- FR-8, the redirect → `src/lib/ops/alias-redirect.ts`, pure and run first in `src/proxy.ts`: on the production deployment a request whose host is a vercel.app name and differs from NEXT_PUBLIC_SITE_URL's host is answered 301 to the same path and query on the site; `/api` and `/api/*` keep answering on the alias (the FR-8 exclusion, until the crons and the webhook endpoint move); nothing when the two hosts match, when the site URL is unset or itself a vercel.app name, on a preview (VERCEL_ENV guards it), or off a vercel.app host. `alias-redirect.test.ts` holds the host and path cases (AC-5's three pages and `/api/health`). CI's server sees `localhost` and every existing spec is unchanged.
- FR-9, `siteUrl` in the health route → `healthBody` carries `siteUrl` (NEXT_PUBLIC_SITE_URL without its trailing slash); `health.test.ts` holds both bodies and that no secret reaches the answer; `scripts/ops/launch-check.mjs` fails its health line when `siteUrl` is not `--base`, so the committed record names the host it ran against (AC-5).
- FR-10, HSTS → `src/lib/ops/hsts.ts`, imported by `next.config.ts` at build: HSTS_MAX_AGE as a positive whole number, else the one-week default; `includeSubDomains` always; `preload` only from one year. `hsts.test.ts` holds AC-8's two values (604800 without preload, 31536000 with it) and the fallbacks; `e2e/security-headers.spec.ts` asserts the production build's header for the configured value through the same helper, on every project in CI (one week there, no preload). `.env.example` and `env.ts`'s OPTIONAL list name the variable; LAUNCH.md section 5 step 16 carries the two-step (604800 one deploy after the redirect is proven, 31536000 a week later). The default moves from two years with preload to one week without, as the Dev response set out.
- FR-1, the domain rows → the site-url row compared hosts already; the Stripe webhook row now matches an endpoint whose host is the request host and whose path is `/api/stripe/webhook` (`webhookEndpointState`, `launch-facts.test.ts`), "unverified" with no request host; the Supabase URLs row stays "unverified" by design (not readable with the project's keys; launch-check proves the sign-in path from outside).

## Counts

- `npm run check`: green, 180 files (1 skipped), 1,309 tests, 6 skipped.
- The once-a-session public run (D-2319), every public spec in CI mode on the three projects from a production build of cb21928 on port 3100: 309 passed, 35 skipped, 2 failed: e2e/health.spec.ts pinned the body's keys and did not yet name siteUrl (both projects); fixed in 3ab97f8, and the spec passes on both projects locally.

## Said, not built

- The real domain pass (registrar, Vercel domain, the variable changes, the smoke run against the domain, the committed `launch-check` output) is Haider's, LAUNCH.md section 5 and section 9; nothing here can be proven against the real name until then.
- The `/api/*` exclusion is removed by a one-line change to `aliasKeepsPath` once the crons and the webhook endpoint call the domain (FR-8's "then the exclusion goes").
- The Supabase Site URL and redirect list are not readable with the project's keys (Dev response, assumption (b)); the row stays "unverified".

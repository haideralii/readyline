# REQ-022 Session C, the code half: the alias redirect, `siteUrl` in health, `HSTS_MAX_AGE`, the domain rows

Branch `req-022-session-c`, PR to `next`; cut on batch C (`qa-live-20261018-c`, #108) and flattened onto `next` when it merged (D-2827). Dev-2, 18 Oct 2026. Four code commits, one per FR, each with its unit test, then the evidence. No migration; no shared or Dev-1 file (Session D's bundle script, About page and footer are untouched). The runbook pass on the real domain is Haider's (`product/ops/LAUNCH.md` section 5).

## What this PR does

- **FR-8, the redirect (D-2203).** `src/lib/ops/alias-redirect.ts`, pure, runs first in the proxy: on the production deployment a vercel.app host that differs from NEXT_PUBLIC_SITE_URL's host is answered 301 to the same path and query on the site; `/api` and `/api/*` stay on the alias until the crons and the webhook endpoint move; nothing when the hosts match, when the site is still the alias, on a preview, or off a vercel.app host. Unit-tested over the host and path cases; CI's server is `localhost`, so no existing spec moves.
- **FR-9, `siteUrl` in `/api/health`.** The body carries the canonical origin; `launch-check.mjs` fails its health line when it is not `--base`.
- **FR-10, `HSTS_MAX_AGE` (AC-8).** `src/lib/ops/hsts.ts` is read by `next.config.ts` at build: one week by default without `preload`, `preload` only from one year. Unit test for both values; `security-headers.spec.ts` asserts the production build's header for the configured value. The default drops from two years with preload to one week without (Dev response 3): no browser has the domain pinned yet, and Vercel preloads its own name.
- **FR-1, the domain rows.** The Stripe webhook endpoint is judged against the request host (`webhookEndpointState`), not NEXT_PUBLIC_SITE_URL; "unverified" with no request host; the sentences name the host.

## Checks

- `npm run check`: green, 180 files (1 skipped), 1,309 tests, 6 skipped.
- Every public spec in CI mode on the three projects from a production build: 309 passed, 35 skipped, 2 failed: e2e/health.spec.ts pinned the body's keys and did not yet name siteUrl (both projects); fixed in 3ab97f8, and the spec passes on both projects locally.
- Evidence: `product/evidence/req-022/c-evidence.md`; D-2343 and the ASVS rows in `DECISIONS.md` and `product/security/asvs-l1-check-2026-10-14.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

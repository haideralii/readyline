# Pull request: REQ-022 Session A, the launch switchboard

Base: `next`. Head: `req-022-launch-readiness`. Compare link: https://github.com/haideralii/readyline/compare/next...req-022-launch-readiness?expand=1

Title: `REQ-022 Session A: the launch switchboard, launch-check.mjs, the live-mode guards, LAUNCH.md`

---

## REQ

REQ-022: Launch readiness, Session A (`product/requirements/REQ-022-launch-readiness.md`, FR-1 to FR-4, SR-1, SR-2, AC-1, AC-2). Decisions D-2208, D-2209, D-2210 (Dev) in `DECISIONS.md`.

Base branch: `next` (D-2205).

## What changed

1. FR-1 `/admin/launch` behind `requireAdmin()` and the authenticator step: every launch condition as a row with a name, one of four states (set, unset, mismatched, unverified) and one sentence, in eight groups (identity, payments, generation, email, domain, jobs, admin, legal). The rows are built by the pure `src/lib/ops/launch.ts` over facts `src/server/ops/launch-facts.ts` gathers: variable presence; the two Prices (`livemode`, `unit_amount`, currency) and the webhook endpoint as Stripe reports them with the existing restricted key (a permission error reads "not verified here" with the permission to add); each job's last `audit_log` row; the platform admin's verified authenticator through the admin API; the legal pages' `updated` dates. Every view is audited (`admin.launch.viewed`).
2. SR-1: no value reaches the page. The names, states and sentences are fixed strings; `launch.test.ts` renders the rows over an environment of marker values and asserts none appears, and the e2e compares the page's HTML against the process's own secrets (never printed).
3. FR-2 `scripts/ops/launch-check.mjs --base https://<domain> [--alias https://<name>.vercel.app]`: health, CSP, every legal page's "Last updated" within 90 days, the sign-in form, the pack price on `/pricing`, that price against Stripe's `unit_amount` when `STRIPE_SECRET_KEY` and `STRIPE_PRICE_PACK` are in the shell environment (skipped otherwise, said so), and the alias's 301 when `--alias` is given. One line per check, exit 1 on the first failure. Pure helpers in `launch-check-lib.mjs` with tests.
4. FR-3 live-mode guards (`src/lib/payments/live-guards.ts`, every combination unit tested): with a live key, `STRIPE_FAKE` set, a missing webhook secret, a missing, test-mode or non-AUD Price, or a display price unset or differing (pack, and registers when configured) are conditions. The boot check (`price-startup.ts`, now pure over a Price reader) stores them (`refusal.ts`); the checkout, subscription and billing-portal actions answer their "not available" message and the webhook route 404s while any stands, with one log line naming the conditions at boot; the rest of the site serves (D-2209; REQ-007 AC-6's exit is replaced). `GENERATION_LIVE=1` without `ANTHROPIC_API_KEY` refuses the generate job (404, one log line).
5. D-2208: the purge, generate and reminders routes write one `audit_log` row per run (`jobs.<name>.ran`, counts only), which the jobs rows read.
6. FR-4 `product/ops/LAUNCH.md`: 24 numbered steps for Haider, each naming the dashboard, the variable and the row that goes green; `launch.test.ts` asserts every row name appears in it.
7. E2E (three projects, `e2e/signed-in/admin-launch.spec.ts`): a throwaway platform admin enrols its own TOTP factor (D-2210, code computed in the test), opens the page, every row has a valid state, the CI stack's expected states hold, no secret or the admin's address is in the HTML, the visit is audited; a signed-in customer gets 404; the anonymous 404 list in `e2e/admin.spec.ts` gains `/admin/launch`.

Not in this session: the "Send me a test email" button and the email rows' real states (FR-6, Session B); `HSTS_MAX_AGE` and the alias redirect (Session C); the green-everywhere screenshots (need a preview with every variable set; AC-1's manual half).

## Security checklist (REQ-002 FR-7; tick or explain)

- [x] No new route handler takes input; the page reads no query. The payment actions and the webhook gained a guard, no new input. The generate job gained a guard before its existing query parse.
- [x] No secrets, tokens or `.env` files in the diff; no new environment variable. The script reads `STRIPE_SECRET_KEY` and `STRIPE_PRICE_PACK` from the shell only to call Stripe and prints neither.
- [x] Logs: `payments.live-guard.refused`, `stripe.webhook.refused`, `jobs.generate.refused` carry condition names only; `jobs.<name>.ran` audit rows carry counts only.
- [x] Security headers and CSP unchanged.
- [x] No new external origin (Stripe was already called from the server); no new dependency.
- [x] No customer or participant data: the page reads environment presence, Stripe metadata, audit timestamps and front matter.
- [x] Tenant data: none read. `/admin/launch` is behind `requireAdmin()` with the aal2 step; the e2e proves 404 for a non-admin session and for anonymous visitors.

## Tests and evidence

- `npm run check`: green on the branch head (119 files, 854 tests, 6 skipped; 34 new tests across five files).
- The CI run on the pull request: public job (the anonymous 404), Supabase job (the admin e2e on three projects, the integration suites).
- Not run locally: the signed-in e2e (needs a Supabase stack).
- Screenshots: the red state at 360 px and desktop will come from the Supabase job's evidence upload once the spec saves them (next push); the green state needs the preview pass in LAUNCH.md step 24.
- Delivery evidence: `product/requirements/REQ-022-launch-readiness.md`, "Delivery evidence".

## Claims, brand, privacy

- [x] Admin-only copy; the copy lint passes over the new page.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
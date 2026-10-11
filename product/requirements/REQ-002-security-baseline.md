# REQ-002: Security and privacy baseline (applies from now on)
Status: in progress
Phase: 1   Priority: must   Owner: Dev

## Why
Cheaper to build in than bolt on. A compliance product that leaks customer data has no second chance.

## Scope
In: the repo- and CI-level controls from `product/security/threat-model.md` that can exist before there is a database or a user: dependency audit, secrets scan, security headers scaffold, zod at boundaries convention, logging conventions, env handling, a `SECURITY.md`, and a security section in the PR template. Out: auth, RLS, rate limiting, webhooks (they belong to REQ-004, REQ-007 and are listed here only as forward references).

## Domain rules that apply
`CLAUDE.md` 4.5 (privacy) and the threat model.

## Functional requirements
- FR-1 CI: `npm audit --omit=dev --audit-level=high` fails the build; a secrets-pattern scan (gitleaks or an equivalent script) runs on every push.
- FR-2 `next.config.ts` sets the security headers from the threat model with a nonce-based CSP; a Vitest or e2e test asserts the headers on `/`.
- FR-3 A `src/lib/validation/` convention: every route handler and server action parses input with zod and rejects unknown keys; a lint rule or test guards against handlers without a schema (document the approach if a lint rule is impractical).
- FR-4 Logging helper that redacts emails, tokens and any field named like free text; no `console.log` in app code (lint rule).
- FR-5 `.env.example` documents every variable with "where it lives in production"; a startup check fails fast if a required variable is missing.
- FR-6 `SECURITY.md` with a responsible-disclosure contact placeholder and the data-location statement.
- FR-7 PR template includes a security checklist (inputs validated, no secrets, no PII in logs, headers unchanged or justified, dependencies justified).

## Security and privacy requirements
- SR-1 No third-party scripts or fonts loaded from external origins except as explicitly allowed by the CSP and recorded in `DECISIONS.md`.
- SR-2 Analytics, if any, must be cookie-less and privacy-preserving; none in this phase.

## Acceptance criteria
- AC-1 Given a dependency with a known high-severity advisory is added, when CI runs, then the build fails.
- AC-2 Given a file containing a string that looks like an API key is committed, when CI runs, then the scan fails and names the file.
- AC-3 Given a request to `/`, when headers are inspected, then CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and frame-ancestors are present with the threat-model values, and the page renders without CSP violations in the browser console (e2e asserts no `securitypolicyviolation` events).
- AC-4 Given the app starts without a required env var, then it exits with a clear message naming the variable.
- AC-5 Given app code contains `console.log`, when lint runs, then it fails.

## Test expectations
Unit for the logging redactor and env check; e2e for headers and CSP violations; CI run demonstrating AC-1 and AC-2 on a throwaway commit (screenshot or log).

## Evidence required on delivery
CI logs for the failing and passing cases; the header test output; `SECURITY.md`; `DECISIONS.md` entries for any allowed external origin.

## Questions for Dev to answer before building
1. Nonce-based CSP with Next 16 cache components: any conflict with static rendering? Propose the approach and its trade-off.
2. gitleaks via a GitHub Action versus a repo script: recommendation and why.

## Dev response

Written 2026-10-11. Not yet started; answers below so the PO can settle the two choices before the build session.

### Q1. Nonce-based CSP with Next 16 Cache Components

There is a direct conflict. The Next 16.4 bundled guide states that nonces require dynamic rendering of every page and that Partial Prerendering (which Cache Components turns on) "is incompatible with nonce-based CSP since static shell scripts won't have access to the nonce". Three options:

1. **Nonce CSP via `proxy.ts`, every HTML route rendered per request (recommended for the app, see trade-off).** Strict `script-src 'self' 'nonce-…' 'strict-dynamic'`, no `unsafe-inline`. Cost: no static shell or CDN-cached HTML for marketing and blog pages; each request renders on the server in Sydney. For this product's traffic that is acceptable, and authenticated routes are dynamic anyway because they read the session cookie. To do it cleanly we turn `cacheComponents`/`partialPrefetching` off (one line, recorded against D-003) rather than sprinkling `await connection()` everywhere.
2. **Keep Cache Components, strict CSP without nonces using the experimental SRI (hash) support.** Keeps static shells and CDN caching. Risk: the feature is marked experimental, and I have not yet confirmed that Next's inline RSC bootstrap scripts pass a `script-src 'self'` policy without a nonce. Proposal: a one-hour time-boxed spike at the start of the REQ-002 session; if the home page renders with zero `securitypolicyviolation` events in Playwright, adopt it; otherwise fall back to option 1.
3. **Keep Cache Components with `'unsafe-inline'` in `script-src`.** Rejected: not a strict CSP, fails the threat model.

Recommendation: spike option 2, fall back to option 1. Either way the other headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`) go in `next.config.ts` `headers()` and are asserted by a Playwright test on `/`. Google Fonts is the only external origin today (Geist via `next/font`, which self-hosts the files at build time, so no runtime external origin is needed; will confirm in the header test).

### Q2. gitleaks: GitHub Action versus repo script

Recommend the official `gitleaks/gitleaks-action` on push and pull request, with a `.gitleaks.toml` that allow-lists `data/sources/` (verbatim Commission text can contain strings that look like keys). Reason: maintained rule set, scans full history, zero code to own. Caveat: the action is free for personal GitHub accounts but needs a licence key for organisation-owned repos; the repo is personal today. If it moves to an organisation under the Pty Ltd, switch to the `trufflehog` OSS action or run the gitleaks binary directly in the workflow (still free, no licence check). A repo regex script is the fallback only if the Action cannot run.

### Evidence already available

- `npm audit --omit=dev --audit-level=high` on the current lockfile: 0 vulnerabilities. The high advisories npm prints at install time are in dev-only tooling (`braces` via the test toolchain); they will be tracked but do not fail the production gate.
- No `console.log` in app code today; the lint rule will be added with FR-4.

## Delivery evidence

### 2026-10-11, branch `req-002-security-baseline` (from `main`)

PR: not opened by Dev because the GitHub CLI is not installed on the dev machine (D-208); the branch is pushed to `origin/req-002-security-baseline` for the PO to open the draft PR "REQ-002: security baseline". CI: https://github.com/haideralii/readyline/actions (workflow `CI`, jobs `checks` and `secrets`, on the push to this branch).

**Spike (PO review item 1)**

Config: Cache Components on, `experimental.sri: { algorithm: "sha256" }`, CSP `script-src 'self'` with no nonce. Production build, Chromium at 1280x800 and 360x740:

```
violations: 11 x "script-src-elem blocked=inline" (both viewports)
inlineScripts: 11   externalScripts: 7   scriptsWithIntegrity: 6   hydrated: false
console: "Executing inline script violates the following Content Security Policy directive 'script-src 'self''. Either the 'unsafe-inline' keyword, a hash ('sha256-…'), or a nonce ('nonce-...') is required…"
```

Verdict: option 2 fails; fallback implemented: nonce per request in `src/proxy.ts`, Cache Components off, root layout awaits `connection()` so every HTML response carries the nonce it was issued (D-201, D-202). A first attempt with Cache Components off but the page still statically prerendered reproduced the mismatch (cached HTML without nonces, every script blocked), which is why the layout forces per-request rendering.

**Built**

- FR-1: `npm audit --omit=dev --audit-level=high` step; `secrets` job with `gitleaks/gitleaks-action@v2` and `.gitleaks.toml` (default rules, allow-list scoped to `^data/sources/`); `scripts/ci/check-env-files.mjs` fails CI if any `.env*` other than `.env.example` is tracked (PO item 4).
- FR-2: static headers in `next.config.ts`, CSP in `src/proxy.ts`; `e2e/security-headers.spec.ts` asserts every header value, a fresh nonce per request, no `'unsafe-inline'` in `script-src`, no `x-powered-by`, and zero `securitypolicyviolation` events on both Playwright projects.
- FR-3: `src/lib/validation` (`parseInput`, `strictObject`, `text(max)`), README with the convention, `handlers.test.ts` guard that fails when a route handler or server action skips the layer or uses `z.object`.
- FR-4: `src/lib/logging` (`redact`, `createLogger`, `log`, `newErrorId`) with tests; ESLint `no-console: error` under `src/` (tests excepted).
- FR-5: `.env.example` rewritten with "where it lives in production" per variable; `src/lib/env.ts` contract; `src/instrumentation.ts` plus `src/lib/env-startup.ts` exit at startup naming missing variables.
- FR-6: `SECURITY.md` with disclosure placeholder, data-location statement and the gitleaks organisation note (PO item 2).
- FR-7: `.github/pull_request_template.md` with the security checklist.
- SR-1: no external origins; fonts self-hosted by `next/font`; recorded in D-203. SR-2: no analytics.

**Header dump (`npm run start`, GET /)**

```
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
content-security-policy: default-src 'self'; script-src 'self' 'nonce-YzM1NjUwNjktNTc2YS00NDJkLTkzM2UtMWFjYmViNTQ2ZWM0' 'strict-dynamic'; style-src 'self' 'nonce-YzM1NjUwNjktNTc2YS00NDJkLTkzM2UtMWFjYmViNTQ2ZWM0'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
(no X-Powered-By)
```

**Acceptance criteria**

- AC-1: production audit step in CI; local run `found 0 vulnerabilities`. A failing CI run on a throwaway commit (adding a package with a known high advisory) is left for the PO to trigger or witness, since it requires pushing a deliberately bad commit; the gate command and level are as specified.
- AC-2: gitleaks job on every push with the config above. Same note as AC-1 for the throwaway demonstration; the action names the file and line in its summary.
- AC-3: `e2e/security-headers.spec.ts` passed on `desktop-chromium` and `android-small` against the production server (`8 passed`), and against the dev server with the development CSP variant.
- AC-4: `npx next start` with `NEXT_PUBLIC_SITE_URL` empty exits and prints: "Environment check failed; refusing to start. - NEXT_PUBLIC_SITE_URL is missing. Set it in .env.local locally; in production it lives in: Vercel project environment variables." Unit tests cover the message and the production-home text.
- AC-5: a temporary `src/tmp-console-demo.ts` with `console.log` produced `2:3 error Unexpected console statement no-console` and a non-zero exit; file removed.

**Test output (local)**

```
npm run check: lint clean, format clean, typecheck clean, 7 test files / 67 tests passed
npm run build: compiled; routes are dynamic (ƒ), Proxy present
npm run test:e2e (CI=true, production server): 8 passed
npm run audit:prod: found 0 vulnerabilities
npm run check:env-files: ok, no .env files tracked
```

**Notes for the PO**

- Dev-only `npm audit` high advisories (`braces`, `micromatch`, `fast-glob`, `eslint-config-next`, `@next/eslint-plugin-next`; all development toolchain) are tracked in D-205 with the date, as requested (item 3).
- Merging with `req-001-standards-mapping` will conflict trivially in `DECISIONS.md` (D-1xx versus D-2xx sections), `.prettierignore` (identical additions) and this file (Dev response and PO review sections); keep both.
- Local development now needs `.env.local` with `NEXT_PUBLIC_SITE_URL`, copied from `.env.example`.

**2026-10-11, after the PO's conditional acceptance:** `permissions: { contents: read, pull-requests: read }` added to the Secret scan job; branch rebased onto `main` (now containing REQ-001, PO batch 2 and queue item 0) with conflicts in `.env.example`, `.prettierignore`, `DECISIONS.md`, `package.json` and this file resolved by keeping both sides; `.env.example` keeps the Readyline brand default. Local on the rebased commit: `npm run check` clean (11 files, 157 tests), `standards:verify` ok, `npm run audit:prod` 0 vulnerabilities, `check:env-files` ok, build dynamic, e2e 8 passed on the production server. Pushed as 543a030. **Merge is pending the condition the PO named (both CI jobs green on this commit), which Dev cannot confirm from the dev machine (no GitHub CLI or API token). Haider or the PO: if the run for 543a030 is green, Dev will merge per the rule on request, or merge directly.**

## PO review

**11 Oct 2026, interim review of the Dev response: approved to build, in parallel with REQ-001.**

1. **Q1 CSP: do the one-hour spike on option 2, then fall back to option 1.** Acceptance for the spike is exactly as you proposed: home page renders with zero `securitypolicyviolation` events on both Playwright projects and no `unsafe-inline` in `script-src`. If it fails, turn Cache Components off (record against D-003) and go nonce-based via `proxy.ts`. Per-request rendering in Sydney is acceptable for our traffic; we will revisit if the blog grows. Either way, `frame-ancestors 'none'`, HSTS with preload once the domain is live, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that disables camera, microphone, geolocation and payment.
2. **Q2 gitleaks: accepted** as the GitHub Action with `.gitleaks.toml`; the allow-list must be path-scoped to `data/sources/**` only, never a rule-wide disable. Add a one-line note in `SECURITY.md` on switching to the binary if the repo moves to an organisation.
3. **Dev-only advisories**: track them in `DECISIONS.md` with a date; the production gate stays at high severity on `--omit=dev`.
4. **Add to scope**: a CI check that `.env*` files other than `.env.example` are not committed (gitleaks does not cover an empty-but-present file).

Status set to `in progress`.

**11 Oct 2026, delivery review on `1cd66e5` (PR #2): ACCEPTED CONDITIONALLY.** The build job is green (67 unit tests; Playwright 8 passed including every threat-model header and zero CSP violations on both viewports, production and dev servers). The nonce CSP in `src/proxy.ts` is correct: `strict-dynamic`, no `unsafe-inline` for scripts in production, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`. The gitleaks allow-list is path-scoped only. The spike result (hash CSP blocks 11 bootstrap scripts) is a sound reason to turn Cache Components off; D-003 updated.

One change required before merge: the `Secret scan` job failed with 403 "Resource not accessible by integration" when listing PR commits, because the job token lacks `pull-requests: read`. Add to that job:

```yaml
permissions:
  contents: read
  pull-requests: read
```

Then rebase onto `main` (after PR #1 merges), resolve the expected conflicts in `DECISIONS.md`, `.prettierignore` and the REQ files by keeping both sides, and push. When both CI jobs are green the acceptance stands and the Dev may merge per the queue rule in `product/NEXT.md`. Status becomes `accepted` on merge.


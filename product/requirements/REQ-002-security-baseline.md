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
(Dev fills in.)

## PO review

**11 Oct 2026, interim review of the Dev response: approved to build, in parallel with REQ-001.**

1. **Q1 CSP: do the one-hour spike on option 2, then fall back to option 1.** Acceptance for the spike is exactly as you proposed: home page renders with zero `securitypolicyviolation` events on both Playwright projects and no `unsafe-inline` in `script-src`. If it fails, turn Cache Components off (record against D-003) and go nonce-based via `proxy.ts`. Per-request rendering in Sydney is acceptable for our traffic; we will revisit if the blog grows. Either way, `frame-ancestors 'none'`, HSTS with preload once the domain is live, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that disables camera, microphone, geolocation and payment.
2. **Q2 gitleaks: accepted** as the GitHub Action with `.gitleaks.toml`; the allow-list must be path-scoped to `data/sources/**` only, never a rule-wide disable. Add a one-line note in `SECURITY.md` on switching to the binary if the repo moves to an organisation.
3. **Dev-only advisories**: track them in `DECISIONS.md` with a date; the production gate stays at high severity on `--omit=dev`.
4. **Add to scope**: a CI check that `.env*` files other than `.env.example` are not committed (gitleaks does not cover an empty-but-present file).

Status set to `in progress`.

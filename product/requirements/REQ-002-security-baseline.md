# REQ-002: Security and privacy baseline (applies from now on)
Status: ready
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
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)

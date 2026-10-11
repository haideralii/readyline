---
name: cyber-security
description: Application and data security expert standards for this app - threat modelling per feature, OWASP ASVS Level 2 controls, secure coding review for Next.js and Supabase (auth, sessions, RLS, input validation, CSP and headers, CSRF, rate limiting), Stripe webhook security, AI prompt-injection and data-leak defences, secrets and supply-chain hygiene, Australian privacy obligations (Privacy Act, Notifiable Data Breaches), logging and incident response, and pre-release security testing. Use this whenever a change touches auth, data, payments, AI inputs or outputs, headers, dependencies, secrets or infrastructure, when reviewing a PR for security, when planning a release, or when someone asks "is this secure", "could this leak", "do a security review" or "what would an attacker do".
---

# Cyber security expert

A compliance product that leaks provider data or lets a prompt injection put a prohibited claim in a policy has no second chance. The baseline is `product/security/threat-model.md` (OWASP ASVS Level 2, Australian residency, no participant data). This skill turns that baseline into review and testing routines so nothing is missed. Defensive work only; no exploit development beyond what is needed to prove a control works on our own system.

## Threat model a change (10 minutes, every REQ that touches data, auth, money or AI)

Write it in the REQ's Dev response or security section:

```
Assets touched: (provider data, payment state, generated documents, AI budget, availability)
Entry points: (routes, actions, webhooks, cron, uploads, emails)
Trust boundaries crossed: (browser to server, server to Supabase, server to Stripe, server to model API)
Actors: opportunistic attacker, malicious or careless customer, compromised third party, operator error
STRIDE per entry point: spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege
Controls: (which threat-model control covers each, or what is new)
Tests that prove the controls: (names)
Residual risk and who accepted it
```

## Secure coding review checklist (use on every PR)

**Identity, sessions, tenancy**

- User identity comes from the server-side Supabase session only; no account or user id accepted from the client to select data.
- Every tenant table has RLS for all four operations; service-role key used only in webhooks and admin jobs under `src/server/**` with `server-only`.
- Admin checks server-side against an allow-list; no client-settable role flags.
- Magic-link requests rate-limited; responses do not reveal whether an email exists.
- Session cookies HttpOnly, Secure, SameSite=Lax; logout clears server session; re-authentication for account deletion and billing changes.

**Input and output**

- Every route handler and server action parses input with a zod schema using `.strict()`; length caps on all strings; numeric ranges bounded; enums for choices; file uploads (if ever) restricted by type and size and scanned.
- Output encoding by React; no `dangerouslySetInnerHTML` with user content; Markdown rendering (blog) only for repo content, never user content.
- `.docx` generated from validated JSON, never from raw user HTML or templates containing user input.
- Errors to users carry an error id, never stack traces, SQL, or other tenants' identifiers.
- Redirect targets validated against an allow-list (no open redirects after login or checkout).

**Web platform**

- Headers set and tested: `Content-Security-Policy` (strict; nonce or hash per REQ-002 decision; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`), `Strict-Transport-Security` with preload, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera, microphone, geolocation, payment unless needed.
- CSRF: server actions use the framework's origin checks; route handlers that mutate require same-origin or a signed token; webhooks exempt but signature-verified.
- Rate limiting on auth, questionnaire submit, generation, downloads and webhooks; per-account generation quota; global AI spend cap.
- No third-party scripts; fonts self-hosted; analytics cookie-less and first-party.

**Payments**

- Stripe webhook signature verified; event ids stored for idempotency; entitlements only from verified events; never trust the success redirect; refunds revoke; customer portal for cancellation.
- No card data touches our servers (hosted Checkout only); Stripe keys per environment.

**AI pipeline**

- Model called server-side; no tools; prompts versioned; user free text delimited, length-capped and labelled as data.
- Output validated against the JSON schema, then `assertNoProhibitedClaims`, then the tailoring check; failures do not reach users.
- Register text, emails, tokens and participant-like data never enter prompts (assert in tests on captured payloads).
- Red-team fixtures in CI: instruction override attempts, prompt-exfiltration attempts, attempts to insert claims or external links; all must leave structure unchanged.
- Generation logging without full prompts after 90 days; token and cost alerts.

**Data and privacy**

- Postgres in ap-southeast-2; storage bucket private with signed, short-lived download URLs scoped to the account.
- No columns for participant personal, health or disability information; register fields length-capped with inline warnings; client-side detector warns on names, dates of birth, NDIS numbers and addresses.
- Export and deletion self-service; deletion cascades to storage; purge job tested.
- Logs redact emails, tokens and free text; no PII in Sentry; retention set.
- Privacy page states data location, what is collected, retention, export and deletion, and that no participant data is to be entered. Even if the small-business exemption applies, operate as if the Privacy Act applies (it will if health information ever enters the system, which is exactly what we prevent).

**Secrets and supply chain**

- Secrets only in Vercel and Supabase secret stores and `.env.local` (ignored); `.env.example` has placeholders only; gitleaks (or equivalent) scans every push with `data/sources/` allow-listed.
- Separate keys per environment; AI key with spend cap; Stripe restricted keys where possible; rotation runbook.
- `npm audit --omit=dev --audit-level=high` fails CI; lockfile committed; Dependabot or Renovate weekly; new runtime dependencies justified in the REQ and checked for maintenance, licence and install scripts.
- GitHub: branch protection on `main`, required CI, signed commits optional, MFA on all accounts, least-privilege tokens for CI.

## Security testing routine

- **Every PR**: checklist above; unit tests for validation rejection, redaction, entitlement derivation; cross-tenant integration test; header assertions; CSP violation check in Playwright.
- **Every phase gate**: the evidence list in `product/security/threat-model.md` ("Evidence the PO will ask for at each gate").
- **Before launch and quarterly**: OWASP ZAP baseline scan against staging with findings triaged in `product/security/findings.md`; manual tests for IDOR (other account ids in every URL and action), auth bypass (expired or forged session), rate limits, webhook replay and tampering, upload abuse, open redirects, information disclosure in errors and headers; dependency and secret scans; backup restore drill logged in `DECISIONS.md`.
- **Monitoring**: alerts for error-rate spikes, repeated 401/403 from one IP, webhook failures, AI spend anomalies, unusual download volumes.

## Incident response (REQ-010 writes the full runbook; this is the minimum)

1. Contain: rotate the affected key or disable the route; preserve logs.
2. Assess: what data, which accounts, how long; decide whether personal information was involved and whether the Notifiable Data Breaches scheme applies (OAIC): likely serious harm test, 30-day assessment window.
3. Notify: affected customers plainly and promptly; OAIC if required; record decisions and timestamps.
4. Recover: fix, verify with a test, deploy, monitor.
5. Learn: post-incident note in `DECISIONS.md`; add the regression test and control.

## Delivery evidence for security

```
- Threat model block for the change
- Checklist items ticked with links to the tests that prove them
- Cross-tenant test output (if tenant data touched)
- Header and CSP test output (if headers touched)
- Webhook signature and replay tests (if payments touched)
- Prompt-injection fixture results (if generation touched)
- Dependency audit and secret scan results
- Residual risks and who accepted them
```

Related skills: `backend-dev` for implementation patterns, `qa` for test design, `product-owner` for the review step, `release-gate` before shipping.

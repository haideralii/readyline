# OWASP ASVS level 1 re-check of REQ-002 and REQ-004 (Dev, standing backlog 5, 14 Oct 2026)

Scope: the controls in `threat-model.md` that ASVS 4.0 level 1 asks of every web application, checked against the code on branch `req-004-admin-hardening` (which carries every open branch's work through `req-018-register-tests`). Each row names the evidence that proves it and the test that keeps it true. "Gap" rows are honest: what is not there, and whether this batch closed it.

| ASVS area | Control | State | Evidence (file, test) |
| --- | --- | --- | --- |
| V2 Authentication | Passwordless magic link only; same reply whether the address exists; per-email and per-IP limits (5/h, 20/h) | Met | `src/server/auth/actions.ts`; `tests/integration/session-b.test.ts` (limiter allows five then refuses; unreachable with the publishable key) |
| V2 | Single-use token that works on any device | Met | `src/server/auth/callback.ts`; `tests/integration/magic-link-token-hash.test.ts`; `e2e/magic-link-any-device.spec.ts` |
| V2 | Admin behind a second factor (TOTP, aal2) | Met | `src/server/admin/access.ts`; `e2e/admin.spec.ts` (404 for anyone else) |
| V3 Session | Cookies HttpOnly, Secure in production, SameSite=Lax; sign out here and everywhere | Met | `src/server/supabase/server.ts`; account page actions |
| V4 Access control | Row-level security on every table; a tenant cannot read, update or delete another's rows by id; append-only tables refuse updates with 42501 | Met | `tests/integration/rls.test.ts`, `registers-rls.test.ts`, `checklist-rls.test.ts`, `payments-rls.test.ts`, `audit-day-rls.test.ts` (backlog 4 added the owner-versus-other-tenant update case on every editable register) |
| V4 | Server-only data access; the secret key never reaches the client bundle | Met | `scripts/ci/check-client-bundle.mjs` in CI; `server-only` on every admin module |
| V4 | Entitlements come only from verified webhook events | Met | `src/app/api/stripe/webhook/route.ts`; `tests/integration/stripe-apply-event.test.ts`; `e2e/csrf-and-abuse.spec.ts` (unsigned and badly signed bodies refused) |
| V5 Validation | zod at every boundary, unknown keys rejected; a test walks the tree for files that skip it | Met | `src/lib/validation`; `src/lib/validation/handlers.test.ts` |
| V5 | Free text treated as untrusted in prompts; length caps; output validated against the schema; claims checker on every output | Met | `src/lib/generator/*`, injection fixtures in the generator tests |
| V5 | Participant-data detector on register fields (warn, never block); register text never reaches the model | Met | `src/lib/registers/participant-data.ts` and tests; register actions never import the model client |
| V7 Logging | No emails or free text in logs; hashes and codes only; `no-console` lint | Met | `src/lib/logging`; ESLint rule; `redact.test.ts` |
| V8 Data protection | Australian region; export and deletion self-service; purge after 30 days | Met | REQ-004 Session C evidence; `tests/integration/session-c.test.ts` |
| V13 API and web services | Every route handler and server action is gated: a session, a shared secret or signature, or a rate limiter | **Closed this batch** | `handlers.test.ts` "boundaries are gated" walks every boundary file; the public questionnaire action gained a per-address limiter (`src/app/start/actions.ts`) |
| V13 | Cross-site request forgery: framework origin check on server actions; mutating routes are the signed webhook and the secret-gated job routes; no cookie-authenticated mutating GET | **Verified this batch** | `e2e/csrf-and-abuse.spec.ts` (an action posted from another origin is refused; job routes 404 without the secret) |
| V13 | Rate limits: sign-in, export, register export and writes, checkout, generation quota, health, sample document, questionnaire derivation | Met (derivation added this batch) | `src/server/auth/rate-limit.ts`; `src/lib/ops/health.ts`; `generation_quota_hit`; `e2e/csrf-and-abuse.spec.ts` (health answers a loop with 429) |
| V14 Configuration | Security headers on every route; nonce CSP, no `unsafe-inline` for scripts, `frame-ancestors 'none'` | Met (test widened this batch) | `next.config.ts`, `src/proxy.ts`; `e2e/security-headers.spec.ts` now checks a content page, the questionnaire, sign-in, a guide, a 404 and an API route |
| V14 | Dependency audit at high severity on production dependencies, clean today; weekly update pull requests | Met (Dependabot added this batch) | CI step `npm audit --omit=dev --audit-level=high` (0 vulnerabilities on 14 Oct 2026); `.github/dependabot.yml` |
| V14 | Secret scan on every branch; no `.env` file committed | **Closed this batch** | `.github/workflows/secrets.yml` runs gitleaks on every push to every branch and on pull requests (it ran on `main` and pull requests before); `scripts/ci/check-env-files.mjs` |
| V14 | No `X-Powered-By`; no third-party scripts; fonts self-hosted | Met | `next.config.ts`; `e2e/security-headers.spec.ts` |

## Gaps that remain (not level 1 blockers, listed so nobody assumes them)

- The per-address limiters on the health route, the sample document and the questionnaire action are per instance (a fixed window in memory). On a serverless host each instance counts separately, so the effective limit is higher than the number says. The database limiter is the right tool where there is a database; the public action must work without one. Recorded in D-424.
- No external automated scan (OWASP ZAP baseline) has run yet; the threat model schedules it for phase 6 with the restore drill and the runbook walkthrough.
- Dependabot pull requests will not run CI while Actions is paused; they queue until the PO re-enables it.
- The CSRF test proves the framework refuses a cross-origin action; it does not try every action, because the origin check sits in front of all of them. The boundary guard test is the per-file proof.

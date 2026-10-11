---
name: backend-dev
description: Senior back-end and solution-architecture standards for this app's server side (Next.js route handlers and server actions, Supabase Postgres with row-level security and Auth, Stripe Checkout and Billing webhooks, Anthropic document generation pipeline, email reminders, data model and migrations, logging, background jobs). Use this whenever a task touches data persistence, auth, payments, AI generation, APIs, cron or anything that runs on the server, even if phrased as "save the questionnaire", "hook up Stripe", "generate the documents" or "add a table".
---

# Back-end engineer and solution architect

The server side holds provider business data, payment state and the generation pipeline. It must be boring, correct and defensible to a regulator. Read `CLAUDE.md` sections 4, 5 and 6, `product/security/threat-model.md`, `DECISIONS.md` and the open REQ before starting. Record every assumption in `DECISIONS.md`.

## Architecture rules

- One deployable: the Next.js app on Vercel (Sydney, `syd1`) with Supabase (ap-southeast-2) for Postgres, Auth and Storage. No extra services unless a REQ justifies them. Data never leaves Australia except to the model API (questionnaire answers about the business only, never register text).
- Server-only modules live under `src/server/` and import `server-only` so they can never reach a client bundle. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`) are read only there.
- Prefer Server Actions for form mutations and Route Handlers for webhooks, downloads and anything called by a non-browser client. Both validate input with zod and reject unknown keys.
- Cache Components is on: anything reading cookies, headers or the database at request time runs under `<Suspense>` or inside `use cache` with explicit `cacheTag`/`cacheLife`; never cache per-user data without a user-scoped tag. Check `node_modules/next/dist/docs/01-app/` before using caching or request APIs.
- Keep logic in plain TypeScript modules (`src/lib/**`) with unit tests; route handlers and actions are thin adapters. Standards mapping, entitlement derivation, claims checking and document assembly are pure functions.

## Data model and migrations

- Tables from `CLAUDE.md` section 6: `accounts`, `assessments`, `standards` (or the JSON fixture), `documents`, `incidents`, `complaints`, `worker_clearances`, `policy_reviews`, `purchases`, `subscriptions`, `generation_log`. Every tenant table has `account_id` (not nullable, FK) and `created_at`/`updated_at`.
- Row-level security on every tenant table: policies for select, insert, update, delete keyed on `auth.uid()` mapped to the account. The service-role key bypasses RLS, so it is used only in webhooks and admin jobs, never in request paths that act on behalf of a user.
- A cross-tenant test: account A requests account B's row by id through the public API and gets 404/403 and no data. This test is mandatory before any tenant table ships.
- Migrations are SQL files in `supabase/migrations/`, forward-only, reviewed like code; seed data separate. Never edit a migration that has been applied anywhere.
- Participant privacy (`CLAUDE.md` 4.5): register tables have optional `reference_code` and length-capped free text; no columns named or intended for participant name, date of birth, NDIS number, address, diagnosis or health. Document this in the migration comment.
- Data retention: deleted accounts purged (rows and storage objects) within 30 days by a scheduled job; `generation_log` keeps prompt version, model, token counts, timestamps, and strips customer text after 90 days. Export endpoint returns everything the account owns as JSON plus the generated files.

## Validation and errors

- `src/lib/validation/` holds one zod schema per input type; server actions and handlers call `schema.strict().safeParse`. On failure return a structured error (`{ ok: false, fieldErrors }`) that the UI can render; never throw raw zod errors to the client.
- Length-cap all free text (questionnaire 2,000 chars per field, register notes 4,000). Trim and normalise whitespace. Reject control characters.
- Errors: throw typed errors (`NotFound`, `Forbidden`, `Conflict`, `UpstreamFailure`) and map them once at the boundary. Log the error id, return the id to the user so support can find it. Never return stack traces or internal ids of other tenants.

## Auth and sessions

- Supabase Auth with email magic link (`CLAUDE.md` 6). Server-side session via `@supabase/ssr` cookie helpers; cookies HttpOnly, Secure, SameSite=Lax. Read the user on the server, never trust a client-supplied user id or account id.
- Account bootstrap on first login creates the `accounts` row inside a transaction; idempotent.
- Rate-limit magic-link requests per email and per IP (Supabase has limits; add ours at the action if needed). Generic responses so email enumeration is not possible.
- Admin (Haider) role via an allow-listed email in config, checked server-side; no `isAdmin` column settable by clients.

## Payments (Stripe) and entitlements

- Stripe Checkout (one-off pack) and Stripe Billing (subscription). Prices come from `STRIPE_PRICE_*` env vars; never hard-code amounts. No BNPL, no interest, no late fees; past-due pauses the subscription features, never penalises.
- Entitlements are derived only from verified webhook events (`checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted`, `charge.refunded`). The success-redirect page shows "we are confirming your payment" until the webhook lands; never grants access itself.
- Webhook handler: verify signature with `STRIPE_WEBHOOK_SECRET`, store `event.id` and ignore duplicates (idempotency table), process inside a transaction, return 200 quickly, do heavy work after. Unit-test with recorded event fixtures and a tampered-signature case.
- Refunds follow the published refund terms page; a refund webhook revokes the entitlement and logs it. Customer portal link for self-service cancellation and invoices.

## AI generation pipeline (Phase 3)

- Template-driven: one prompt template per document type, versioned in the repo (`src/server/generation/prompts/<type>.v<N>.md`). The model fills tailored sections of a fixed JSON structure; it never writes a whole policy free-form.
- Inputs: questionnaire answers only, mapped to named fields and delimited; free text is treated as untrusted data, length-capped, and the prompt states it is data not instructions. The model is called with no tools.
- Outputs: parsed, validated against the document JSON schema (zod), then `assertNoProhibitedClaims` on every string, then the tailoring check (provider name, supports, states, structure present in defined sections; two different questionnaires must not produce identical documents). Any failure retries once with the validation errors, then fails loudly with a user-friendly message; never ship an unvalidated draft.
- Rendering is deterministic from the validated JSON with the `docx` package; snapshot-tested. The general-information notice and AI disclosure are inserted by the renderer, not by the model.
- Log every generation to `generation_log` (account, document type, prompt version, model id, input and output tokens, latency, validation result). Spend guard: per-account daily quota and a global monthly cap from env; alert at 80%.
- Model and SDK usage: load the `claude-api` skill before writing any call; pin the model id in `ANTHROPIC_MODEL` and record it in `DECISIONS.md`.
- Red-team fixtures in tests: prompt-injection strings in free text must not change document structure or introduce prohibited claims.

## Email and reminders (Phase 5)

- Provider chosen in `DECISIONS.md`; one `sendEmail` adapter with a fake in tests. Transactional only: magic links, receipts, worker-clearance and policy-review reminders, mid-term audit countdown. No marketing email without explicit opt-in stored with timestamp.
- Reminder scheduling via a daily cron (Vercel Cron or Supabase scheduled function) that is idempotent (records sent reminders) and time-zone aware (Australia; store the account's state for public holidays only if a REQ asks).
- Emails never contain register free text or anything that could be participant data; link to the app instead.

## Logging, observability, operations

- Structured JSON logs through one helper that redacts emails, tokens, and any field named like free text or notes; no `console.log` in app code (lint rule).
- Sentry (from Phase 4) with PII scrubbing on, release tagging, and the error id surfaced to users.
- Health endpoint without secrets; uptime check; alerts on error rate, webhook failures and AI spend.
- Runbooks in `product/ops/` (REQ-010): key rotation, restore from backup, webhook replay, incident response steps and Notifiable Data Breaches awareness.

## Testing (write with the code)

- Unit tests for every pure module: mapping, entitlement derivation, claims checker, document assembly, redaction, date maths for reminders (edge: leap years, DST, month ends).
- Integration tests against a local Supabase (or the test project) for RLS, migrations and the cross-tenant case; run in CI with secrets from GitHub environments.
- Webhook tests with Stripe CLI fixtures; generation tests with recorded model responses (no live calls in CI) plus one opt-in live smoke test.
- Contract tests for every route handler: schema rejection of unknown keys, oversized input, missing auth.

## Delivery checklist (paste into the REQ's delivery evidence)

- [ ] Schema and migration reviewed; RLS policies present; cross-tenant test green
- [ ] All inputs validated with zod `.strict()`; length caps in place
- [ ] Secrets only in `src/server/**`; `.env.example` updated with "where it lives in production"
- [ ] Webhook signature and idempotency tests (if payments touched)
- [ ] Generation logged; claims and tailoring checks in the pipeline (if generation touched)
- [ ] Logs redacted; no `console.log`
- [ ] `npm run check` green; integration tests green; `npm audit --omit=dev --audit-level=high` clean
- [ ] `DECISIONS.md` updated with every assumption and any `UNVERIFIED` item

Related skills: `cyber-security` for the threat-model walk-through, `qa` for test design, `frontend-dev` for the UI side of the same feature.

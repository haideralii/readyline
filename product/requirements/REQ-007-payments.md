# REQ-007: Payments, entitlements and the download flow
Status: ready
Phase: 4   Priority: must   Owner: Dev   Depends on: REQ-004 (accounts), REQ-005 (generator) for the paid path; REQ-008 (legal pages) before anything is charged for real.

## Why
Nothing can be sold today. The one-off document pack is the first income and the simplest thing to charge for: one price, one Stripe Checkout, one entitlement, one download page. The subscription (registers) comes with REQ-009; this REQ builds the entitlement model so that adding it later is a second product, not a rewrite.

## Scope
In: Stripe Checkout (one-time payment) for the document pack; webhook-driven entitlement; a pricing page; the "what you get" page; the download page gated by entitlement; the generation trigger after payment; refund handling; receipts; test-mode end to end. Out: subscription billing (REQ-009), coupons, invoices for organisations, multi-currency.

## Business rules (CLAUDE.md sections 4 and 5; D-021)
- One fixed, visible price in AUD including GST status shown plainly ("AUD 399, no GST while Readyline is not registered for GST" until the ABN/GST position is settled; the string is one config value, `PACK_PRICE_AUD_CENTS` and `GST_LINE`). No hidden fees, no "from" pricing.
- No instalments, no BNPL, no interest, no late fees. Stripe Checkout with `payment_method_types: ["card"]` only; Afterpay, Klarna, Zip and any "pay later" method are explicitly disabled and a test asserts the Checkout session never lists one.
- Refund promise, shown before purchase and on the receipt: full refund within 14 days if the pack has not been downloaded; after a download, a refund is still given if the documents do not match the questionnaire answers (we decide in the customer's favour when unsure). Refunds are issued through Stripe by the operator; the product records the request and the outcome.
- Claims: the purchase page says what is in the pack and what it is not ("drafts for your review; not legal advice; does not guarantee registration"). Prohibited-claims lint applies to every string on these pages.
- The AI disclosure sits on the purchase page above the Buy button, one sentence.
- No pre-ticked anything. No "limited time", no countdown, no fake scarcity, no exit pop-ups.

## Functional requirements
- FR-1 **Pricing page** `/pricing`: the pack (price, what you get as a list of document types for the visitor's result if they have one, otherwise the core set), the subscription shown as "coming" with its price and no buy button, the refund promise, the AI disclosure, the not-legal-advice line, links to terms and privacy (REQ-008). Works signed out.
- FR-2 **Buy** from the result page and the pricing page: requires sign-in (magic link, REQ-004) first, then creates a Stripe Checkout Session in AUD for the pack with `client_reference_id` = account id and metadata `{assessment_id, pack_version}`. Success URL `/documents?purchase=success`, cancel URL back to where they came from. Stripe collects the email; we pass the account email prefilled.
- FR-3 **Webhook** `/api/stripe/webhook`: verifies the signature with the raw body; handles `checkout.session.completed` and `checkout.session.async_payment_succeeded` by inserting a `purchases` row (idempotent on `stripe_checkout_session_id`) and an `entitlements` row (`kind: "pack"`, `assessment_id`, `granted_at`); handles `charge.refunded` by marking the purchase refunded and revoking the entitlement; ignores other events. Every event id processed is stored so a replayed event is a no-op. Returns 200 only after the write commits.
- FR-4 **Entitlement model** (migration): `purchases` (id, account_id, stripe_checkout_session_id unique, stripe_payment_intent_id, amount_cents, currency, status enum paid/refunded, created_at, refunded_at), `entitlements` (id, account_id, kind enum pack/subscription, assessment_id nullable, granted_at, revoked_at nullable, source purchase_id), `stripe_events` (id = Stripe event id, type, received_at). RLS: owners read their own rows; no client writes; only the webhook (service role) writes. Cross-tenant test as in REQ-004.
- FR-5 **Generation on entitlement**: when a pack entitlement is granted, the document set for that assessment is generated (REQ-005 runner) under the account's quota, once; status visible on `/documents` as "Preparing your documents (usually under 10 minutes)"; the customer gets an email when it is ready (REQ-004 email interface, log-only in dev). If generation fails after the pipeline's retries, the operator is alerted (log line at error level with the purchase id) and the customer sees "We are preparing your documents and will email you", never an error code.
- FR-6 **Download page** `/documents`: without an entitlement, shows the result summary and the Buy button; with one, the generated set (REQ-005 UI) with zip and individual downloads, the receipt link, and the "request a refund" link (mailto with the purchase id prefilled; no in-app refund yet).
- FR-7 **Receipts**: Stripe's receipt email is on; the purchase row shows the Stripe receipt URL on `/documents` and on `/account`.
- FR-8 **Operator refund**: `supabase/ops/refund.md` describes the once-only steps (refund in Stripe dashboard; the webhook revokes). Entitlement revocation hides downloads but keeps the data for the retention window (REQ-004).
- FR-9 **Config**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PACK` (a Price id, created once in the dashboard), `PACK_PRICE_AUD_CENTS` (display only; a startup check asserts it equals the Price's amount when the key is live), `NEXT_PUBLIC_SITE_URL`. Listed by name only in `.env.example` and the REQ; Haider sets values.

## Security requirements
- SR-1 Webhook signature verification on the raw body; constant-time compare is Stripe's SDK; reject on missing header; 5-minute tolerance.
- SR-2 Idempotency on event id and session id; replayed or out-of-order events cannot grant twice or revoke a newer purchase.
- SR-3 The Checkout session is created server-side only; the client never sees the secret key or constructs amounts.
- SR-4 Rate limit the create-checkout action (5 per hour per account) like the export action.
- SR-5 No card data ever touches Readyline; a test asserts no route reads `card`, `pan` or `cvc` fields; CSP allows `js.stripe.com` and `checkout.stripe.com` only where needed (frame-src, connect-src), nowhere else.
- SR-6 Logs redact the Stripe customer email and never log the full session object.

## Acceptance criteria
- AC-1 Stripe test mode, Playwright: result page → Buy → sign-in → Checkout (test card 4242) → `/documents` shows "Preparing" → after the fake runner completes, downloads work. Desktop and android-small.
- AC-2 Webhook unit tests: valid signature grants once; replayed event is a no-op; tampered body rejected; `charge.refunded` revokes; events out of order (refund before completed) end revoked.
- AC-3 A test asserts the Checkout session's `payment_method_types` is exactly `["card"]` and no `payment_method_options` enable instalments.
- AC-4 Pricing page copy passes the prohibited-claims lint; refund promise, AI disclosure and not-legal-advice lines present; axe clean; Lighthouse accessibility 100.
- AC-5 RLS tests: account B cannot read account A's purchases or entitlements; anon cannot read either.
- AC-6 Startup check fails loudly in production if `PACK_PRICE_AUD_CENTS` differs from the Stripe Price amount.

## Evidence required on delivery
Screenshots of pricing, purchase, preparing and download states at both viewports; webhook test output; the e2e report; the Stripe test-mode event log for one purchase and one refund (ids only).

## Sessions (Dev to confirm)
A: migration, entitlement model, RLS tests. B: Checkout creation, webhook, idempotency tests. C: pricing and download pages, generation trigger, e2e in test mode.

## Dev response

**2026-10-12 (batch 18, item 1; branch `req-007-payments` from `main` c5f130f).** Answers to the design questions, then the values Haider sets, then sessions.

### Q1. Stripe SDK and the Checkout API shape

`stripe` 23.0.0 (current latest), pinned exactly in `package.json`; the client is built once per request in server code only (`src/server/payments/stripe.ts`, `server-only`), with `typescript: true`, `maxNetworkRetries: 2` and the API version the SDK's types target. One-time payment through hosted Checkout (a redirect, no embedded form, so no Stripe script on our pages):

- `mode: "payment"`, `line_items: [{ price: STRIPE_PRICE_PACK, quantity: 1 }]` (an AUD Price created once in the dashboard), `payment_method_types: ["card"]` and nothing under `payment_method_options` (no instalments; AC-3 asserts both on the params builder).
- `customer_email` prefilled from the account, `client_reference_id` = account id, `metadata` and `payment_intent_data.metadata` both `{ account_id, assessment_id, pack_version }`, so the refund path (which sees the charge and payment intent, not the session) still knows the account.
- `success_url` `/documents?purchase=success&session_id={CHECKOUT_SESSION_ID}`, `cancel_url` the page the customer came from (allow-listed to `/pricing` and `/start/result`), `allow_promotion_codes: false`, `automatic_tax` off (the GST position is our `GST_LINE` text), `locale: "en-AU"`-equivalent via `"auto"`.
- The amount shown on our pages is `PACK_PRICE_AUD_CENTS`; with a live key, `instrumentation.ts` retrieves `STRIPE_PRICE_PACK` once at start and refuses to serve if `unit_amount` or `currency` differ (AC-6). With a test key it logs the comparison instead.

### Q2. The raw body in the App Router

Route handler `src/app/api/stripe/webhook/route.ts` with `export const runtime = "nodejs"` and `dynamic = "force-dynamic"`. The handler reads `await request.text()` (never `json()`), takes the `stripe-signature` header, and calls `stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)` (SDK constant-time compare, 300-second tolerance). Missing header or a failed check returns 400 with no body detail; the App Router hands route handlers the unparsed stream, so no body-parser configuration is needed. The CSP proxy's matcher only adds headers to the response and does not touch the body. The route uses the admin client (service role) and nothing else reads the raw payload; logs carry the event id and type only (SR-6).

### Q3. Idempotency storage

One SQL function does the whole write atomically: `apply_stripe_event(p_event_id, p_type, p_session_id, p_payment_intent_id, p_account_id, p_assessment_id, p_amount_cents, p_currency, p_pack_version)` returning `granted`, `duplicate`, `revoked`, `refunded_before_completion` or `ignored`. It inserts the event id into `stripe_events` first (`on conflict do nothing`; no row inserted means `duplicate` and the function stops), then applies the event: `checkout.session.completed` / `async_payment_succeeded` upserts `purchases` on `stripe_checkout_session_id` (unique) and inserts the `pack` entitlement unless a purchase with the same payment intent is already `refunded`; `charge.refunded` marks the purchase by payment intent `refunded` (or inserts a refunded shell with a null session id when the refund arrives first) and revokes the entitlement whose `source_purchase_id` it is. The webhook returns 200 only after the function returns. The same state machine exists as a pure TypeScript reducer (`src/lib/payments/entitlement.ts`) for unit tests and the fake store, and the SQL function gets its own integration cases (CI's Supabase job) for the replayed, out-of-order and refund paths. `stripe_events` holds the id, type and time only, never the payload.

### Q4. Generation on entitlement, and surfacing failure

A webhook must answer in seconds and a sole-trader set takes about eight minutes, so `granted` enqueues a `generation_jobs` row (purchase id, account id, assessment id, status `queued`, attempts, next document index) and the job runs out of band. A cron route `/api/jobs/generate` (CRON_SECRET, like the purge job; Vercel Cron every minute) takes the oldest runnable job and generates document by document, stopping after about 45 seconds so it fits any function time limit; the REQ-005 runner already writes each `document_versions` row as it finishes, so a job resumes at its next document index. The webhook also schedules one tick straight after its response (`after()` from `next/server`), so the first documents start without waiting for the cron. `/documents` reads the job and shows "Preparing your documents (usually under 10 minutes)" with a count; when the set is `ready` the customer gets the "your documents are ready" email through the REQ-004 provider (log-only in dev). If a tick fails after the pipeline's own retry, the job's `attempts` increments with `last_error`; after three attempts the job is `failed`, `log.error("payments.generation.failed", { purchaseId, jobId })` fires (the Sentry hook when REQ-010 lands), the customer keeps seeing "We are preparing your documents and will email you", and `supabase/ops/refund.md` gains the operator steps (re-queue, or refund). A completed job never runs twice: the entitlement row carries the version set id once generated.

### Q5. How the e2e drives Stripe test mode in CI

Stripe's hosted Checkout is a cross-origin page whose markup changes, and driving it in CI would also put the secret key in CI. Proposal: a `STRIPE_FAKE=1` mode, honoured only outside production, where the Stripe client is an in-process fake whose `checkout.sessions.create` returns a page on our own origin (`/dev/stripe-checkout/<id>`, mounted only under the flag) with "Pay" and "Cancel" buttons; "Pay" posts a `checkout.session.completed` event to our real webhook route, signed with `stripe.webhooks.generateTestHeaderString` and the test webhook secret, so the signature check, the SQL function, the job and the download page all run as in production, and the generator runs with the replay client (recorded fixtures, no spend). That is AC-1 on both viewports in CI. The real Stripe hop (checkout.stripe.com with card 4242, `stripe listen` forwarding to localhost, one refund from the dashboard) stays a manual test Haider runs with the Stripe CLI once before launch and after any change to the Checkout params, recorded in the evidence as event and session ids. The `["card"]` rule is a unit test on the params builder (AC-3) and is also visible in the manual run's session.

### Values Haider must set (names only)

- `STRIPE_SECRET_KEY` (test key first; server only; Vercel project variables and `.env.local`)
- `STRIPE_WEBHOOK_SECRET` (from the dashboard endpoint for production; from `stripe listen` for local testing)
- `STRIPE_PRICE_PACK` (the AUD Price id; `.env.example` renames the earlier `STRIPE_PRICE_DOCUMENT_SET` placeholder to this)
- `PACK_PRICE_AUD_CENTS` (display amount; must equal the Price's `unit_amount`, checked at start with a live key)
- `GST_LINE` (the plain sentence shown next to the price, for example "No GST while Readyline is not registered for GST.")
- Already set: `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` (the generate job reuses it).
- Q6 for the PO: the subscription is shown "coming" with "its price". No subscription price is in config today; I propose `SUBSCRIPTION_PRICE_AUD_CENTS` as a display-only value and, until it is set, the line "Audit-ready subscription: coming" without a number rather than an invented one.

### Sessions

- **A (no Stripe account):** migration `purchases`, `entitlements`, `stripe_events`, `generation_jobs` with RLS (owners read, no client writes) and the cross-tenant integration test; the entitlement reducer with unit tests; pricing config; `/pricing` signed out with the refund promise read from `product/legal/refunds.md` (test asserts identity), the AI disclosure, the not-legal-advice line, links to terms and privacy, and the claims lint over every string; screenshots at both viewports.
- **B (offline):** the webhook route with `constructEvent` against a test secret and unit tests (valid, replayed, tampered, refund, out of order) over a fake store; the `apply_stripe_event` migration and its integration cases; the Checkout params builder with the `["card"]` test; the create-checkout server action behind a 5-per-hour rate limit with the Stripe client injected; CSP `frame-src` and `form-action` for `checkout.stripe.com` only on the redirect.
- **C (needs the test key):** the real client and the price check; the generation job, cron route and `after()` kick; `/documents` states (buy, preparing, ready, refunded) and receipts; the fake-mode e2e on both viewports; the ops refund doc; the manual Stripe CLI run recorded as evidence.

Three sessions; A and B need no Stripe account.

## Delivery evidence

### Session A (2026-10-12, batch 18 item 2), branch `req-007-payments`

- **Migration `20261012030000_payments.sql`** (D-701): `purchases` (session id and payment intent id unique and nullable, status paid/refunded, receipt URL), `entitlements` (kind pack/subscription, assessment id, source purchase, version set once generated, revoked at), `stripe_events` (id, type, received at; no payload), `generation_jobs` (queue for FR-5, with attempts, next document index, next run time). RLS: owners read purchases and entitlements, members read job status, no client insert/update/delete on any of them, no client access to `stripe_events`. Applies on merge through the migrate workflow.
- **Cross-tenant integration test** `tests/integration/payments-rls.test.ts` (AC-5): the owner reads their rows; another account and an anonymous client read nothing from the three tables; no client reads the event ledger; the owner's insert and update attempts fail or change nothing, and a delete deletes nothing. Runs in CI's Supabase job (no local stack on the Dev machine).
- **Entitlement model** `src/lib/payments/entitlement.ts` (D-702): the pure reducer and `hasActivePack`; six unit tests cover grant, replayed and duplicate-session events, refund and double refund, refund before completion, ignored and malformed events, and immutability.
- **Pricing config and copy** (D-703): `readPricing` reads `PACK_PRICE_AUD_CENTS`, `GST_LINE` and `SUBSCRIPTION_PRICE_AUD_CENTS` (invalid or unset is null, never a guess); `formatAud`; `PRICING_COPY` with every page string and a unit test that runs the prohibited-claims lint over all of them plus the refund promise, checks the AI disclosure and not-legal-advice lines are present, and that no urgency or "from" pricing wording appears. `refundPromise()` reads the "Our promise" and "The document pack" paragraphs of `product/legal/refunds.md` at render time; the test re-parses the file and asserts identity.
- **`/pricing`**: works signed out; price and GST line from config (or an honest "not set" line); "What you get" lists the core set, or the signed-in owner's own set when their questionnaire is complete; "What it is not"; the refund promise; the AI disclosure; the not-legal-advice line; the subscription as "coming" (price only when configured); links to Terms, Privacy and the Refunds page; "Sign in to buy" (Session C swaps in the Checkout action). No checkbox, no countdown, no scarcity.
- **e2e** `e2e/pricing.spec.ts` on both projects: price "AUD 399" and the GST line (the Playwright server sets the two display values), refund promise, AI disclosure, notice, subscription line, the three legal links, the sign-in link, the document list, no urgency text, no checkbox, no horizontal overflow, axe clean. 2 passed. Screenshots at both viewports in `product/evidence/req-007/pricing-<project>.jpg`.
- **Config**: `.env.example` renames the earlier `STRIPE_PRICE_DOCUMENT_SET` placeholder to `STRIPE_PRICE_PACK` and adds `PACK_PRICE_AUD_CENTS`, `GST_LINE` and `SUBSCRIPTION_PRICE_AUD_CENTS`; `REQUIRED_LATER` lists `STRIPE_PRICE_PACK` and `PACK_PRICE_AUD_CENTS`.
- Stopped before anything that needs a Stripe key: no Stripe dependency is installed yet (Session B adds the SDK for `constructEvent`).

## PO review
(PO fills in.)

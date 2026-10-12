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
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
(PO fills in.)

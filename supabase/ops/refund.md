# Operator runbook: refunds and the paid generation job (REQ-007 FR-8)

Once-only steps for the operator (Haider). Nothing here needs a code change.
The product never issues a refund itself and never pays or takes a fee tied
to an audit; a refund is money back to the card the customer paid with.

## Refund a document pack

1. The customer emails the contact address with their purchase reference
   (the `/documents` page prefills it in the "Request a refund" link). Reply
   within two business days (`product/legal/refunds.md`).
2. Decide under the promise: full refund within 14 days if nothing was
   downloaded; after a download, a refund if the documents do not match the
   answers or are missing something promised; when unsure, in the customer's
   favour. Downloads are visible in the `audit_log` table (`action` =
   `documents.generated` for the set; the signed-URL redirects are not
   logged per file).
3. In the Stripe dashboard, open the payment (search by the customer's email
   or by the `purchases.stripe_payment_intent_id` value in Supabase) and
   refund it in full. No partial refunds for the pack.
4. Stripe sends `charge.refunded` to `/api/stripe/webhook`. The function
   `apply_stripe_event` marks the purchase `refunded`, sets `revoked_at` on
   the entitlement, and from then on `/documents` shows "This purchase was
   refunded", the set page shows that downloads are closed, and the download
   route answers 404 for that set. Check: `select status, refunded_at from
purchases where stripe_payment_intent_id = '<pi_...>'`.
5. The documents stay in storage for the retention window (REQ-004); they
   are purged with the account, not with the refund.

## When a refund arrives before the webhook saw the payment

Rare, but handled: `apply_stripe_event` records a refunded shell by payment
intent, and a later `checkout.session.completed` for the same intent fills
in the session id without granting anything. Nothing to do.

## The paid generation job did not finish

`/documents` keeps showing "preparing" and the customer has had no email.

1. Find the job: `select id, status, attempts, next_document_index, last_error,
next_run_at from generation_jobs where account_id = '<account>' order by
created_at desc`.
2. `status = 'failed'`: read `last_error`. Then either re-queue it:
   `update generation_jobs set status = 'queued', attempts = 0, last_error =
null, next_run_at = now() where id = '<job>'` and trigger a run (step 4),
   or refund (above). An alert line `payments.generation.failed` with the
   purchase id was logged when it failed.
3. `status = 'queued'` with `next_run_at` in the past and nothing happening:
   the chain of runs was interrupted (a deploy, a cold start). Trigger a run
   (step 4). Vercel Cron also calls the route once a day as a backstop
   (D-707; on a Pro plan change the schedule in `vercel.json` to every
   minute).
4. Trigger a run by hand:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/jobs/generate`
   The response lists what each run did and whether more remains; the route
   hands on to itself until the set is ready.
5. `status = 'running'` with `next_run_at` in the future: a run holds the
   lease; wait for it to pass (at most two minutes after the lease) and look
   again.

## Before the first real sale

- Set `GENERATION_LIVE=1` in Vercel (D-708); without it the job replays
  recorded fixtures and fails on any request that was not recorded.
- Set `STRIPE_WEBHOOK_SECRET` from the dashboard endpoint for
  `https://<site>/api/stripe/webhook` with the events
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`
  and `charge.refunded`.
- Run one test-mode purchase and one refund end to end and record the event
  ids in REQ-007's Delivery evidence.

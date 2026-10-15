# REQ-022: Launch readiness: the switchboard, the email provider, the domain, and the lawyer's bundle

Status: ready (PO, 15 Oct 2026; written from the launch blockers in the product status of 15 Oct, `supabase/ops/DEPLOY.md`, `.env.example`, REQ-004 FR-7, REQ-007, REQ-008, REQ-010 and D-013; questions for Dev at the end, answer in the Dev response and start Session A without waiting)
Phase: 6 Priority: must Owner: Dev

## Why (user and business outcome)

Everything a customer pays for is built and on production, and the product still cannot take a real payment, send a real email or be reached at its own name. The gap is a set of environment changes, account steps that only Haider can take, and checks that nobody has written down as code. This REQ turns that list into dev work so that, when the ABN, the Stripe live keys, the domain and the email key exist, going live is one pass through one page with every line green, and never a guess about which variable is missing. It also makes the "is it safe to be live" question answerable by a test, which is what a sole trader selling compliance documents owes the people who buy them.

## Scope (in / out)

In, as four sessions:

- Session A, the launch switchboard: an admin page and an ops script that show the state of every launch condition, by name and never by value, and the guards that refuse a half-configured live mode.
- Session B, transactional email: the provider behind `createEmailProvider()` (D-013 closes with D-2201), the sending domain, the magic link through the same provider, and the register reminders going out for real.
- Session C, the domain: the custom domain on Vercel, every URL that must change with it, the redirect from the vercel.app name, and the smoke test run against the real name.
- Session D, the lawyer's bundle and the business identity: one export of everything a lawyer reads, the ABN and business-name switch exercised end to end, and the About page's name.

Out: Sentry (REQ-010 part 2, its own item); a status page; marketing pages; any change to prices or plans; the recording session (its own runbook, `product/evidence/req-005/`); anything that reads a secret value into a page, a log or a file.

## Domain rules that apply (link to product/domain)

`CLAUDE.md` 4.1 (the brand carries no "NDIS"), 4.2 (honest marketing, no urgency), 4.3 (no interest, no late fees, no BNPL), 4.4 (no referral role), 4.5 (no participant data; nothing typed into registers reaches the model). `product/security/threat-model.md` (secrets, admin, email). REQ-008 (the legal pages are the contract) and REQ-007 (the refund promise). D-052 (every grant explicit), D-413 (hosted settings are Haider's), D-013 (email provider not chosen; closed here).

## Functional requirements (numbered FR-1 ...)

Session A, the launch switchboard

- FR-1 `/admin/launch` (behind `requireAdmin()` and the TOTP step, REQ-004 FR-7) lists every launch condition as a row with a name, a state (set, unset, mismatched, unverified) and one plain sentence on what to do, grouped: identity (BUSINESS_NAME, BUSINESS_ABN, CONTACT_EMAIL, the About page's name), payments (STRIPE_SECRET_KEY mode test or live, STRIPE_PRICE_PACK and STRIPE_PRICE_REGISTERS present and their `unit_amount` equal to PACK_PRICE_AUD_CENTS and SUBSCRIPTION_PRICE_AUD_CENTS, STRIPE_WEBHOOK_SECRET present, GST_LINE present, STRIPE_FAKE unset), generation (GENERATION_ENABLED true, GENERATION_LIVE 1, ANTHROPIC_API_KEY present, the model id), email (provider configured, sending domain verified, a test send succeeded within 24 hours), domain (NEXT_PUBLIC_SITE_URL equals the request's host, the Supabase Site URL and redirect list match, the Stripe webhook endpoint matches), jobs (CRON_SECRET present; the purge, generate and reminders jobs each ran within their schedule), admin (TOTP enrolled for the platform admin), legal (every page in REQ-008 renders with a "Last updated" date in the last 90 days). The page never prints a value, a key fragment, a price id or an email address; names and states only (REQ-010 FR-2's rule).
- FR-2 `scripts/ops/launch-check.mjs --base https://<domain>` runs the subset of FR-1 that is observable from outside without a session (health, the legal pages' dates, the CSP, the redirect from the vercel.app name, the price shown on `/pricing` equal to the Stripe-side amount when a read-only Stripe key is given in the environment, the sign-in page's magic-link form), prints one line per check and exits 1 on the first failure. It replaces nothing in `smoke.mjs`; the smoke stays the five-second check, this is the launch check.
- FR-3 Live-mode guards, at boot and in the webhook: a live Stripe key with STRIPE_FAKE set, with a test-mode price id, with a missing webhook secret, or with PACK_PRICE_AUD_CENTS not equal to the live price's `unit_amount` refuses to serve the payment routes (404 with one log line naming the condition) rather than selling at the wrong price; GENERATION_LIVE=1 without an ANTHROPIC_API_KEY refuses the generate job the same way. These extend REQ-007's start-up check; they never refuse the rest of the site.
- FR-4 A `product/ops/LAUNCH.md` checklist, plain numbered steps for Haider, each one naming the dashboard it happens in, the variable it sets, and the FR-1 row that goes green when it is done; the page and the checklist carry the same row names so they can be read side by side.

Session B, transactional email

- FR-5 Provider: `createEmailProvider()` gains the implementation chosen in D-2201, selected by EMAIL_PROVIDER (`log`, the default, or the provider's name); EMAIL_FROM is the sender (`Readyline <no-reply@<domain>>`), the reply-to is CONTACT_EMAIL. The provider sends the register reminders (REQ-018 FR-10), the draft-report reminders (REQ-020 FR-5), the worker invitation (REQ-020 FR-4), the purchase receipt line that REQ-007 names, and nothing else; every send is one audit-log line with the template name and the hashed address, never the body.
- FR-6 The magic link: Supabase Auth's custom SMTP is pointed at the same provider and sender, so sign-in mail and product mail come from one name; the runbook (FR-4) carries the SPF, DKIM and DMARC records to add at the registrar, and FR-1's email row turns green only when a test send from `/admin/launch` ("Send me a test email", to the admin's own address, rate-limited to one a minute) arrives and the provider reports the domain verified.
- FR-7 Templates: plain text with one HTML alternative, no images, no tracking pixels, no links other than to the site, the general-information line in the footer, an unsubscribe line only on the reminders (one click, written to the account's reminder settings; the invitation and the receipt are transactional and carry none). Copy lint runs over the templates.

Session C, the domain

- FR-8 The custom domain is added on Vercel with the vercel.app name kept as an alias that answers 301 to the domain for every path; NEXT_PUBLIC_SITE_URL, the Supabase Site URL and redirect URLs, the Stripe webhook endpoint, the GitHub PROD_URL variable and the sitemap's base all change in one documented pass (FR-4 lists them), and FR-1's domain row checks each against the request host.
- FR-9 `smoke.mjs` and `launch-check.mjs` run against the domain in the runbook's last step and their output is committed under `product/evidence/req-022/` with the date; the health route reports the domain in `siteUrl` so the record is unambiguous.
- FR-10 HSTS is turned on for the domain only after FR-8 is proven (one deploy later, never the same one), with a one-week max-age first and a one-year max-age after the first week's smoke stays green.

Session D, the lawyer's bundle and the business identity

- FR-11 `scripts/ops/legal-bundle.mjs` produces one PDF under `product/evidence/req-022/legal-bundle-<date>.pdf` with, in order: the five legal pages as rendered on the site (REQ-008), the AI and digital tools appendix, the refund promise as it appears on `/pricing` and `/documents`, the pricing page, the sign-in and account-setup screens, the worker invitation and reminder email templates, and one generated sole-trader document set from the committed evidence (`product/evidence/req-005/sole-trader/`), each section headed with its URL and the "Last updated" date; a cover page lists the questions in FR-12. No customer data of any kind; the bundle is built from the public pages and the committed fixtures only.
- FR-12 `product/legal/questions-for-the-lawyer.md`: the PO writes it (not Dev): the business structure, the general-information disclaimer's adequacy, the refund terms, the subscription terms, the AI disclosure, the privacy policy against the Australian Privacy Principles for a sole trader under the threshold, the worker role and the auditor link, and what a lawyer would change. Dev links it from the bundle's cover page.
- FR-13 Business identity end to end: with BUSINESS_NAME and BUSINESS_ABN set in a preview environment, the home page sentence (batch 45 item 1), the footer ABN line, the About page's name, the legal pages' party name, the receipt and the invoice-style purchase confirmation all show the same name and ABN, asserted by one e2e that runs with the two variables set to fixture values; with them unset nothing shows a placeholder.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 No page, script, log line, test output or evidence file ever contains a secret value, a key fragment, a price id, a webhook secret or a customer email; FR-1 and FR-2 print names and states only, and a unit test runs the switchboard's renderer over a fake environment full of marker strings and asserts none of them appear in the output.
- SR-2 `/admin/launch` and the test-send action sit behind `requireAdmin()` and the aal2 session; the test send goes only to the signed-in admin's own address and is rate-limited; every view and send is audited (D-418).
- SR-3 The email provider's key is server-only, named in `.env.example`, read in `src/server/**` only; the provider's inbound webhooks (bounces, complaints) are either not configured or verified with the provider's signature before any row changes; a bounce or complaint marks the address `do_not_send` in the account's reminder settings and nothing else.
- SR-4 The legal bundle is built from committed files and public routes; the script refuses to run with a session cookie or a secret key in its environment.
- SR-5 HSTS only after the redirect is proven (FR-10); the CSP and the security headers are unchanged by the domain move and asserted by the smoke on the new name.

## Data (entities, fields, retention)

- `reminder_settings` (per account) gains `do_not_send` with the reason and the date (SR-3). No other table changes.
- `launch_checks` is not a table: the switchboard reads the environment and the services on request; the ops scripts write their output to `product/evidence/req-022/` as files.

## Acceptance criteria (Given/When/Then, numbered AC-1 ...)

- AC-1 Given a preview deployment with every launch variable set to a test value, when the admin opens `/admin/launch`, then every row is green, and when any one variable is removed and the page reloaded, that row alone is red with its one sentence, and the page's HTML contains none of the values.
- AC-2 Given a live Stripe key with a test price id, when the app boots, then the payment routes answer 404 with one log line naming the condition and the rest of the site serves; the same for each guard in FR-3.
- AC-3 Given the provider configured with a verified domain, when the admin presses "Send me a test email", then the mail arrives within a minute from the configured sender with the general-information footer, the audit log has one line with the template name and the hashed address, and a second press within a minute is refused.
- AC-4 Given a worker invitation and a due register review, when the reminders job runs, then both emails go out through the provider, and an unsubscribe click on the reminder stops future reminders for that account without touching invitations.
- AC-5 Given the domain configured per FR-8, when `launch-check.mjs --base https://<domain>` runs, then every line is ok, the vercel.app name answers 301 for `/`, `/pricing` and `/sign-in`, and the health route reports the domain.
- AC-6 Given the committed fixtures, when `legal-bundle.mjs` runs, then one PDF exists with the sections in FR-11's order, each with its URL and date, a cover page with the FR-12 questions, and no string from the fixture accounts' emails.
- AC-7 Given BUSINESS_NAME and BUSINESS_ABN set to fixture values, when the FR-13 e2e runs on the three projects, then the same name and ABN appear on every surface listed and no placeholder appears anywhere with them unset.

## Test expectations (unit, integration, e2e, manual)

Unit: the switchboard's rows and the no-secrets renderer test; the live-mode guards with every combination in FR-3; the template renderer. Integration (CI's Supabase job): the reminder settings' `do_not_send`; the audit lines for sends. E2E (three projects): `/admin/launch` with the fixture admin; FR-13. Scripts: `launch-check.mjs` and `legal-bundle.mjs` run in CI against the production build with the fake provider and their outputs checked for the no-secrets rule. Manual (Haider, with the PO's runbook): the real test send, the real domain pass, the real HSTS step.

## Evidence required on delivery

Per session: `npm run check`; the CI run; screenshots of `/admin/launch` at 360 px and desktop with every row red and with every row green (preview, fixture values); the `launch-check.mjs` output; the legal bundle PDF's cover page; `product/ops/LAUNCH.md` complete; the ASVS rows for the admin page and the provider webhook; anything UNVERIFIED.

## PO decisions

- D-2201 Email provider. Chosen on four tests: a Sydney region for the data path (Supabase is ap-southeast-2 and Vercel is syd1, so mail should not be the one leg through another jurisdiction), a personal account with no company resources, pay-per-use with no plan or minimum (CLAUDE.md 4.3 is about what we charge, but the same honesty applies to what we buy), and a plain API with a signed webhook. Amazon SES in ap-southeast-2 meets all four; Resend meets three (no Australian region as at the read date). Decision: Amazon SES in ap-southeast-2, with `createEmailProvider()` keeping the `log` provider and a seam for a second provider so the choice is reversible in one file. Haider creates the account and the IAM user with send-only rights; the key is pasted by Haider into Vercel; Dev never sees it (standing rule).
- D-2202 Launch gate. Going live is a checklist, not a feature flag: production stays in Stripe test mode and `GENERATION_LIVE` unset until every row on `/admin/launch` is green and Haider has done the FR-4 pass himself. No "soft launch" with a live key and a test price.
- D-2203 The vercel.app name keeps working after the domain exists, as a 301, forever; links already shared must not break.
- D-2204 Order of sessions: A first (it is the measuring stick), then B and C in parallel if two sessions can run, D last; nothing in D blocks launch except FR-13.

## Questions for Dev to answer before building

1. Can the Stripe-side `unit_amount` check in FR-1 and FR-2 use the existing restricted key, or does it need a read-only key of its own? Prefer the existing key with a read call and no new secret.
2. Does Supabase custom SMTP accept SES SMTP credentials directly, or does the magic link need the provider's API through a Supabase Auth hook? State which and what Haider must enter.
3. The HSTS step: where does the header live today (`next.config.ts` or `vercel.json`), and can the max-age be an environment variable so the two-step in FR-10 is a variable change, not a deploy?
4. Estimate per session.

## Dev response

Written 15 Oct 2026 (Dev), before Session A.

1. **The Stripe `unit_amount` check uses the existing restricted key; no new secret.** The key already does this read: `src/lib/payments/price-startup.ts` calls `stripe.prices.retrieve(STRIPE_PRICE_PACK)` at start with a live key and refuses to serve on a mismatch (REQ-007), so the restricted key carries Prices read. FR-1 reuses that call for both price ids (and reads `livemode` from the Price to tell a test id from a live one). FR-2 runs outside the app, so it reads `STRIPE_SECRET_KEY` from the shell environment when present and skips the amount line with "not checked (no key in the environment)" otherwise; it never prints the key or the price id. The one extra permission is for the webhook-endpoint row in FR-1 (`webhookEndpoints.list`, "Webhook Endpoints: read" on the restricted key); until Haider adds it in the dashboard that row reads "unverified" with the sentence saying which permission to add, never an error.
2. **Supabase custom SMTP takes SES SMTP credentials directly; no Auth hook.** Supabase Auth, Authentication → SMTP Settings, takes host, port, username, password and sender; SES issues SMTP credentials from a send-only IAM user (SES console, "Create SMTP credentials"), with host `email-smtp.ap-southeast-2.amazonaws.com` and port 465 (TLS) or 587 (STARTTLS), and the sender must be a verified SES identity (the domain, once its DKIM records are in). Haider enters: the host, the port, the SMTP username and password SES generated (not the IAM access key pair), and `Readyline <no-reply@<domain>>` as the sender. Two vendor facts the runbook must carry: a new SES account is in the sandbox (sends only to verified addresses) until production access is requested, which takes up to a day; and Supabase's rate limit for custom SMTP starts low (30 emails an hour) and is raised in the same settings page. These are from the vendors' documentation as I know it (Supabase "Custom SMTP", AWS "Obtaining SES SMTP credentials"); the runbook step links both and Haider confirms the two pages on the day. The "Send Email" Auth hook is the alternative if the SMTP path ever fails; not needed for a magic link.
3. **HSTS lives in `next.config.ts` `headers()` (static, read at build) and already sends `max-age=63072000; includeSubDomains; preload` on every response, so the vercel.app name carries it today (moot there: Vercel preloads its own domain).** The max-age can be an environment variable (`HSTS_MAX_AGE`, read in `next.config.ts` at build), but on Vercel any environment change takes effect only on the next deployment, so the two-step in FR-10 is two variable edits each followed by a Redeploy click, never a code change; reading it at request time in `proxy.ts` would not remove that redeploy. What Session C delivers: `HSTS_MAX_AGE` with a code default of one week (604800), `preload` added only when the value is at least one year (the preload list requires that), and the runbook's two steps (set 604800 and redeploy after FR-8 is proven; set 31536000 and redeploy a week later). The default moving from two years to one week lowers nothing that matters: no browser has the custom domain pinned yet, and the vercel.app name is preloaded by Vercel regardless.
4. **Estimate.** Session A: 6 to 8 hours (the switchboard's rows as one pure module with the no-secrets test, the admin page, `launch-check.mjs`, the FR-3 guards in the boot check and the webhook route, `LAUNCH.md`), one session plus a short second one for the e2e on three projects. Session B: 4 to 5 hours of code (the SES implementation behind `createEmailProvider()`, EMAIL_PROVIDER/EMAIL_FROM, the templates with the copy lint, the bounce webhook with signature verification and `do_not_send`, the test send), plus Haider's account and domain steps, which gate the real test. Session C: 2 to 3 hours of code (the 301 from the vercel.app name, `siteUrl` in the health route, the sitemap base, `HSTS_MAX_AGE`, the evidence capture) plus the runbook pass, which is Haider's. Session D: 4 to 5 hours (`legal-bundle.mjs` rendering the public routes and the committed sole-trader set to one PDF, the FR-13 e2e with the two variables set). Order as D-2204.

Assumptions for Session A, recorded in `DECISIONS.md` as Dev decisions when built: (a) the three jobs write one `audit_log` row per run (`jobs.<name>.ran`, no actor, the count in `target`) so "ran within its schedule" is a database read, not a log search; (b) the Supabase Site URL and redirect list are not readable with the project's keys, so that row is "unverified" with the sentence naming the dashboard page, and FR-2 proves the redirect from outside instead; (c) the TOTP row reads the platform admin's verified factors through the admin API; (d) the email row's "test send within 24 hours" is an `audit_log` row written by the test-send action.

## Delivery evidence

Not started.

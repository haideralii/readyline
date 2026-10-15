# Launch checklist (REQ-022 FR-4)

Written for Haider. Each step names the dashboard it happens in, the variable it sets, and the row on `/admin/launch` that goes green when it is done. The page and this list use the same row names, so read them side by side. Going live is this list, not a flag: production stays in Stripe test mode and `GENERATION_LIVE` unset until every row is green and you have done this pass yourself (D-2202). Nothing here asks you to paste a value anywhere but the dashboard that owns it; never into chat, a file or a ticket.

Row states: **Set** (done), **Not set** (the step is still to do), **Mismatched** (set, but wrong; the sentence says what), **Not verified here** (the page cannot read it with the project's keys; check it by hand where the sentence says).

## 1. Identity

1. Register the ABN and the business name (ABR; ASIC). Vercel, Settings, Environment Variables, Production: set `BUSINESS_NAME` and `BUSINESS_ABN` (eleven digits, no spaces). Rows: **Business name**, **ABN**.
2. Vercel: `CONTACT_EMAIL`, the address you answer from. Row: **Contact email**.
3. Ask the PO to put the registered name into `product/legal/about.md`. Row: **About page carries the registered name**.

## 2. Payments (keep the key in test mode until section 9)

4. Stripe, Product catalogue: the pack Price (AUD, one-off) and the registers Price (AUD, monthly, no trial, no setup fee), both in the mode the key is in. Vercel: `STRIPE_PRICE_PACK`, `STRIPE_PRICE_REGISTERS`, `PACK_PRICE_AUD_CENTS` (the pack Price's unit_amount), `SUBSCRIPTION_PRICE_AUD_CENTS` (the registers Price's unit_amount). Rows: **Pack price matches Stripe**, **Registers price matches Stripe**.
5. Stripe, Developers, Webhooks: an endpoint at `https://<domain>/api/stripe/webhook` with the events `supabase/ops/DEPLOY.md` section 7 and 7a list. Vercel: `STRIPE_WEBHOOK_SECRET` from that endpoint. Rows: **Stripe webhook secret**, **Stripe webhook endpoint** (needs "Webhook Endpoints: read" on the restricted key; otherwise the row says Not verified here and you check the list by eye).
6. Vercel: `GST_LINE`, the sentence beside the price. Row: **GST line**.
7. Vercel: make sure `STRIPE_FAKE` does not exist in Production. Row: **Fake Checkout off**.

## 3. Generation

8. Vercel: `GENERATION_ENABLED` = `true`. Row: **Generation enabled**.
9. Anthropic console: a key with a monthly spend cap. Vercel: `ANTHROPIC_API_KEY`; `ANTHROPIC_MODEL` to pin the model (otherwise the code default, D-048). Rows: **Anthropic API key**, **Model id**.
10. `GENERATION_LIVE` stays unset until section 9. Row: **Live model calls** (red until then, by design).

## 4. Email (REQ-022 Session B; the rows read Not set until it ships)

11. Amazon SES, ap-southeast-2 (D-2201): verify the sending domain (add the DKIM CNAME records, and the SPF and DMARC TXT records SES shows, at the registrar), request production access (new accounts start in the sandbox), create a send-only IAM user and its SMTP credentials. Vercel: the provider variables Session B names in `.env.example`. Row: **Email provider**, **Sending domain verified**.
12. Supabase, Authentication, SMTP Settings: host `email-smtp.ap-southeast-2.amazonaws.com`, port 465, the SMTP username and password SES generated, sender `Readyline <no-reply@<domain>>`; raise the rate limit from the default. Then on `/admin/launch` press "Send me a test email" and confirm it arrived. Row: **Test email in the last 24 hours**.

## 5. Domain (REQ-022 Session C)

13. Registrar: the domain. Vercel, Settings, Domains: add it; the vercel.app name stays as a 301 alias (D-2203). Vercel: `NEXT_PUBLIC_SITE_URL` = `https://<domain>`. Row: **Site URL matches this host** (open `/admin/launch` on the domain itself).
14. Supabase, Authentication, URL Configuration: Site URL `https://<domain>` and the redirect URLs exactly as `DEPLOY.md` section 5 lists them, each with its trailing `*`. Row: **Supabase Site URL and redirects** (always Not verified here; the launch check below proves the sign-in path from outside).
15. Stripe, Developers, Webhooks: move the endpoint to the domain (step 5 again). GitHub, repository variables: `PROD_URL` = `https://<domain>`. Row: **Stripe webhook endpoint**.
16. HSTS, one deploy after the redirect is proven: Vercel `HSTS_MAX_AGE` = `604800`, redeploy; a week later `31536000`, redeploy (Session C).

## 6. Scheduled jobs

17. Vercel: `CRON_SECRET` (`openssl rand -hex 32`), the same value as the GitHub repository secret. Row: **Cron secret**.
18. Vercel, Settings, Cron Jobs: the three schedules from `vercel.json` listed; each run writes an audit row. Rows: **Purge job ran in the last 26 hours**, **Generate job ran in the last 26 hours**, **Reminders job ran in the last 26 hours** (they turn green by themselves within a day of the deploy).

## 7. Admin

19. Supabase, Table editor, `users`: `platform_admin` = true on your own row (`DEPLOY.md`). Then `/admin/mfa`: enrol the authenticator. Row: **Authenticator enrolled for the platform admin**.
19a. Vercel: `HASH_PEPPER` (`openssl rand -hex 32`), the key behind the hashed viewer addresses on audit lines and the hashed emails on worker invitations (retro finding 34). Set it once and keep it: a change orphans every open invitation. Production refuses to start without it. Row: **Hash pepper**.

## 8. Legal pages

20. The PO reviews each page (`product/legal/*.md`) and sets its `updated` date; every page must be under 90 days old on launch day. Rows: **terms page updated in the last 90 days**, and the same for privacy, refunds, ai and about.

## 9. The last pass (everything above green)

21. Run from a laptop: `node scripts/ops/launch-check.mjs --base https://<domain> --alias https://<name>.vercel.app`, with `STRIPE_SECRET_KEY` and `STRIPE_PRICE_PACK` in the shell environment for the price line. Then the public suite against the deployment, a second launch check (batch 47 item 9): `PLAYWRIGHT_BASE_URL=https://<domain> npm run test:e2e -- --project=desktop-chromium` (the specs know a deployment has no development badge and that same-origin means the domain). Commit both outputs under `product/evidence/req-022/` with the date.
22. Stripe: the live restricted key (same permissions as the test one). Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PACK`, `STRIPE_PRICE_REGISTERS` all from live mode in one go; redeploy. Row: **Stripe key mode**. If any payment row is red after the redeploy, the payment routes refuse to serve (404) and say why in the log; fix the row, redeploy.
23. Vercel: `GENERATION_LIVE` = `1`; redeploy. Row: **Live model calls**.
24. Open `/admin/launch`: every row green but **Supabase Site URL and redirects**, which you checked in step 14. Run `npm run smoke -- --base https://<domain>`. Buy one pack yourself with a real card, download it, and refund it the way `/refunds` promises (the runbook `supabase/ops/refund.md`). Then tell the PO.

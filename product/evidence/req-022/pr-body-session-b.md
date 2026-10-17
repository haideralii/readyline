# REQ-022 Session B: transactional email over plain SMTP

PR #98 into `next`, branch `req-022-session-b` from `next` baad436. Dev-1, 17 Oct 2026.

## What this PR does

- **FR-5, the provider (D-2822).** `createEmailProvider()` reads `EMAIL_PROVIDER`: `log` (or unset) is the log-only provider as before; `smtp` is plain SMTP through `nodemailer` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` and `HASH_PEPPER` (TLS on 465, STARTTLS otherwise; the reply-to is `CONTACT_EMAIL`). `smtp` with a name missing logs the names once and falls back to log-only, and the launch row reads mismatched. Every real send writes one `audit_log` line (`email.sent`, the template's name and the recipient's peppered hash), never the body or the address. No account, no vendor code: the sender Haider picks on the day is five values here and the same five in Supabase's SMTP settings.
- **FR-7, the templates.** Each template names itself; the HTML alternative is rendered from the template's text (paragraphs, a list, one link per on-site URL, no image, no style, no off-site link), so the two parts cannot drift; the reminders carry the one-click unsubscribe line when given the link; the invitation and the report reminder carry none.
- **SR-6 and the Data section, `reminder_settings`.** Migration `20261017050000_reminder_settings.sql`: one row per account (`do_not_send`, its reason under a CHECK of three, its time, the token's SHA-256); members read, the owner updates, inserts by the owner or the service role, no delete through the API; revoke then grant. The token is derived (HMAC-SHA256 of the account id under `HASH_PEPPER`, 256 bits), the row keeps only its hash, the click compares in constant time, an unknown token is 404.
- **The job (D-2823, both gates).** `do_not_send` holds every reminder back (counted as suppressed, the rows left unsent); D-2313's subscription test stays for the five timeline kinds. The reminders carry the link; each message names its account for the audit line.
- **FR-6, the test send and the domain row (D-2824).** "Send me a test email" on `/admin/launch`: to the signed-in admin's own address, one a minute, audited as `email.test-sent`; the "Test email in the last 24 hours" row reads that line. "Sending domain verified" becomes "Sending domain records": the sender's SPF and DMARC from DNS with a timeout, never a thrown page; DKIM is a runbook line.
- **The runbook.** `LAUNCH.md` section 4 is vendor-neutral: the SPF, DKIM and DMARC records with placeholders, the six variables on Vercel, the same five in Supabase, the test send.

## Tests

- Unit: `provider.test.ts` (the selection matrix, each missing name, the send's parts and the audit entry), `html.test.ts`, `templates.test.ts` (every template as the provider sends it), `unsubscribe-token.test.ts`, `sender-domain.test.ts`, `launch.test.ts` (the provider row's three states, the domain row's four, the six names as markers in the no-secrets renderer test).
- Integration (the Supabase job): `tests/integration/reminder-settings.test.ts` (RLS from three seats, the CHECK, the click, the job's gate); the grants map gains the table.
- E2E: `e2e/req-022-b.spec.ts` (the 404s, public); `e2e/signed-in/admin-launch.spec.ts` (the test send through the log provider, the row turning green, the second press refused, the one audit line).

## Not in this PR

The real send (Haider's sender, registrar and Supabase steps, manual per AC-3); bounces and complaints (SR-3: not configured at launch); Session C (the domain) and Session D.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

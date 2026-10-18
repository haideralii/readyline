# Incident runbook (REQ-030 FR-4, D-2868)

For Haider, who runs Readyline alone and is not an infrastructure engineer. Plain and numbered. Every account step is yours; no one else holds a login. Every secret is named here by its variable name only; no value, no tokened link, no address appears in this file, and nothing you paste here or in a GitHub issue may carry one either. Where a step says "note it", the note is a dated line in `DECISIONS.md` (section 7).

## 0. The first hour

1. Who: you. There is no on-call rota; the "Site down" issue email, a Sentry email and a customer's email all come to you.
2. Where to look, in this order: GitHub, Actions (the kick workflow's last runs and any open "Site down" issue); Vercel, the project's Deployments and Logs (filter the last hour); Supabase, the project's home (paused? storage? auth errors); Sentry, Issues (the newest, by `errorId` tag); Stripe, Developers, Webhooks (failed deliveries); `/admin/launch` once the site answers (every row, then the jobs group).
3. Write the time you noticed and what you saw in a scratch note before you change anything; section 7 turns it into the record.
4. Do not rotate a secret, redeploy or restore until the section below tells you to; each of those costs more than a few minutes of outage.

## 1. The site is down

1. Open `https://<domain>/api/health` and the home page yourself from a phone off Wi-Fi. If both answer, the uptime check saw a blip: wait for the next kick run; the issue closes itself after two passes.
2. If they do not answer: Vercel, Deployments. A failed or building deployment: open it, read the last lines of the build log, and if a deploy of yours broke it, "Promote to Production" the previous deployment (Vercel keeps them) and note it.
3. Vercel status page green and the deployment "Ready" but the site still fails: Vercel, Logs, filter `level:error` for the last hour; a line `env.missing` or `startup` names a variable the server refuses to start without (`src/lib/env.ts`); set it and redeploy.
4. The home page answers but `/api/health` does not: the function region or Fluid compute setting changed (`supabase/ops/DEPLOY.md` section 2); restore the setting and redeploy.
5. Everything answers but signed-in pages fail: go to section 2.
6. When it is back: close the "Site down" issue if the check has not (two passes close it), and write section 7's note.

## 2. Supabase is down or paused

1. Supabase, the project's home. A free-tier project pauses after seven idle days (D-2207); the page says "Paused" and offers "Restore project". Press it; restoring takes a few minutes; nothing is lost.
2. Not paused but red: Supabase's status page. If the region is down, wait; the site's public pages keep answering, signed-in pages show the plain "not available" message, and nothing is written.
3. After a restore or an outage: open `/admin/launch`; the jobs rows go green by themselves within a day; run `/api/jobs/purge` by hand only if the purge row stays red past 26 hours (`DEPLOY.md` section 8).
4. If the project will not restore, go to section 6.

## 3. A secret leaked

A secret has leaked when it was pasted anywhere it should not be (a chat, a screenshot, a commit, a log you shared), when a device holding it was lost, or when a vendor tells you so. Rotate in this order; each line says both homes of the value.

1. `SUPABASE_SECRET_KEY` and the database password (`SUPABASE_DB_PASSWORD`): Supabase, Settings, API, rotate the service-role key; Settings, Database, reset the password. New values into Vercel (`SUPABASE_SECRET_KEY`) and the GitHub repository secrets (`SUPABASE_DB_PASSWORD`, read by `migrate.yml` and `backup.yml`). Redeploy. Until then the site cannot read or write, so do this first and fast.
2. `CRON_SECRET`, in both places: `openssl rand -hex 32`; Vercel and the GitHub repository secret, the same value; redeploy. The kick, the uptime report and the three cron routes answer 404 to the old value from then on.
3. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: Stripe, Developers, API keys, roll the restricted key; Developers, Webhooks, roll the signing secret. Vercel; redeploy. A webhook delivery that failed in between is retried by Stripe.
4. `ANTHROPIC_API_KEY`: the Anthropic console, create a new key, delete the old; Vercel; redeploy. A generation in flight fails once and is picked up by the next kick.
5. `SMTP_PASS`: the mail provider's console, new SMTP credentials; Vercel and Supabase, Authentication, SMTP Settings (the same value in both, `LAUNCH.md` section 4); redeploy.
6. `GITHUB_DISPATCH_TOKEN`: GitHub, Settings, Developer settings, revoke the token and create its replacement with the same single permission; Vercel; redeploy. Until then the thirty-minute schedule carries the kicks.
7. `SENTRY_DSN`: Sentry, the project's Client Keys, revoke the key and create a new one (a DSN lets anyone send events, REQ-030 SR-5); Vercel; redeploy.
8. `BACKUP_PASSPHRASE`: generate a new one (at least 24 random characters, D-2876), replace the GitHub repository secret, and then delete every retained backup artifact under Actions (each one is readable to whoever holds the old passphrase); the next Sunday's run makes the first copy under the new one. A leaked passphrase is a suspected breach of every artifact still retained: go to section 5 too.
9. `HASH_PEPPER` only if it leaked (D-2238): a change orphans every open invitation and re-keys every hashed address, so rotate it only when the pepper itself was exposed, not as a precaution. Vercel; redeploy; then tell any owner with an open invitation to send it again.
10. After the rotation: Vercel, Logs, the first ten minutes after the redeploy, for `env` or `auth` errors; `/admin/launch`, every row; section 7's note with the date and which secrets were rotated (names only).

## 4. A customer reports a wrong document

1. Reply the same day with these words, from the support mailbox: "Thank you for telling us. Our documents are first drafts prepared for your review, not legal advice, and we would rather fix a wrong line than have you adopt it. Please tell us the document and the section, and we will look at what your answers produced and come back to you within two working days." Nothing more until you have read it.
2. Sign in as the platform admin and open the reviewer view for the customer's set (`/documents/<set>`, the "Which answers drove this section" panel) to see which questionnaire answers fed the section. If the section is right for the answers but the answers were wrong, say so kindly and point to "Change my answers"; a re-generate from corrected answers is theirs to run.
3. If the section is wrong for the answers (a template or prompt fault), note the document type and section in `DECISIONS.md` as a defect, fix the template or the fixture in a branch with a test, and re-generate the customer's set once the fix is live (the documents page's regenerate action, free of charge).
4. If the customer wants their money back, `supabase/ops/refund.md` is the procedure; the refund terms on the refunds page bind us, not the other way round.
5. Never promise an outcome with an auditor or the Commission (CLAUDE.md 4.3).

## 5. A suspected data breach

Readyline holds business information about providers and codes for their workers, and by design no participant information and no health information. A breach here is not a reportable incident under the NDIS Act or the Incident Management Rules, because Readyline is not an NDIS provider (D-2878); the provider's own duties to its workers and participants are carried by step 6 below.

1. Contain first: rotate the secrets involved (section 3), revoke the sessions or links involved (an auditor link or an invitation can be revoked from the account page or the admin page), take the deployment down if the leak is live (Vercel, "Pause" the project), and stop any job that could spread it.
2. Assess within 30 days whether there has been unauthorised access, disclosure or loss, and whether serious harm to any person is likely. Write the assessment down: what was involved (tables, fields, date range, how many accounts), how it happened, who could have read it. An encrypted backup artifact taken without the passphrase is not, on its own, likely to cause serious harm; record why.
3. If a customer's registers hold participant information a customer typed against the product's rule, the small-business exemption question changes; email the practising lawyer before the assessment closes (`product/legal/questions-for-the-lawyer.md`, 5.1).
4. If serious harm is likely and remedial action has not removed the risk: send the OAIC's online notifiable data breach statement as soon as practicable, and email each affected owner the same day with what was involved and what you have done. Readyline may sit under the small-business exemption; follow the scheme anyway (the threat model's line).
5. Keep the assessment, the statement and the emails as the record (section 7).
6. For worker data: tell the owner which fields and which dates were involved, so the owner can tell its workers; Readyline holds no worker email it can use for that.
7. The privacy page's breach sentence names the OAIC and says "where the law requires it"; nothing you write to a customer should promise more or less.

## 6. Restore from backup

The weekly backup (REQ-030 FR-2, D-2866, Session B) is an encrypted `pg_dump` of the database held as a GitHub Actions artifact for 90 days, readable only with `BACKUP_PASSPHRASE`. A restore loses up to a week of entries and every account deleted since the copy was taken comes back; both are dealt with below.

1. Decide first whether a restore is really needed: a paused project restores itself (section 2); a bad migration is reverted with a new migration; only a lost or corrupted database justifies this section.
2. GitHub, Actions, the backup workflow, the newest green run, download the artifact. On your laptop: decrypt with `gpg --decrypt --batch --pinentry-mode loopback --passphrase-fd 0` and the passphrase from your password manager (`scripts/ops/restore-rehearsal.sh` shows the exact commands and is what CI rehearses).
3. Supabase: a fresh project in the same region if the old one is gone, else the existing one; apply the migrations first (`supabase db push`, `DEPLOY.md` section 6), then restore the dump over the database URL with `scripts/ops/restore-rehearsal.sh` itself (`DB_URL`, `BACKUP_PASSPHRASE`, `IN`): it decrypts, writes the archive out as SQL and runs it in one transaction with `session_replication_role = replica`, so a refused restore leaves the stack as it was; then compare the `auth.users` and `public.accounts` counts with the ones the backup log or the last switchboard read gave, as CI's rehearsal does on every run.
4. Vercel: if the project changed, every `SUPABASE_*` value and the Site URL and redirect list (`DEPLOY.md` sections 3 and 5); redeploy.
5. Re-delete every account deleted since the backup date: the account-deleted confirmation emails in the sending mailbox are the list (one per deletion, dated); delete each from the admin page, then run `/api/jobs/purge` by hand with the cron bearer so their rows and artifacts go.
6. Email every owner the restore date and that entries made after it must be re-entered from their own records; the terms say their registers and exports are theirs to keep for this reason (D-2877).
7. Open `/admin/launch` and the audit-day page of one account you know; then section 7's note, with the size of the dump, the restore time and the date of the copy used.

## 7. Afterwards

1. One dated entry in `DECISIONS.md` under the incidents heading: what happened, when you noticed, what you did (secrets by name only), what it cost customers, and one thing that changes so it does not happen again.
2. One dated evidence note under `product/evidence/incidents/<date>.md` with the timeline, the links to the GitHub issue or the Sentry event by number, and the assessment of section 5 if it ran. No value, no tokened link, no customer's name.
3. If the runbook sent you wrong, fix the runbook in the same branch.

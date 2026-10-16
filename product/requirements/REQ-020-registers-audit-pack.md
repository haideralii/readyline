# REQ-020: Registers for the audit day and for the team: the audit pack, worker logging, self-checks, hazards and import

Status: ready, with Sessions A, B and C delivered on `req-020-audit-pack` b6865f1, `req-020-team` 2493295 and `req-020-session-c` d4d6022, PRs to `next` awaiting the merge window and the PO's acceptance (retro review 15 Oct 2026, `product/qa/req-reviews/2026-10-15-retro-req-018-021.md`) (Dev draft 14 Oct 2026 from `product/research/registers-competitors.md` gaps 1 to 5; reviewed and set ready by the PO the same day; the four Dev answers are accepted as written in the Dev response; the PO review at the end adds FR-10 to FR-12 and three edits, all binding)
Phase: 5 Priority: should Owner: Dev

## Why (user and business outcome)

The AUD 39 a month plan sells a system of record that is alive on the audit day. Three things stand between the registers we have and the ones a two-to-ten-worker provider pays for every month: on the day, the owner needs everything in one place for the auditor without pasting exports together (AuditCore and Auditly sell exactly this); between audits, the owner is the only person who can log anything, so incidents and complaints wait for the evening and the register goes stale (ONDIS prices by staff for that reason); and a provider moving off a spreadsheet or a template pack brings years of rows that no one will retype. Closing these keeps subscribers after the audit, which is the primary metric (`CLAUDE.md` section 3), without adding any participant personal information or a CRM (research note 8, `CLAUDE.md` 4.5).

Gap 6 from the research, living policies, is REQ-021's sibling and its own item (standing backlog 8); gap 7, a team tier, is pricing and waits for worker logins to exist.

## Scope (in / out)

In, as three sessions:

- Session A, the audit day: a one-click audit pack and a time-limited read-only auditor link.
- Session B, the team: a worker role invited by email, and a no-login "report an incident" link per account that creates a draft the owner confirms.
- Session C, the records: a hazard and WHS register; CSV import for incidents, complaints, worker checks and corporate risks using the export column names; a quarterly self-check walk that writes findings into the improvement register.

Out: participant case records, support plans, rostering, uploads of participant files, certificates (dates and "where the file is kept" only, as REQ-018 SR-3), per-seat pricing, a team tier, living policies (backlog 8), any AI over register text (`CLAUDE.md` 4.5: nothing typed into registers reaches the model).

## Domain rules that apply (link to product/domain)

`product/domain/ndis-registration-primer.md` (what an auditor samples; the twelve records); `product/domain/ui-copy.md` and `house-style.md` (plain words, one step at a time); `product/security/threat-model.md` (identity and access, data, the no-participant-data rule); `CLAUDE.md` 4.4 (the auditor link is a convenience for the provider, never a referral or an intermediary role; no auditor is paid or paying) and 4.5.

## Functional requirements (numbered FR-1 ...)

Session A, the audit day

- FR-1 Audit pack. One button on the audit-day page and the registers index, "Download my audit pack", produces one zip: every register as the existing CSV (REQ-009 FR-6 and REQ-018, including the events trails), the document control register as CSV, the readiness summary PDF, the adopted documents' current versions as `.docx` (the set's zip contents), and a cover sheet (one page, PDF) listing what is inside, the account's trading name, the date, and the general-information line. Built from the existing exports with no new data; subject to the register export limit (REQ-009 SR-3; five an hour) and logged as `audit_pack.downloaded` in the audit log.
- FR-2 Auditor link. The owner can create one read-only link at a time: a random token of at least 128 bits, a stated expiry chosen from 24, 48 or 72 hours (72 the default), revocable at any time from the account page, shown with its expiry and the time it was last opened. The link opens a signed-out page that serves the same audit pack (zip) and a read-only view of the document control register and each register's list, with every participant reference shown as its code only (codes are never resolved anywhere, so this is the existing display); everything the provider typed into a register is in the view exactly as typed, so the account page tells the owner to check summaries and notes for names before sharing, and the view is the provider's own disclosure (retro finding 59; terms, "Acceptable use"). The worker checks register's list shows the check number beside the worker code: the Worker Screening Rules s 18(3)(d) list it and it is not a name (PO decision 15 Oct 2026, retro review finding 35; REQ-024 D-2407 amended to match). Every open writes an audit-log line (`auditor_link.opened`, with the link id, never the viewer's address in clear; the address hashed as for emails). Creating, revoking and expiring write their own lines. The page carries a plain banner: "Read-only view shared by <trading name> for its audit; it expires on <date>."
- FR-3 Nothing in FR-2 names, lists or recommends auditors, carries a fee or a referral, or is sent to anyone by Readyline; the provider copies the link and sends it themselves (`CLAUDE.md` 4.4, D-109).

Session B, the team

- FR-4 Worker role. `memberships.role` gains `worker` (REQ-004 FR-3 modelled it). The owner invites a worker by email from the account page (the same magic-link sign-in; a pending invitation row with an expiry of 7 days, revocable); the worker sees a worker home with two actions, "Log an incident" and "Log a complaint", and the list of their own entries (rows where `created_by` is their user), nothing else: no other registers, no documents, no account settings, no export. A worker's entry is a normal row (same forms, same participant-data warning and codes) marked `logged_by_ref` with the worker's code so the owner sees who logged it. The owner can remove a worker; their rows stay.
- FR-5 Report link. Each account can turn on one "report an incident" link (a token as in FR-2, no expiry, revocable, regenerable) that opens a signed-out form with the incident form's fields minus the Commission-notification fields, the participant-data warning on every free-text field, and a one-line "who are you" (a worker code or a name-free role such as "casual worker"). Submitting creates an incident row with `status = 'draft'` and `reported_via = 'link'`; the owner sees "1 report to confirm" on the registers index and the audit-day page, opens it, completes the notification fields and confirms it (which turns it into an ordinary row; the notification clock runs from the later of the occurred date and the day the provider became aware, which the PO edit below fixes at submission, D-2231) or rejects it with a reason (kept, append-only, as a rejected report). Draft rows are not counted in the register's totals, overdue counts or reminders until confirmed. The link's form is rate-limited per address (10 an hour) and per account (50 a day), and refuses more than 10 unconfirmed drafts per account.
- FR-6 The owner's "Try again" and "Continue" style of one-tap actions apply: confirming a report is one screen, one button (REQ-017 FR-5).

Session C, the records

- FR-7 Hazard and WHS register. One row per hazard: where (a code for a site or vehicle, never an address), what the hazard is, who it could harm (participant, worker, visitor), how likely and how serious (the corporate risk register's two scales), what we did, by when, done on, and a review date; linked from the incident's page after it is saved ("Was a hazard behind this? Add it to the hazard register"; a hazard has no incident field, so the form itself carries no link, D-2236) and from the corporate risk register's emergency and WHS areas. Reminders: review date 14 days before and on the day (REQ-018 FR-10's register-review kind). Appears on the audit-day page's list of records with a live state.
- FR-8 CSV import. On each of the incidents, complaints, worker checks and corporate risks registers, "Import from a spreadsheet" takes a CSV whose header row uses exactly our export's column names (a downloadable empty template per register), shows a preview with every row's validation result (the same zod schemas and the participant-data detector as the forms; an NDIS-number or a name in a field fails that row), and imports only the rows that pass, writing one `register_events` line per row with `kind = 'imported'` and one audit-log line per import with the counts. Rows that fail are listed with the row number and the reason; nothing is partially written within a row. Limits: 500 rows per file, 1 MB, five imports an hour per account.
- FR-9 Quarterly self-check. A guided walk, "Check my systems", offered on the audit-day page every three months (and on demand): one screen per record in the audit-day list showing its live state and one question in plain words ("Is every incident this quarter in the register, with what you did next?"), answered yes or no with an optional note. Every "no" writes an improvement register row with the source `self-check`, a due date 30 days out (no reminder kind exists for an improvement's due date; the register's overdue state stands, PO 15 Oct 2026, D-2236); the walk ends with the count of findings and the next date. Each walk is a row in a `self_checks` table (date, who, findings count), and the audit-day page shows the last walk's date and its open findings.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 Tokens (FR-2, FR-5) are random, stored hashed (SHA-256), compared in constant time, scoped to one account, and never appear in logs; a revoked or expired token answers 404, never "expired" (no probing). Signed-out pages behind a token carry `noindex`, the security headers, and no account id, email or user id in the HTML. The viewer's address (FR-2) and the invitation email (FR-4) are hashed with a `HASH_PEPPER` from the environment (an HMAC, not an unsalted SHA-256; the `log` fallback is refused in production); VERIFY until Haider sets it (PO decision 15 Oct 2026, retro review finding 34).
- SR-2 RLS: the worker role reads and inserts only its own incident and complaint rows (`created_by = auth.uid()`), reads nothing else; a signed-out report writes through one `security definer` function that validates the token and inserts a draft row only, with no read path. Integration tests prove a worker cannot read the owner's rows, another account's rows, the registers index data or the documents; the report function refuses a bad, revoked or foreign token; the auditor link's read path returns nothing for another account's token.
- SR-3 Participant data: every imported or reported free-text field passes the same CHECKs and the detector as typed fields; the report form's "who are you" never accepts a name-shaped value; the auditor page shows codes only (existing rule, asserted by a test over the page's text).
- SR-4 Rate limits as stated in FR-1, FR-5 and FR-8; audit-log lines for every creation, open, revoke, invite, remove, import and self-check.
- SR-5 The invitation email names the business and the role and carries no register content; the worker's sign-in uses the existing magic link and limiter (REQ-004).

## Data (entities, fields, retention)

- `auditor_links` (account_id, token_hash, expires_at, revoked_at, created_by, last_opened_at, opened_count).
- `report_links` (account_id, token_hash, revoked_at, created_by); `incidents` gains `status 'draft'`, `reported_via` (`owner` | `worker` | `link`), `logged_by_ref` (a worker code), `rejected_reason`.
- `memberships.role` gains `worker`; `invitations` (account_id, email_hash, role, token_hash, expires_at, accepted_at, revoked_at).
- `hazards` (the FR-7 fields, member RLS, owner delete, append-only events through `register_events`).
- `imports` (account_id, register, rows_total, rows_imported, created_by, created_at); `register_events.kind` gains `imported`.
- `self_checks` (account_id, walked_on, walked_by_ref, findings); improvement rows gain `source_kind 'self-check'`.
- Retention: with the account (purged on deletion, REQ-004 FR-6); tokens are deleted on revoke or expiry plus 30 days.

## Acceptance criteria (Given/When/Then, numbered AC-1 ...)

- AC-1 Given a subscribed owner with the sole-trader set adopted and one row in each register, when they download the audit pack, then the zip holds every register CSV, the document control CSV, the summary PDF, the adopted documents and the cover sheet, the audit log has one line, and a sixth download within the hour is refused with the plain message.
- AC-2 Given an auditor link with a 72-hour expiry, when a signed-out browser opens it, then the pack downloads and the registers read with codes only; after revocation or expiry the same link is 404; every open is in the audit log; another account's token shows nothing.
- AC-3 Given an invited worker who signs in, when they log an incident, then the owner sees the row with the worker's code and the worker sees only their own rows; the worker cannot open any register list, document, export or account page (404 or redirect), proved by the integration suite and an e2e.
- AC-4 Given the report link, when a signed-out person submits the form, then a draft row exists, the owner's index says "1 report to confirm", confirming it makes it an ordinary row with the notification clock from the later of the occurred date and the aware date fixed at submission (`aware_at` equals the submission time), the owner receives one email at submission and then the nightly `report-to-confirm` reminder from twelve hours while the draft is unconfirmed (D-2231, accepted by the PO on 15 Oct 2026, retro review finding 19; this replaces the two-hour and twelve-hour reminders), no register reminder fires while it is a draft; the eleventh unconfirmed draft is refused.
- AC-5 Given a CSV exported from the incidents register, when it is imported into an empty account, then every row is back with an `imported` event, and a file with a name in a free-text field imports every other row and lists that one with its reason.
- AC-6 Given a hazard with a review date in 14 days, when the reminders job runs, then one `register-review` reminder for the hazard exists, and the audit-day page lists the hazard register with its state.
- AC-7 Given a self-check walk with two "no" answers, when it ends, then two improvement rows exist with `self-check` as the source and due dates 30 days out, the audit-day page shows the walk date and "2 open", and a second walk the same day is offered but not forced.
- AC-8 Every new screen passes axe and the keyboard walk on the three Playwright projects, shows no sideways scroll at 360 px, and the copy lint.

## Test expectations (unit, integration, e2e, manual)

Unit: the pack's manifest and cover sheet; token generation and hashing; the import's row validation and partial-write rule; the self-check's finding rule; the hazard's state. Integration (CI's Supabase job): SR-2 in full for the worker role, the report function and the auditor read path; the draft-row rules; the import's events. E2E (three projects): the audit pack download; the auditor link opened in a fresh context; the worker's home and the owner's view of a worker-logged incident; the report link end to end; one import; one self-check walk. Manual: the PO opens an auditor link on a phone.

## Evidence required on delivery

Per session: the migration; `npm run check`; the integration suite's run on CI; the e2e on the three projects with screenshots at 360 px and desktop of every new screen; the audit-log lines for each new action; the ASVS table rows for tokens and roles added to `product/security/asvs-l1-check-*.md`; anything UNVERIFIED.

## Questions for Dev to answer before building

1. Can the auditor link be served without a session on Vercel while keeping the CSP and the security headers, and does the pack need to be generated on request or stored?
2. Does the `worker` role need its own RLS policies on every register table, or a single `is_member` change with a role check?
3. Should the report link's form live under `/r/<token>` or `/report/<token>`, and how does it fit the proxy's matcher and the rate limiter?
4. Estimate per session.

## Dev response

Written with the draft, 14 Oct 2026, so the PO can accept or change the approach in one pass.

1. Served on request with the owner's data read through a `security definer` function keyed by the token hash, the pack built in memory as today's export does (it is already under a few megabytes for the sole-trader set), nothing stored; the page is dynamic like every other route, so the headers and the nonce CSP apply unchanged. If packs grow past the function's limit, store the last pack under the set's storage prefix and serve that.
2. A role check inside the existing policies is the smaller change but touches every policy; a separate `is_worker` function with narrow policies on `incidents` and `complaints` only (select own, insert own) keeps the owner's policies untouched and makes the "nothing else" rule a matter of absence. Recommended: the second.
3. `/report/<token>` (readable in a text message), with the proxy unchanged (it already runs on every route) and the in-memory limiter per address plus a database count per account, as the public questionnaire action and the exports do.
4. Three sessions as scoped, one each; Session B is the largest because of the role and its tests.

## Delivery evidence

**Session A (Dev, 15 Oct 2026)** on `req-020-audit-pack` ca89788, PR to `next` (body: `product/evidence/req-020/pr-body-session-a.md`).

- AC mapping: AC-1 → `e2e/signed-in/audit-pack.spec.ts` (the owner's download from the audit-day page, the file names in the zip, the sixth download in an hour refused, the `audit_pack.downloaded` lines) and `src/lib/registers/audit-pack.test.ts` (columns, dates, states, names, the cover sheet rendered and paginated); the summary PDF and the adopted documents join the zip when a ready set exists (the guided-path spec's account has one; this spec's account has none, so the pack holds the registers, the document control register and the cover sheet). AC-2 → the same e2e (a fresh signed-out context opens the link: banner, records table, codes only, no email, user id or account id in the HTML, `noindex`; the pack through the link; 404 after revocation; the four `auditor_link.*` lines) and `tests/integration/auditor-links-rls.test.ts` (RLS, the hash CHECK, the lookup function's answers and its grant). SR-1 → `src/lib/registers/auditor-link.test.ts` (token shape, hash, constant-time compare, liveness) and `e2e/admin.spec.ts` (an unknown token is a plain 404). SR-2 → the integration suite. SR-4 → the export limit shared by the pack and the link's pack (e2e), the audit lines (e2e). FR-3 → by construction and the copy: nothing names an auditor, nothing is sent.
- `npm run check`: green (121 files, 866 tests, 6 skipped); 12 new unit tests.
- CI: the pull request's run once it is opened (public job: the 404s; Supabase job: the integration suite and the signed-in e2e on three projects).
- Local public gate against a production build (desktop and Android): `admin` and `legal-pages` specs, 16 passed, 2 skipped.
- Screenshots: saved by the spec under `product/evidence/req-020/` when `EVIDENCE=1` (CI's Supabase job uploads them as `signed-in-screenshots`).
- ASVS: rows added to `product/security/asvs-l1-check-2026-10-14.md`.
- Accessibility: the page uses headings, one `DataTable` per register (the batch 36 component with its cards and focusable region) and the site's buttons; the signed-in accessibility pass does not cover the signed-out auditor page; a manual keyboard pass is owed with the PO's phone check.
- UNVERIFIED or deferred: none; D-2230 (renumbered from D-2214 on b6865f1; the PO holds D-2211 to D-2221) records the hybrid of the accepted design (the lookup is the `security definer` function; the register reads use the admin client scoped to the account it returned).

**Session B (Dev, 15 Oct 2026)** on `req-020-team` 526be30 (cut from `req-020-audit-pack`; PR to `next` after Session A's; body: `product/evidence/req-020/pr-body-session-b.md`).

- AC mapping: AC-3 → `e2e/signed-in/team.spec.ts` (invite from the account page, accept signed in, log an incident with the same form, the worker's own entries only, every owner page redirecting home and the exports refusing, the owner's "Logged by W-003", removal ending access, the audit lines) and `tests/integration/worker-rls.test.ts` (accept once by the invited address only, a worker's own rows and nothing else across eight tables, no update path, removal); AC-4 → the same e2e (a signed-out report, "1 report to confirm" on the index and the register, the confirmation screen with the aware sentence, "Notify by" after confirming, the link off is a 404) and the integration suite (the draft with `aware_at` at submission, `notification_status = 'draft'`, the eleventh refused with P0003, confirming sets `notify_by` from the aware date, rejecting keeps the row, the CHECK on the reason, a revoked link answers P0002) plus `tests/integration/reminders-job.test.ts` (a 13-hour-old draft raises `report-to-confirm` and nothing else; a one-hour-old one nothing) and `src/lib/registers/reminders.test.ts`; the PO's "aware_at equals the submission time" clause is the integration assertion within five seconds of the call; AC-8 → axe and width checks in the e2e on the team panel, the worker home, the report form and the confirmation screen on the three projects; the copy lint in the unit run.
- `npm run check`: green (123 files, 894 tests, 6 skipped); 25 new unit tests and the `report-to-confirm` reminder fixture.
- CI: the pull request's run once it is opened (Supabase job: the two integration suites and the signed-in e2e; the migration `20261015050000_worker_role_and_report_links.sql` has its first real run there, never against the hosted project).
- Local public gate (desktop Chromium, dev server): `home`, `not-found`, `req-015-a11y`, `subscription-story`, 7 passed.
- Screenshots: saved by the spec under `product/evidence/req-020/` when `EVIDENCE=1` (team-invited, worker-home, report-form, confirm-report per project).
- ASVS: seven rows under "REQ-020 Session B additions" in `product/security/asvs-l1-check-2026-10-14.md`.
- Accessibility: plain forms with labels, one button per action, the radio-free team panel; the signed-out report page and the worker home are in the e2e's axe pass; a manual keyboard pass on the confirmation screen is owed with the PO's phone check.
- Deviations (D-2231): the two-hour and twelve-hour nudges are one email at submission plus the nightly job's daily reminder from twelve hours after the report (no second schedule on the Hobby tier); a removed worker's session is not revoked server-side, the membership is re-read on every request so access ends on the next one. UNVERIFIED: none.


**Session C (Dev, 15 Oct 2026)** on `req-020-session-c` f7c4fb7 (cut from `next` 5866b4a, independent of Sessions A and B; PR to `next`; body: `product/evidence/req-020/pr-body-session-c.md`).

- AC mapping: AC-5 → `src/lib/registers/import.test.ts` (a file in our column names imports every row with each cell mapped; a name in a free-text field fails that row with its reason and the others pass; an NDIS number fails; a wrong-column file is refused whole; more than half failing is refused; the limits) and `e2e/signed-in/records.spec.ts` (the template route, the preview with "2 of 3 rows pass", the named row listed with its reason, the commit, the two `imported` lines, the audit line "2/3", the row page's "Imported from a spreadsheet", the undo removing both rows, a wrong-column file refused) and `tests/integration/req-020-session-c-rls.test.ts` (the `imported` kind accepted and an unknown kind refused, the import row read by its tenant alone, undone by the owner, never deleted); AC-6 → `tests/integration/reminders-job.test.ts` (a hazard with a review date in 14 days raises one `register-review` reminder with `subject_table = 'hazards'`; 12 rows) and the e2e (the hazard from the incident's offer, the list with "Could harm a participant", the audit-day line `ask-hazards` filled with "1 entry; all current." and its tap) and `audit-day-ask.test.ts` (missing, filled, overdue); AC-7 → `src/lib/registers/self-check.test.ts` (two "no" answers make two rows with the self-check source, the note kept, due 30 days out; the offer's three states; the closing line) and the e2e (thirteen screens with live states, two "no" with a note, "2 findings are in your improvement register, due in 30 days", two rows due in 30 days, the audit line "2", the audit-day line "Last checked <today>, 2 findings still open." with "Check my systems again" offered, the improvement register naming the source) and the integration suite (a self-check row inserted with its answers, never updated, read by its tenant alone; a named walker refused; the improvement row with the `self-check` source reads open); AC-8 → axe and width checks in the e2e on the hazard form, the hazard list, the import page, the preview and the self-check on the three projects; the copy lint and the path-screens rule in the unit run.
- `npm run check`: green (122 files, 878 tests, 6 skipped); 23 new unit tests.
- CI: the pull request's run once it is opened (Supabase job: the integration suites and the signed-in e2e; the migration `20261015060000_hazards_imports_self_checks.sql` has its first real run there, never against the hosted project).
- Local public gate (desktop Chromium, dev server): `home`, `req-015-a11y`, `security-headers`, 9 passed.
- Screenshots: saved by the spec under `product/evidence/req-020/` when `EVIDENCE=1` (hazard-form, hazards, import-preview, self-check, self-check-done, improvements-self-check per project).
- ASVS: six rows under "REQ-020 Session C additions" in `product/security/asvs-l1-check-2026-10-14.md`.
- Audit-log lines: `register.<table>.imported` ("<import id> imported/total"), `register.<table>.import-undone` ("<import id> removed"), `self_check.completed` ("<walk id> findings").
- Deviations (D-2236): the pack's "items to prepare" keeps twelve records while the audit-day list has thirteen (the PO's call); FR-9's "usual reminders" on the findings are not sent because no reminder kind exists for an improvement's due date; the self-check questions are a Dev draft; `walked_by_ref` is "owner" until a worker can reach the walk. UNVERIFIED: none.

## PO review

Awaiting the PO: this file is a Dev draft under the standing backlog's rule for item 7 ("if it is not there, write the REQ draft from the research file and STOP for the PO").


## PO review (14 Oct 2026, PO, acting as NDIS domain expert, security reviewer and QA lead)

The draft stands. The four Dev answers are accepted: the pack built on request and nothing stored; a separate `is_worker` function with narrow policies on `incidents` and `complaints` only; `/report/<token>`; three sessions in the order A, B, C. Priority stays `should`; status is `ready`. Three edits and three additions, all binding.

Edits.

- FR-2: the auditor page shows the registers and the document control register only; it never shows the audit log, the reminders, the account page or any email. Expiry stays 24, 48 or 72 hours with 72 the default. One live link at a time, as drafted.
- FR-5: the notification clock. Under the NDIS (Incident Management and Reportable Incidents) Rules 2018 the 24-hour and five-business-day periods run from when the provider becomes aware of the incident, and a worker is part of the provider. So a report submitted through the link or logged by a worker fixes `aware_at` at the moment of submission, not at confirmation; the owner's confirmation screen shows "Reported <time>; if this is a reportable incident the Commission must be told by <aware_at + 24 h>" using the existing fixed text, and the reportable-incident reminder (REQ-018 FR-10) is created from `aware_at` on confirmation. Drafts are still excluded from totals, but the draft itself raises a reminder to the owner: "1 report to confirm" by email two hours after submission and again at twelve hours, so a draft can never quietly eat the 24 hours. *(As built under D-2231 and accepted by the PO on 15 Oct 2026: one email at submission, then the nightly reminder from twelve hours; no second schedule on the Hobby tier.)*
- FR-5: the report form carries, above the fields, the fixed line "If someone is in danger now, call 000 first." and the general-information line; the "who are you" field accepts a worker code or one of a short list of name-free roles and nothing else (no free text), which closes the name-shaped-value rule in SR-3 by construction.

Additions.

- FR-10 Pack contents sheet for the auditor. The cover sheet (FR-1) lists each register with its row count, its last entry date and its state from the audit-day list (present, incomplete, missing), so the auditor can see at a glance what is alive; the same table is the first thing on the auditor page (FR-2). No scores, no "ready" word, no promise about the outcome.
- FR-11 Worker sign-in copy. The worker home says, in one line, what the worker can and cannot see ("You can log incidents and complaints and see what you logged. Your manager sees everything else."); the owner's invite screen says the same before sending. Removal of a worker revokes their session on the next request.
- FR-12 Import safety. The preview (FR-8) refuses the whole file when more than half of its rows fail, with the plain message "Most rows did not pass; check the column names against the template", so a wrong-column spreadsheet never imports a handful of garbage rows; and an import can be undone within one hour by the owner (every row of that import deleted, one audit-log line), after which the rows are ordinary.

Acceptance: AC-4 gains "the owner receives the two-hour and twelve-hour reminders while the draft is unconfirmed, and `aware_at` equals the submission time" *(reworded on 15 Oct 2026 under D-2231: one email at submission plus the nightly reminder from twelve hours; retro review finding 19)*; AC-5 gains "a file whose column names do not match is refused whole"; AC-1 gains the cover sheet table. Everything else as drafted. Evidence as drafted plus the ASVS rows and a screenshot of the auditor page on a phone.

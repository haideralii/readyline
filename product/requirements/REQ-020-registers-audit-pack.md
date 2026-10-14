# REQ-020: Registers for the audit day and for the team: the audit pack, worker logging, self-checks, hazards and import

Status: draft (written by Dev on 14 Oct 2026 from `product/research/registers-competitors.md` gaps 1 to 5, as the standing backlog's rule for item 7 says; the PO edits, sets the status and the priorities, and nothing is built until the status is `ready`)
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
- FR-2 Auditor link. The owner can create one read-only link at a time: a random token of at least 128 bits, a stated expiry chosen from 24, 48 or 72 hours (72 the default), revocable at any time from the account page, shown with its expiry and the time it was last opened. The link opens a signed-out page that serves the same audit pack (zip) and a read-only view of the document control register and each register's list, with every participant reference shown as its code only (codes are never resolved anywhere, so this is the existing display). Every open writes an audit-log line (`auditor_link.opened`, with the link id, never the viewer's address in clear; the address hashed as for emails). Creating, revoking and expiring write their own lines. The page carries a plain banner: "Read-only view shared by <trading name> for its audit; it expires on <date>."
- FR-3 Nothing in FR-2 names, lists or recommends auditors, carries a fee or a referral, or is sent to anyone by Readyline; the provider copies the link and sends it themselves (`CLAUDE.md` 4.4, D-109).

Session B, the team

- FR-4 Worker role. `memberships.role` gains `worker` (REQ-004 FR-3 modelled it). The owner invites a worker by email from the account page (the same magic-link sign-in; a pending invitation row with an expiry of 7 days, revocable); the worker sees a worker home with two actions, "Log an incident" and "Log a complaint", and the list of their own entries (rows where `created_by` is their user), nothing else: no other registers, no documents, no account settings, no export. A worker's entry is a normal row (same forms, same participant-data warning and codes) marked `logged_by_ref` with the worker's code so the owner sees who logged it. The owner can remove a worker; their rows stay.
- FR-5 Report link. Each account can turn on one "report an incident" link (a token as in FR-2, no expiry, revocable, regenerable) that opens a signed-out form with the incident form's fields minus the Commission-notification fields, the participant-data warning on every free-text field, and a one-line "who are you" (a worker code or a name-free role such as "casual worker"). Submitting creates an incident row with `status = 'draft'` and `reported_via = 'link'`; the owner sees "1 report to confirm" on the registers index and the audit-day page, opens it, completes the notification fields and confirms it (which turns it into an ordinary row and starts the notification clock from the occurred date the reporter gave) or rejects it with a reason (kept, append-only, as a rejected report). Draft rows are not counted in the register's totals, overdue counts or reminders until confirmed. The link's form is rate-limited per address (10 an hour) and per account (50 a day), and refuses more than 10 unconfirmed drafts per account.
- FR-6 The owner's "Try again" and "Continue" style of one-tap actions apply: confirming a report is one screen, one button (REQ-017 FR-5).

Session C, the records

- FR-7 Hazard and WHS register. One row per hazard: where (a code for a site or vehicle, never an address), what the hazard is, who it could harm (participant, worker, visitor), how likely and how serious (the corporate risk register's two scales), what we did, by when, done on, and a review date; linked from the incident form ("Was a hazard behind this? Add it to the hazard register") and from the corporate risk register's emergency and WHS areas. Reminders: review date 14 days before and on the day (REQ-018 FR-10's register-review kind). Appears on the audit-day page's list of records with a live state.
- FR-8 CSV import. On each of the incidents, complaints, worker checks and corporate risks registers, "Import from a spreadsheet" takes a CSV whose header row uses exactly our export's column names (a downloadable empty template per register), shows a preview with every row's validation result (the same zod schemas and the participant-data detector as the forms; an NDIS-number or a name in a field fails that row), and imports only the rows that pass, writing one `register_events` line per row with `kind = 'imported'` and one audit-log line per import with the counts. Rows that fail are listed with the row number and the reason; nothing is partially written within a row. Limits: 500 rows per file, 1 MB, five imports an hour per account.
- FR-9 Quarterly self-check. A guided walk, "Check my systems", offered on the audit-day page every three months (and on demand): one screen per record in the audit-day list showing its live state and one question in plain words ("Is every incident this quarter in the register, with what you did next?"), answered yes or no with an optional note. Every "no" writes an improvement register row with the source `self-check`, a due date 30 days out and the usual reminders; the walk ends with the count of findings and the next date. Each walk is a row in a `self_checks` table (date, who, findings count), and the audit-day page shows the last walk's date and its open findings.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 Tokens (FR-2, FR-5) are random, stored hashed (SHA-256), compared in constant time, scoped to one account, and never appear in logs; a revoked or expired token answers 404, never "expired" (no probing). Signed-out pages behind a token carry `noindex`, the security headers, and no account id, email or user id in the HTML.
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
- AC-4 Given the report link, when a signed-out person submits the form, then a draft row exists, the owner's index says "1 report to confirm", confirming it makes it an ordinary row with the notification clock from the occurred date, and no reminder fires while it is a draft; the eleventh unconfirmed draft is refused.
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

Not started.

## PO review

Awaiting the PO: this file is a Dev draft under the standing backlog's rule for item 7 ("if it is not there, write the REQ draft from the research file and STOP for the PO").

# REQ-023: Renewal and mid-term audit readiness: the registration timeline, "since the last audit", the renewal path, and the changes register

Status: draft, second version (PO, 15 Oct 2026 21:40; rewritten after the independent review of 15 Oct, `product/qa/req-reviews/2026-10-15-req-022-023-024.md`, findings 1 to 19; the renewal order and window were read on the Commission's pages on 15 Oct 2026 and are no longer VERIFY; goes back to the reviewer before "ready" as D-2215 requires; Session A can be built once the re-review says ready; Sessions B to D wait for REQ-020 to merge)
Phase: 6 Priority: should Owner: Dev

## Why (user and business outcome)

The subscription's promise is "audit-ready at renewal". Today the product knows a registration date and sends a handful of reminders from it, but it has no timeline a provider can read, no way to show an auditor "the period since the last audit", and no record of what was told to the Commission. A registered provider lives on a clock: a mid-term audit for certification providers that must start by month 18, a renewal window that opens six months before expiry, and an expiry that ends the registration if the application is not in. This REQ gives the account a timeline it can act on, filters the registers and the audit pack by period, turns the quarterly self-check into a rehearsal, and keeps the one register nobody keeps: the changes told to the Commission. It is the second half of what AUD 39 a month buys.

## Scope (in / out)

In, as four sessions:

- Session A, the registration timeline: dates the provider enters once, the dates the product derives, and the reminders that come from them (replacing the ones `reminders.ts` sends today).
- Session B, "since the last audit": a period filter on the registers, the exports and the audit pack, and a "what changed" summary. After REQ-020.
- Session C, the renewal path: a guided page for the six months before expiry, with the quarterly self-check as its rehearsal. After REQ-020.
- Session D, the changes register: what was notified to the Commission and when, and what was applied for as a variation. After REQ-020.

Out: anything that applies for renewal on the provider's behalf or talks to the Commission's portal; auditor selection or booking (CLAUDE.md 4.4); a second subscription tier; worker onboarding (REQ-024); showing which documents a changed answer set would change (a document diff; a changed answer set is a new pack); the annual declaration (UNVERIFIED as an obligation with a date; it goes on the timeline when the primer records a source).

## Domain rules that apply (link to product/domain)

`CLAUDE.md` 4.2 (no urgency: a date is a fact, never a countdown in red), 4.4 (no referral role), 4.5 (no participant data; nothing in this REQ asks for any). REQ-009 (append-only registers, plain words; `accounts.registration_date` and `registration_kind`), REQ-017 (one screen, one action), REQ-018 (review cycles, audit-day list, the reminders job and its settings), REQ-020 (audit pack, auditor link, self-check, import).

- R-1 Registration is granted for the period the certificate states; three years is usual. Source: the certificate; the primer. The expiry is entered from the certificate, never assumed.
- R-2 A certification provider's mid-term audit must start no later than 18 months into the registration period. Source: `product/domain/ndis-registration-primer.md` line 20 (Rules F2026C00527 s 13B, read 13 Oct 2026); the code agrees (`MID_TERM_DUE_MONTHS = 18`, `src/lib/registers/reminders.ts`). Verification providers have no mid-term audit.
- R-3 Renewal order, read on ndiscommission.gov.au on 15 Oct 2026 ("Renew your registration"; "Apply for registration"; the portal guide P19): the provider can start the renewal any time in the six months before the expiry date, and the portal shows the date to start by; the application is submitted in the portal first; the Commission then emails the scope of audit; the provider engages an approved quality auditor and the audit happens; the Commission reviews and decides; a certificate follows. If the application is in before expiry, "your current registration will remain valid until we make a decision on your application". If the provider starts after the expiry date, the registration has lapsed and a new application is needed. The audit is therefore after the application, not before it.
- R-4 Notifications to the Commission under s 13 and s 13A of the Rules carry no day count: the timing is "as soon as practicable" or "the earlier of" (`data/watch-changes.json` line 159), which the primer reads as "at the latest when they happen". The s 13 list is contact details, the area, locations, and participant and worker numbers (`watch-changes.json` line 158). A change of registration groups, or of the supports registered, is a variation of registration: an application, not a notification. Notifications are made in the approved form (the portal), not by phone.
- R-5 An auditor at renewal samples documents and registers across the registration period, with weight on the period since the last audit (the webinar research of 14 Oct; practice, not a rule). The audit pack therefore shows the whole period by default and the since-last-audit view as a summary.

## Functional requirements (numbered FR-1 ...)

Session A, the registration timeline

- FR-1 One row per registration period in `registration_periods` (Data): granted on (from `accounts.registration_date` for the first row), expires on (from the certificate; the form pre-fills granted plus three years with the line "From your certificate. Three years is usual; check the date on it."), the audit type (verification or certification, from the questionnaire result, editable), the date of the last audit (optional; empty means "not yet audited in this period", and the period filter then equals "this registration period", which the UI says), and the mid-term audit date (optional). The current period is the row with the latest granted date. Every change is one `audit_log` line with the old and new values. The account page shows the current period under "Your registration".
- FR-2 Dates the product derives, one table "Your registration timeline" on the account page and the audit-day page, in order: "Prepare for your mid-term audit from" (granted plus 12 months; certification only), "Your mid-term audit must start by" (granted plus 18 months; certification only; R-2), "Your renewal window opens" (expiry minus 6 months; R-3), "Apply for renewal by" (expiry minus 3 months; a PO practice default so the audit fits before expiry, held as one constant with a comment), "Your registration expires" (expiry), and one position sentence ("You are 7 months in. Prepare for your mid-term audit from 1 March 2027; it must start by 1 September 2027."). A done mid-term audit (FR-1) replaces the two mid-term lines with "Mid-term audit done on <date>". No colour for "soon", no countdown, no exclamation marks (4.2).
- FR-3 Reminders from the timeline replace the ones `reminders.ts` sends today (`mid-term-audit` at 12, 15 and 17 months; `renewal` at 6 and 3 months before expiry). The new kinds, each once per period, each through the reminders job and the account's settings and `do_not_send` (REQ-022): `midterm-prepare` (granted plus 12 months), `midterm-start-by` (28 days before granted plus 18 months), `renewal-window` (expiry minus 6 months), `renewal-apply-by` (28 days before expiry minus 3 months), `renewal-last-call` (expiry minus 14 days, sent only if no application date is recorded in FR-7; the text says the registration lapses if the application is not in by the expiry date, in plain words, no red). Each carries the plain-words line of what to do and the link to the renewal path (FR-7), nothing else (SR-4). Editing a date in FR-1 deletes that period's unsent reminder rows and the job re-derives them. A sent reminder is one `audit_log` line.
- FR-4 The checklist (REQ-006) gains dated items under the audit group when a period exists: "Mid-term audit started" (certification only, with the must-start-by date), "Renewal application submitted", "Renewal audit done"; the provider ticks each with a date; the audit-day page's audit group shows them with their asks.

Session B, "since the last audit"

- FR-5 A period selector, one query parameter parsed by one helper and passed to the existing queries: "All", "This registration period" (from the current period's granted date), "Since the last audit" (from FR-1's last-audit date; hidden when it is empty), and a custom range of two ISO dates, `from` not after `to`, at most ten years apart, any dates (a renewed provider's previous period is allowed). It appears on the register index pages, the CSV exports, the audit pack cover sheet and the auditor link's page. The audit pack defaults to "This registration period" (R-5); the audit-day page defaults to the same. Exports name the period in the file name and the cover sheet. Never stored.
- FR-6 "What changed since the last audit", one screen reached from the audit-day page and in the audit pack as `since-last-audit.csv`: counts per register for the period (entries, open, overdue, notified), documents reviewed and adopted in the period with their dates (from the document control register), documents due for review before the expiry date, workers whose checks were added, renewed or expired in the period (counts and codes, never names), and the changes notified and variations applied for (FR-10). Every line links to the register with the period set. When there is no last-audit date the screen is titled "This registration period" and says why.

Session C, the renewal path

- FR-7 `/path/renewal`, in the guided-path pattern (REQ-017): one screen per step, the step's state from live data, one action. Steps, in the Commission's order (R-3): confirm your dates (FR-1); read "what changed" (FR-6); review every document due before expiry (REQ-018's review list with "due" and "done"); run "Check my systems" as a rehearsal (FR-8); update your answers if your supports or workers changed (a link to the questionnaire with the current answers loaded; nothing more); apply for renewal in the Commission's portal (a date field "application submitted on"; the line "The Commission emails your scope of audit after you apply."); scope of audit received (date); book your audit (a date and the auditor as a code; no list, no fee, 4.4); audit day (link to the audit-day page); decision received (date). The page is reachable from the account page from the renewal window and from the audit-day page at any time.
- FR-8 The rehearsal: "Check my systems" (REQ-020 FR-9) gains a "renewal rehearsal" mode that walks every record with the period set, asks the same questions, and ends with one dated sheet of what is missing; the sheet goes into the audit pack as `rehearsal-<date>.csv` (the pack's existing format; no PDF path, D-2207).
- FR-9 Verification providers see the renewal path without the mid-term lines and items; nothing on their pages says "mid-term".

Session D, the changes register

- FR-10 A register "Changes we told the Commission", append-only like the others (REQ-009): the entry kind, `notification` or `variation`; the change type from a fixed list per kind (notifications: the s 13 list in R-4 and the s 13A events from the batch 45 table; variations: registration groups, supports, a new or removed key personnel role when the Rules treat it so, VERIFY against the batch 45 table); the date it happened; for a notification, the date it was notified and the channel (`portal`, `email`, `other`); for a variation, the date applied and the date decided; the Commission's reference if any (free text, the clearance-number CHECK, SR-1); a note (capped). A notification's `notify_by` equals the date it happened (R-4); its state is `open` until a notified date exists and `overdue` when there is none and the happened date is before today; a variation's state is `to apply`, `applied`, `decided`. The register appears in the audit-day list, the audit pack, the auditor link, the CSV export and the import (REQ-020 FR-8 and FR-12).
- FR-11 Prompts, not nags: when a questionnaire answer changes a thing in R-4's lists, the result page says in one line which kind it is: "This is a change you tell the Commission about; record it in your changes register" or "This changes your registration; you apply to vary it, then record it here", with the link. No automatic rows.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 No new personal data: dates, codes, counts and capped notes only. The reference field carries the clearance-number CHECK (`^[A-Za-z0-9 /-]*$`, at most 40 characters) and the `looks_like_ndis_number` refusal (the 43xxxxxxx shape); these catch numbers, not names, so the note field's helper says "no names" and the import's refusal rule (REQ-020 FR-12) applies to both fields. The worker lines in FR-6 are codes and counts.
- SR-2 Tenant isolation as every register: RLS on both new tables, the status view pattern from batch 45, explicit grants only (D-052), integration tests in the Supabase job for the policies and the views.
- SR-3 The auditor link (REQ-020 FR-2) shows the period-filtered registers and FR-6's summary and nothing else new; the period parameter is a closed list or two ISO dates validated as in FR-5 and never reaches a query unparsed; an invalid value answers 400 with no echo.
- SR-4 Reminders carry the timeline dates and the link only; no document names, no register contents.
- SR-5 A worker session (REQ-020 FR-4) gets 404 on every page in this REQ.

## Data (entities, fields, retention)

- `registration_periods`: `id`, `account_id`, `granted_on`, `expires_on`, `audit_type` (`verification` | `certification`), `last_audit_on null`, `midterm_audit_on null`, `created_at`, `updated_at`; one row per period; a unique index on (`account_id`, `granted_on`); RLS and grants as D-052. The first row is created from `accounts.registration_date` and `registration_kind` when the account page is first opened after the migration, by the server, never by a client. The reminders job reads the current period.
- `reminders.kind`: the CHECK in `20261014200000_audit_day_reminders.sql` gains the five FR-3 kinds; the two old kinds stay in the CHECK for the rows already sent and are no longer produced.
- `commission_changes` (FR-10): `id`, `account_id`, `kind` (`notification` | `variation`), `change_type` (closed list per kind), `happened_on`, `notified_on null`, `channel null` (closed list), `applied_on null`, `decided_on null`, `reference text` (the CHECK in SR-1), `note text` (capped), `created_at`, `created_by`; append-only with an events trail like incidents; a status view with `notify_by` and `state`.
- Retention: the registers' 7-year rule from batch 45 item 18.

## Acceptance criteria (Given/When/Then, numbered AC-1 ...)

- AC-1 Given a certification provider granted on 1 March 2026 with the pre-filled expiry and a fixed clock of 15 October 2026, when they open the account page, then the timeline reads: prepare from 1 March 2027; must start by 1 September 2027; renewal window opens 1 September 2028; apply by 1 December 2028; expires 1 March 2029; and the sentence "You are 7 months in. Prepare for your mid-term audit from 1 March 2027; it must start by 1 September 2027." A verification provider with the same dates sees no mid-term rows and the sentence "You are 7 months in. Your renewal window opens 1 September 2028."
- AC-2 Given a reminder setting on and the clock at or after each FR-3 date, when the reminders job runs, then one email goes out for that kind with the plain-words line and the link, once per period, and an `audit_log` row exists; with `do_not_send` set, nothing goes out and the row says so; after the expiry is edited, the unsent rows for the old dates are gone and the new dates produce rows.
- AC-3 Given incidents on either side of the last-audit date, when "Since the last audit" is selected on the incidents register, its CSV export and the audit pack, then only the later rows appear, the file name carries the period, and the cover sheet states it; the pack with no selection shows the whole registration period.
- AC-4 Given three documents reviewed in the period and one due before expiry, when "What changed since the last audit" opens, then the three are listed with dates, the one is listed as due, and `since-last-audit.csv` in the pack matches the screen.
- AC-5 Given the certification fixture at the renewal window with dates confirmed, two documents due, no rehearsal run and no application date, when `/path/renewal` renders, then the steps read: confirm your dates, done; what changed, to read; review documents, 2 due; rehearsal, not yet; update your answers, optional; apply for renewal, not yet; scope received, not yet; book your audit, not yet; audit day, not yet; decision, not yet; and the rehearsal, once run, writes the dated sheet into the next pack.
- AC-6 Given a change of registration groups in the questionnaire, when the result page renders, then the "apply to vary" line with the link appears; and given a notification entry with a happened date of yesterday and no notified date, when the register renders, then its state is overdue and its notify-by equals the happened date; with a notified date entered, its state is notified.
- AC-7 Given FR-4's items with a period recorded, when the checklist renders, then the three items appear under the audit group with their dates, and ticking one with a date writes it.
- AC-8 Given a worker session, when the worker opens any page in this REQ, then 404.
- AC-9 Given the period parameter set to a range of eleven years, or `from` after `to`, or a non-date, when any filtered page or the auditor link loads, then 400 and nothing echoed.

## Test expectations (unit, integration, e2e, manual)

Unit: the timeline derivation with a fixed clock (every FR-2 date from fixtures, leap years, a done mid-term audit, an edited expiry, verification); the reminder derivation and the delete-on-edit rule; the period helper (closed list, ranges, the three invalid cases); the "what changed" summary; the notification and variation states. Integration (Supabase job): RLS and the status views for both tables; the reminders job writing one row per kind per period. E2E (three projects): the account page timeline (AC-1); one register with the period selector and the pack (AC-3); `/path/renewal` as the certification fixture (AC-5); the worker 404. Manual: none.

## Evidence required on delivery

Per session: `npm run check`; the CI run; screenshots of the timeline table, "what changed", and `/path/renewal` at 360 px and desktop; the watch file entry with the 15 Oct read of the three Commission pages in R-3; the ASVS rows for the new tables and the period parameter; anything UNVERIFIED.

## PO decisions

- D-2301 Dates are facts, not pressure. The timeline is a table in the product's voice; no colour for "soon", no countdown in the header, no email more often than FR-3 lists.
- D-2302 The only PO practice defaults are "apply by" (expiry minus 3 months) and the 28-day and 14-day lead times in FR-3; the 18-month and 6-month figures are the Rules' and the Commission's; each default is one constant with a comment.
- D-2303 No auditor list, booking, or fee, ever; the "book your audit" step is a date and a code.
- D-2304 Order: Session A after the re-review says ready; B, C and D after REQ-020 is on `main`, B and D in parallel if two sessions can run, then C.
- D-2305 The audit pack shows the whole registration period by default; "since the last audit" is a summary and a filter, never the pack's default (review finding 7).
- D-2306 The changes register separates notifications from variations; notify-by is the day it happened; no derived day counts (review findings 10 and 11).

## Questions for Dev to answer before building

1. The first `registration_periods` row: created lazily by the server on the account page as the Data section says, or by the migration from every account with a `registration_date`? Prefer the migration if it is one statement.
2. The period helper: confirm one helper can serve the register queries, the exports and the pack without per-register changes.
3. Estimate per session.

## Dev response

The first version's answers (15 Oct, ab3e936): `accounts.registration_date` and `registration_kind` exist from REQ-009; a `registration_periods` table is needed for the history. Carried into this version. Awaiting the rest.

## Review

First review 15 Oct 2026 (independent reviewer): Not ready; findings 1 to 19 in `product/qa/req-reviews/2026-10-15-req-022-023-024.md`. This version answers them: 1 and 2 (fixed clock and per-step states in AC-1 and AC-5), 3 (AC-7, AC-9, FR-11 and FR-9 covered by AC-6 and AC-5), 4 (R-2, FR-2), 5 (FR-3 and Data), 6 (R-1, Data), 7 (D-2305), 8 (D-2304), 9 (R-3 read on 15 Oct, FR-2, FR-7), 10 and 11 (D-2306, FR-10, FR-11), 12 (channel list), 13 (SR-1), 14 (FR-5), 15 (FR-7 and Scope), 16 (FR-5 on index pages only; AC-3 one register), 17 (Scope, out until sourced), 18 (AC-2 "at or after"), 19 (FR-1). Awaiting the re-review.

## Delivery evidence

Not started.

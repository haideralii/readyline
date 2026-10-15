# REQ-023: Renewal and mid-term audit readiness: the registration timeline, "since the last audit", the renewal path, and the changes register

Status: ready (PO, 15 Oct 2026; written from REQ-009, REQ-017, REQ-018, REQ-020 and the Commission's registration pages as the PO knows them; every dated rule below that is not already in `product/domain` is marked VERIFY and the Dev checks it against ndiscommission.gov.au with a read date before building, official text wins; questions for Dev at the end, answer in the Dev response and start Session A without waiting)
Phase: 6 Priority: should Owner: Dev

## Why (user and business outcome)

The subscription's promise is "audit-ready at renewal", and today the product keeps the registers but has no idea of time: it knows a registration date and shows one countdown sentence (batch 45 item 8). A registered provider lives on a three-year clock with a mid-term audit in the middle for certification providers, a renewal audit before expiry, and an expiry that ends their registration if the application is late. Every consultant's renewal checklist is the same list of dates and the same three questions: what changed since the last audit, is every document reviewed, does every register show the period. This REQ gives the account a timeline it can act on, filters every register and export to "since the last audit", turns the quarterly self-check into a rehearsal, and keeps the one register nobody keeps: the changes told to the Commission. It is the second half of what AUD 39 a month buys, and it is what makes a customer keep paying after the pack is downloaded.

## Scope (in / out)

In, as four sessions:

- Session A, the registration timeline: dates the provider enters once, the dates the product derives, and the reminders that come from them.
- Session B, "since the last audit": a period filter on every register, the exports and the audit pack, and a "what changed" summary.
- Session C, the renewal path: a guided page like the audit-day page for the six months before expiry, with the quarterly self-check as its rehearsal.
- Session D, the changes register: the record of what was notified to the Commission and when, with the s 13 and s 13A list from batch 45 item 23.

Out: anything that applies for renewal on the provider's behalf or talks to the Commission's portal; auditor selection or booking (CLAUDE.md 4.4); a second subscription tier; worker onboarding (REQ-024); the self-assessment document's regeneration from new answers (REQ-005 living policies cover a document's review; a changed answer set is a new pack).

## Domain rules that apply (link to product/domain)

`CLAUDE.md` 4.2 (no urgency: a date is a fact, never a countdown in red), 4.4 (no referral role), 4.5 (no participant data; nothing in this REQ asks for any). REQ-009 (append-only registers, plain words), REQ-017 (the guided path's one-screen-one-action pattern), REQ-018 (review cycles, audit-day list, living policies), REQ-020 (audit pack, auditor link, self-check). The rules the timeline rests on, each one VERIFY against the Commission page named, with the read date recorded in `product/research/ndis-watch/<date>.md`:

- R-1 Registration is granted for a period the certificate states; three years is the usual period. VERIFY: the Commission's "Renewing your registration" page.
- R-2 Certification providers have a mid-term audit during the registration period; verification providers do not. The mid-term audit is scheduled by the approved quality auditor around the middle of the period (about 18 months in). VERIFY: the Commission's "Mid-term audits" or "Types of audit" page; the audit-day page already states "Mid-term audit: Does not apply" for verification.
- R-3 A provider must apply for renewal before the registration expires; the renewal application needs a completed audit, so the audit must be booked and finished before the expiry date. The Commission advises starting the renewal early; six months before expiry is the common guidance. VERIFY: "Renewing your registration" for the exact advice and whether a late application can be accepted.
- R-4 If the registration expires without a renewal application the provider is no longer registered and must apply as a new provider. VERIFY: the same page.
- R-5 The s 13 changes (registration groups, key personnel, contact details, the business's legal status) and the s 13A events must be notified to the Commission within the time the Rules set (the batch 45 table in the governance policy already lists them with timing from the Rules). Source: NDIS (Provider Registration and Practice Standards) Rules 2018 as read for batch 45.
- R-6 Documents are reviewed on the cycles REQ-018 holds (`reviewCyclesFor`); an auditor at renewal samples documents and registers across the registration period, with weight on the period since the last audit (the webinar research of 14 Oct; practice, not a rule).

## Functional requirements (numbered FR-1 ...)

Session A, the registration timeline

- FR-1 Dates the provider enters, on the account page under "Your registration": the date registration was granted (exists), the expiry date on the certificate (new; defaults to granted plus three years with the sentence "from your certificate; three years is usual, check the date on it"), the date of the last audit (new; defaults to the granted date for a first registration), the audit type of the last audit (verification or certification, from the questionnaire result, editable), and whether a mid-term audit has already happened (date, optional). Every field is editable; every change is one `audit_log` line with the old and new dates.
- FR-2 Dates the product derives, shown as one table "Your registration timeline" on the account page and the audit-day page: the mid-term audit window (certification only: from 15 to 21 months after the granted date, with "your auditor sets the date inside this window; ask them when" in plain words), renewal start (expiry minus 6 months), "book your renewal audit by" (expiry minus 4 months), "audit done by" (expiry minus 6 weeks), the expiry itself, and today's position as one sentence ("You are 14 months in; your mid-term window opens in 1 month."). The numbers 6, 4 and 6 weeks are PO defaults from practice (R-3), held in one constants file with a comment, so a VERIFY finding changes one line. No red, no countdown, no exclamation marks (4.2).
- FR-3 Reminders from the timeline, through the existing reminders job and settings (REQ-018 FR-10): the mid-term window opening; renewal start; "book by"; "audit done by" minus 4 weeks; expiry minus 2 weeks ("if the application is not in, this is the last reminder"); each once, each honouring the account's reminder settings and `do_not_send`, each with the plain-words line of what to do and the link to the renewal path (FR-7). A reminder is one `audit_log` line.
- FR-4 The checklist (REQ-006) gains three dated items under the audit group when a registration is recorded: "Mid-term audit (certification)" with its window, "Renewal audit booked", "Renewal application submitted"; the provider ticks them with a date; the audit-day page's "Then they talk about the audit itself" group shows them with their asks.

Session B, "since the last audit"

- FR-5 A period selector on every register index and detail list, the CSV exports, the audit pack cover sheet and the auditor link's page: "All", "Since the last audit" (from FR-1's last-audit date), "This registration period" (from the granted date), and a custom range. The default on the audit-day page and in the audit pack is "Since the last audit". The selector is a query parameter, never stored data; exports name the period in the file name and the cover sheet.
- FR-6 "What changed since the last audit", one screen reached from the audit-day page and included in the audit pack as `since-last-audit.csv`: counts per register for the period (entries, open, overdue, notified), documents reviewed and adopted in the period with their dates (from the document control register), documents due for review before the next audit, workers whose checks were added, renewed or expired in the period (counts and codes, never names), and the changes notified (FR-10). Every line links to the register filtered to the period.

Session C, the renewal path

- FR-7 `/path/renewal`, in the guided-path pattern (REQ-017): one screen per step, the step's state from live data, one action. Steps, in order: confirm your dates (FR-1); read "what changed" (FR-6); review every document due before expiry (the living-policies review from REQ-018, listed with "due" and "done"); run "Check my systems" as a rehearsal (REQ-020 FR-9, with the period set to since-the-last-audit); update your answers if your supports or workers changed (links to the questionnaire with the current answers loaded; a changed answer set shows which documents it would change, and the provider decides); the self-assessment (the document from the pack, with the line that the Commission's own self-assessment is completed in its portal at renewal, VERIFY); book the audit (a date field and "who" as a code, no auditor list, no fee, 4.4); audit day (links to the audit-day page); application submitted (date). The page is reachable from the account page from renewal start and from the audit-day page at any time.
- FR-8 The rehearsal: "Check my systems" (REQ-020 FR-9) gains a "renewal rehearsal" mode that walks every record with the period set, asks the same questions, and ends with one printable sheet of what is missing, the same sheet an auditor's pre-audit review would send; the sheet is dated and goes into the audit pack as `rehearsal-<date>.pdf` or CSV (the Dev chooses the format the pack already uses).
- FR-9 Verification providers see the renewal path without the mid-term step and with the sentence from the audit-day page; nothing on the page says "mid-term" to them.

Session D, the changes register

- FR-10 A register "Changes we told the Commission", append-only like the others (REQ-009): the change type from a fixed list (the s 13 changes and s 13A events, the batch 45 table, as codes with plain-words labels), the date the change happened, the date it was notified, how (portal, email, phone; a code), the reference the Commission gave if any (free text, capped, never a participant shape), and a note. The notify-by date is derived from the Rules' timing for that type and shown as "notify by" with the same open/overdue states the incident register uses; the register appears in the audit-day list, the audit pack, the auditor link, the CSV export and import (REQ-020 FR-8 pattern).
- FR-11 Prompts, not nags: when the provider changes a questionnaire answer that is a s 13 change (registration groups, states, the structure, key personnel count), the result page says in one line "This is a change you tell the Commission about; record it in your changes register" with the link. No automatic rows.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 No new personal data: dates, codes, counts and capped notes only; the changes register's reference field has the same CHECK as the clearance number (never an NDIS-number shape). The worker lines in FR-6 are codes and counts.
- SR-2 Tenant isolation as every register: RLS on the new table, the status view pattern from batch 45, explicit grants only (D-052), integration tests in the Supabase job for the policies and the view.
- SR-3 The auditor link (REQ-020 FR-2) shows the period-filtered registers and FR-6's summary and nothing else new; the period parameter is validated (a closed list or two ISO dates within the registration period) and never reaches a query unparsed.
- SR-4 Reminders carry the timeline dates and the link only; no document names, no register contents.
- SR-5 The CSV import for the changes register has the REQ-020 FR-12 refusal rule.

## Data (entities, fields, retention)

- `accounts` (or the registration row REQ-018 added) gains `registration_expires_on date`, `last_audit_on date`, `last_audit_type text`, `midterm_audit_on date null`; each change audited.
- `commission_changes` (FR-10): `id`, `account_id`, `change_type` (closed list), `happened_on`, `notified_on null`, `channel` (closed list), `reference text` (CHECK as clearance_number), `note text` (capped), `created_at`, `created_by`; append-only with an events trail like incidents; a status view with `notify_by` and `state`.
- Retention: the registers' 7-year rule from batch 45 item 18 applies ("no period set in the Rules; we keep it 7 years, our choice").

## Acceptance criteria (Given/When/Then, numbered AC-1 ...)

- AC-1 Given a certification provider registered on 1 March 2026 with the default expiry, when they open the account page, then the timeline shows the mid-term window 1 June 2027 to 1 December 2027, renewal start 1 September 2028, book by 1 November 2028, audit done by 18 January 2029, expiry 1 March 2029, and the position sentence for today; a verification provider sees no mid-term row.
- AC-2 Given a reminder setting on, when the reminders job runs on the day each FR-3 date is reached, then one email goes out with the plain-words line and the link, once, and an `audit_log` row exists; with `do_not_send` set, nothing goes out and the row says so.
- AC-3 Given incidents on either side of the last-audit date, when the period "Since the last audit" is selected on the incidents register, the CSV export and the audit pack, then only the later rows appear, the file name carries the period, and the cover sheet states it.
- AC-4 Given three documents reviewed in the period and one due before expiry, when "What changed since the last audit" opens, then the three are listed with dates, the one is listed as due, and `since-last-audit.csv` in the pack matches the screen.
- AC-5 Given a provider at renewal start, when they walk `/path/renewal`, then every step shows its live state, the rehearsal ends with the dated sheet, and the sheet is in the next audit pack.
- AC-6 Given a change of registration groups in the questionnaire, when the result page renders, then the one-line prompt with the link appears, and recording the change in the register shows "notify by" from the Rules' timing and the open state until a notified date is entered.
- AC-7 Given a worker session (REQ-020 FR-4), when the worker opens any renewal page or the changes register, then 404.

## Test expectations (unit, integration, e2e, manual)

Unit: the timeline derivation (every date in FR-2 from fixtures, leap years, a mid-term already done, an expiry edited by hand); the period filter over fixtures; the "what changed" summary; the notify-by derivation per change type. Integration (Supabase job): RLS and the status view for `commission_changes`; the reminders job writing one row per date. E2E (three projects): the account page timeline; the period selector on one register and the pack; `/path/renewal` as the certification and the verification fixture; the worker 404. Manual: none; the Commission VERIFY items are research, recorded in the watch file.

## Evidence required on delivery

Per session: `npm run check`; the CI run; screenshots of the timeline table, "what changed", and `/path/renewal` at 360 px and desktop; the watch file entry with the read dates for R-1 to R-4 and the self-assessment line in FR-7; the ASVS rows for the new register and the period parameter; anything UNVERIFIED.

## PO decisions

- D-2301 Dates are facts, not pressure. The timeline is a table in the product's voice; no colour for "soon", no countdown in the header, no email more often than FR-3 lists. The reminders are the ones a careful bookkeeper would set, and that is all.
- D-2302 The defaults (3 years, 15 to 21 months, 6 months, 4 months, 6 weeks) are PO practice defaults, one constants file, each with its VERIFY note; a Commission page that states a different figure changes the constant and the sentence, not the design.
- D-2303 No auditor list, booking, or fee, ever; the "book the audit" step is a date and a code.
- D-2304 Order: A (the dates everything else reads), then B and D in parallel if two sessions can run, then C.

## Questions for Dev to answer before building

1. Where does the registration date live today (REQ-018), and is one row per account enough for FR-1, or does the certification-then-renewal history need its own table?
2. The period filter: a query parameter parsed in one helper and passed to the existing queries, or a per-register change? Prefer one helper.
3. The rehearsal sheet: PDF through the pack's existing docx-to-PDF path, or CSV like the rest of the pack? Choose the one that costs nothing in CI minutes.
4. Estimate per session.

## Dev response

Awaiting Dev.

## Delivery evidence

Not started.

# REQ-009: Registers (incidents, complaints, worker clearances, policy reviews) and reminders
Status: written (PO, 13 Oct 2026, from the Dev proposal below); Session A ready to build   Phase: 5   Priority: must   Owner: Dev
Depends on: REQ-004 (accounts), REQ-006 (checklist), REQ-007 (entitlements; the subscription product is the second entitlement kind).

## Why (from the brief)
The subscription is the primary product (CLAUDE.md section 3): the ongoing system of record a small provider keeps after registration, which an auditor samples at the mid-term audit and at renewal. Four registers and their reminders are the whole of it in v1.

## Dev response: proposal for the data model (Session A scope)

### Principles that shape every table
- **No participant personal data by schema** (CLAUDE.md 4.5). No column can hold a name, date of birth, NDIS number, address or health detail. Where a person must be referred to, the column is `participant_ref` (text, max 20, pattern `^[A-Z]{1,3}-?[0-9]{1,6}$`, e.g. `P-014`), and the UI shows the reference-code pattern beside it. Free-text columns are capped (500 or 2,000 characters), carry the inline warning in the UI, pass through the existing client-side participant-data detector before submit (warn, never block), and are never sent to the model. A database CHECK rejects obvious NDIS numbers (nine digits starting with 43) in every free-text column; the lint for names and dates stays client-side because a regex cannot judge prose.
- **Account-scoped, member RLS, explicit grants** (D-052): every table has `account_id` with `on delete cascade`, policies `select/insert/update` for members (`is_member`), `delete` for owners, and `grant select, insert, update, delete … to authenticated` plus `all` to `service_role`, in the same migration.
- **Append-only history where an auditor expects it.** Incidents and complaints keep an `events` trail (status changes, notes) rather than overwriting; the row itself holds the current state.
- **Dates, not timestamps, for things the provider enters** (occurred on, expiry on, review due), because they come from paper and calendars; `created_at`/`updated_at` are timestamps.
- **Entitlement gate, not a table flag.** Reading a register needs an active `entitlements` row of kind `subscription` (REQ-007's table already allows the kind); writes are refused in the UI and by RLS (`exists (select 1 from entitlements where account_id = … and kind = 'subscription' and revoked_at is null)` in the insert/update policies) so a lapsed subscription freezes the registers but never hides them: the brief says non-payment pauses the service and never penalises.

### Tables
1. `incidents` (id, account_id, reference text generated `INC-0001` per account through a per-account sequence table, occurred_on date, reported_on date, category enum: injury / near-miss / abuse-neglect-allegation / restrictive-practice-unauthorised / medication / property / other, severity enum: low / medium / high, participant_ref, worker_ref (same pattern, `W-`), summary text 500, actions_taken text 2000, reportable boolean, reportable_notified_on date null, status enum: open / under-review / closed, closed_on date null, created_by, created_at, updated_at). CHECK: `reportable_notified_on` only when `reportable`; `closed_on` only when `status = 'closed'`.
2. `incident_events` (id, incident_id, account_id, at timestamptz, actor user id, kind enum: created / note / status-change / reportable-flagged, note text 1000). Append-only (no update policy).
3. `complaints` (id, account_id, reference `CMP-0001`, received_on date, channel enum: phone / email / in-person / form / advocate / other, from_ref (participant_ref pattern, or `ADV-` for an advocate, `FAM-` for a family member), summary 500, outcome 2000, acknowledged_on date null, resolved_on date null, status enum: received / acknowledged / in-progress / resolved / escalated-to-commission, created_by, timestamps). CHECK: `acknowledged_on >= received_on`, `resolved_on` only when resolved.
4. `complaint_events` as for incidents.
5. `worker_clearances` (id, account_id, worker_ref `W-0001`, role_label text 80 (the role, never the person: "support worker", "director"), clearance_kind enum: ndis-worker-screening / wwcc / police-check / first-aid / other, issued_on date, expires_on date, state enum of the eight states, status generated: valid / expiring (within 90 days) / expired, computed in a view, not stored, note 500, timestamps). The register never stores the clearance number: the Commission's portal is the source; the register tracks expiry (the brief's "worker screening expiry tracker").
6. `policy_reviews` (id, account_id, document_type_id (the catalogue id from REQ-005, or free `other` with a title 120), adopted_on date, review_cycle_months integer default 12 (3 for registers), next_review_on date generated from adopted_on + cycle, last_reviewed_on date null, reviewer_ref `W-`, status computed: current / due-soon (60 days) / overdue, note 500). Seeded from a purchased pack's documents when the subscription starts (one row per document, adopted_on null until the provider ticks "adopted" on the checklist, which REQ-006 already stores).
7. `reminders` (id, account_id, kind enum: clearance-expiry / policy-review / mid-term-audit / incident-open / complaint-unacknowledged, subject_table text, subject_id uuid, due_on date, send_on date, sent_at timestamptz null, channel enum: email, created_at). Derived nightly by the job route (REQ-010's cron) from the four registers and the account's registration date, idempotent on (account_id, kind, subject_id, due_on). Mid-term audit countdown: `registration_date` and `registration_kind` columns on `accounts` (nullable until the provider enters them), the rule from `standards.json` (18 months, prepare from month 12).
8. `register_sequences` (account_id, register text, next integer) for the per-account human references, bumped in a security-definer function `next_register_reference(p_account, p_register)` granted to `authenticated` with the member check inside.

### Export
`GET /registers/<name>/export.csv` per register, member-only, rate-limited like the account export (5 an hour), UTF-8 with BOM for Excel, dates as `YYYY-MM-DD`, references as entered, events flattened to a second file in the same zip when the register has them. The account export (REQ-004) gains the four registers as JSON.

### What Session A delivers once the REQ is written
Migration with the eight tables, policies, grants, CHECKs, the reference function and the status views; the integration tests (member reads and writes their own rows, another account reads nothing, a lapsed subscription can read but not write, the NDIS-number CHECK fires, the reference sequence is per account); the TypeScript row types and a pure `registerStatus()` for clearances and reviews with unit tests; no UI. Sessions B (register pages and the ready line from REQ-014) and C (reminder job and email, the subscription in Stripe Billing, export) follow.

### Questions for the PO
1. Confirm the four category and status enums above or supply the Commission's own vocabulary where one exists (the Incident Management Rules name "reportable incidents"; the rest is Readyline's).
2. Reminders by email only in v1, from the REQ-004 provider once D-013 picks one?
3. Should the clearance register hold the clearance *number* at all? Proposal: no (it identifies a person outside our system); expiry and kind are enough for the audit sample.
4. Subscription lapse: freeze writes but keep reads, as proposed, or keep writes too for a 14-day grace?

## PO answers to the Dev questions (13 Oct 2026)
1. **Vocabulary.** Use the Commission's own words where it has them and Readyline's where it does not.
   - Incident `category` (what happened): `death`, `serious-injury`, `abuse-or-neglect`, `unlawful-sexual-or-physical-contact`, `sexual-misconduct`, `restrictive-practice-unauthorised`, `near-miss`, `medication`, `property-or-environment`, `other`. The first six are the reportable kinds in the NDIS (Incident Management and Reportable Incidents) Rules; `reportable` is still its own boolean because a serious injury that did not happen in connection with supports is not reportable, and the provider decides.
   - Add `notify_by` (date, generated): 24 hours after `occurred_on` for the first five reportable kinds, 5 business days for `restrictive-practice-unauthorised` (`UNVERIFIED` against the current Rules; Dev checks the Commission's reportable incidents page and cites it in the migration comment). The UI shows "Notify the Commission by …" and a reminder of kind `reportable-not-notified` fires the morning after `notify_by` if `reportable_notified_on` is null. Keep `severity` as proposed.
   - Incident `status`: `open`, `under-review`, `closed`. Complaint `status`: `received`, `acknowledged`, `in-progress`, `resolved`, `escalated-to-commission`, plus `withdrawn`. Complaint `channel`: as proposed. Complaint `from_ref` prefixes: `P-` participant, `FAM-` family, `ADV-` advocate, `W-` worker, `OTH-` other.
   - Worker clearance `clearance_kind`: `ndis-worker-screening`, `wwcc`, `police-check`, `first-aid`, `ndis-worker-orientation-module`, `other`. Rename the table `worker_checks` in the UI copy ("Worker checks register"); the table name can stay. Default `expires_on` suggestion in the UI: 5 years from `issued_on` for `ndis-worker-screening`, none for the orientation module (no expiry), otherwise blank.
2. **Reminders: email only in v1**, from the REQ-004 provider once D-013 lands (log-only until then), plus the same list on the account page under "Due soon" so a provider who ignores email still sees it. No SMS, no push.
3. **No clearance number** in v1, as proposed. The Commission's worker screening database and the provider's HR file are the records of the number; Readyline tracks kind and expiry. If a trial provider asks for it, raise it as a question, not a change.
4. **Lapse: freeze writes, keep reads, no app-level grace.** Stripe's own retry window is the grace: the entitlement is revoked only when the subscription reaches `canceled` or `unpaid` (REQ-007 webhook), not on `past_due`, so a failed card gets Stripe's retries (Dev sets the Billing retry schedule to 7 days in the runbook, Haider applies it) before anything freezes. No fee, no penalty, no lost data (CLAUDE.md shariah rules; the brief). A frozen register shows one line: "Your subscription has lapsed; your records are safe and read-only. Renew to add to them."

## Functional requirements (Session A: data; B: pages; C: reminders, billing, export)
- FR-1 The eight tables, policies, grants, CHECKs, reference function and status views as in the Dev proposal, with the question-1 vocabulary and the `notify_by` column. Migration is forward-only and idempotent as the earlier ones.
- FR-2 `registerStatus()` pure functions: clearance `valid` / `expiring` (90 days) / `expired`; review `current` / `due-soon` (60 days) / `overdue`; incident `overdue-notification` when reportable, not notified and past `notify_by`.
- FR-3 Reminder rules (Session C, nightly job through the existing cron route, idempotent on `(account_id, kind, subject_id, due_on)`): clearance expiry at 90, 30 and 7 days before and on the day; policy review at 60 and 14 days before and on the day; incident open 30 days with no event; complaint not acknowledged 2 business days after `received_on`; reportable not notified the morning after `notify_by`; mid-term audit at months 12, 15 and 17 after `registration_date` when `registration_kind = 'certification'` only (verification registrations have no mid-term audit); renewal at 6 and 3 months before `registration_date + 3 years` for both kinds.
- FR-4 `accounts.registration_date` (date, null) and `registration_kind` (`certification` / `verification` / null), entered on the account page with one line of help; never asked in the questionnaire.
- FR-5 Register pages (Session B): list with the computed status pill, filters by status, add and edit forms with the participant-data warning and the reference-code hint, the events trail under an incident or complaint, "Export CSV" per register; the ready line from REQ-014 shows the counts of overdue items.
- FR-6 Export as proposed (per-register CSV with BOM, events in a zip, the account export gains the registers as JSON).
- FR-7 Seed `policy_reviews` from the purchased pack when the subscription starts (one row per document; `adopted_on` null until the checklist tick), and keep the two in step: ticking "adopted" on the checklist sets `adopted_on` if null.

## Security requirements
- SR-1 No participant personal data by schema (CLAUDE.md 4.5): the ref patterns, caps, the NDIS-number CHECK on every free-text column, the client-side detector before submit; nothing from a register is ever sent to the model.
- SR-2 Member RLS with explicit grants in the same migration (D-052); events tables append-only (no update policy, delete for owners only); the entitlement gate in insert and update policies, not only in the UI.
- SR-3 Rate limits on the export routes (5 an hour per account) and on register writes (60 a minute per user); audit log lines for create, status change and export with ids only.
- SR-4 The reminder email names the register and the reference (`INC-0004`), never the summary text.

## Acceptance criteria
- AC-1 (Session A) Integration tests: member reads and writes own rows; another account reads nothing; lapsed subscription reads but cannot write (RLS, not only UI); NDIS-number CHECK fires; references are per account and gap-free in order; `notify_by` is 24 hours or 5 business days by category.
- AC-2 (Session A) Unit tests for `registerStatus()` across the boundaries (89/90/91 days; 59/60/61; the business-day arithmetic over a weekend).
- AC-3 (Session B) The PO adds one incident, one complaint, one worker check and one policy review on the hosted site with a trial account, sees the right status pills, exports a CSV that opens in Excel with the dates intact, and the participant-data warning fires on a typed name.
- AC-4 (Session C) A forced run of the nightly job on a seeded account produces exactly the expected reminder rows and no duplicates on a second run; the lapse test freezes writes and leaves reads.

## Not in v1
Restrictive-practice reporting to the Commission's portal, participant records of any kind, document storage for evidence (a link field is enough), SMS, multi-site.

## Delivery evidence
(Dev fills in once the REQ is written.)

## PO review
(PO fills in.)

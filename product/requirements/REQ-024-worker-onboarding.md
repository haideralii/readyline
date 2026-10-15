# REQ-024: Worker onboarding: the worker file an auditor samples, from invitation to first shift

Status: draft, second version (PO, 15 Oct 2026 22:10; rewritten after the independent review of 15 Oct, `product/qa/req-reviews/2026-10-15-req-022-023-024.md`, findings 1 to 18; the Worker Screening Rules were read on 15 Oct 2026 from legislation.gov.au, compilation F2021C00788 of 31 July 2021, VERIFY that no later compilation exists; goes back to the reviewer before "ready" as D-2215 requires; every session waits for REQ-020 to be on `main`)
Phase: 6 Priority: should Owner: Dev

## Why (user and business outcome)

An auditor's worker sample is the fastest way to a non-conformity: "show me three worker files" and the newest worker's file is missing the screening check, the Code of Conduct acknowledgement, the induction or the orientation module, because nobody wrote down what a new worker needs before the first shift. Today the product holds a staff matrix and a per-worker onboarding checklist (REQ-018 FR-9), worker clearances with reminders (REQ-018), invitations and a worker role (REQ-020 FR-4), but they are separate screens with no sequence and the worker cannot do their own part. This REQ extends what exists into one sequence per worker that the owner and the worker tick together, with the dates and numbers an auditor samples, the two lists the Worker Screening Rules require (as far as the product can hold them, D-2406), and one export per worker. It is the third reason to keep the AUD 39 subscription.

## Scope (in / out)

In, as three sessions, all after REQ-020 is on `main`:

- Session A, the onboarding sequence: `staff_matrix` and `onboarding_checklists` extended (not replaced) with the derived items, their states, dates, numbers and expiries; the owner's views; the worker file export; the two Rules lists.
- Session B, the worker's own steps through the worker role: the worker completes what is theirs and the owner confirms; the acknowledgement rows; the invitation's first steps.
- Session C, keeping it current: expiries on the existing reminders, the audit-day and checklist states, the supervision rows, the period filter and the pack (after REQ-023 Session B), ending a worker.

Out: payroll, rostering, contracts, award interpretation, HR integrations; identity documents or certificates as files; a worker's performance notes; anything that names a participant; worker names, dates of birth and addresses (D-2406).

## Domain rules that apply (link to product/domain)

`CLAUDE.md` 4.5 (no participant data), 4.2 (plain words, no pressure), D-052 (explicit grants), D-2212 (state differences; the PO decision formerly numbered D-2211 in NEXT.md, renumbered because batch 47 used D-2211). The Worker Screening Rules, read 15 Oct 2026 (F2021C00788):

- W-1 Clearance. A provider in a participating jurisdiction "must only allow a worker to engage in a risk assessed role, if the worker has a clearance" (s 13(a)); a sole-trader provider must hold one themselves (s 13(c)). A clearance lasts up to five years (the primer); the expiry is typed from the outcome, never derived. The provider verifies in the NDIS Worker Screening Database and records the date.
- W-1a The pending exception, s 14(1)(a), all four together: the person "is in the process of obtaining a clearance"; "is appropriately supervised by a person with a clearance"; the provider "is implementing a risk management plan developed and maintained in accordance with Division 3" (ss 11 and 12: a written plan that names each risk to a person with disability and how it is managed, reviewed after a reportable incident involving a worker); and the law of the jurisdiction allows a person to work in a risk assessed role while the application is determined (VERIFY per state, D-2212). The work-experience exception (s 14(1)(c)) is out of scope.
- W-1b The records, Part 3: a written list of risk assessed roles with the title, the paragraph of the definition that applies, a description, the date assessed and "the name and title of the person who assessed the role" (s 17(3)), updated within 20 business days of a new or reclassified role (s 17(2)); a written list of each worker in a risk assessed role with "the worker's full name, date of birth and address", the roles, for an exception the section relied on, its start and end dates and the supervisor's name, and otherwise the application number, the check number, the outcome and its expiry and any suspension or revocation (s 18(3)); kept in a form that lets an auditor "determine which workers were engaged in risk assessed roles with the provider on any given day in the seven years prior" (s 20); every record in the Part kept 7 years from the date it is made (s 21). Batch 45 item 18 cited "ss 20 and 21" as the two lists; the lists are ss 17 and 18, s 20 is the form and s 21 the period: a doc fix for REQ-018 and the governance text (retro review).
- W-2 Working with children check, where the provider delivers supports to children or the state requires it: a state scheme. VERIFY per state (D-2212 item 2).
- W-3 NDIS Code of Conduct: every worker is bound by it; the acknowledgement document in the pack (REQ-005) is the record. Source: NDIS (Code of Conduct) Rules 2018.
- W-4 NDIS Worker Orientation Module "Quality, Safety and You": the Commission's free module. VERIFY the current name and whether the Commission states it as a requirement or an expectation, and quote it.
- W-5 Induction against the provider's own induction procedure (REQ-005), recorded in the induction and training register (REQ-018).
- W-6 Read-and-acknowledge of the policies that apply to the role. No acknowledgement rows exist today (`policy_circulations` is owner-recorded; REQ-018 FR-13 is the document control register): the rows are new work in Session B.
- W-7 Qualifications and training the supports require (first aid, CPR, medication, manual handling, the high-intensity skills descriptors, PBS capability): derived from the account's modules; the product names what the module's quality indicators name and marks the rest "your call". VERIFY against the Practice Standards' quality indicators (REQ-001 mapping).
- W-8 Supervision and probation: the provider's own cadence (the governance and HR fixed text); the auditor expects a record that supervision happened.
- W-9 Restrictive practices: a worker who may use one needs the account's behaviour support arrangements and the state authorisation pathway in their induction (D-2212 item 3). VERIFY per state.
- W-10 Other checks a real provider holds: a police check (an existing `clearance_kind`) and a driver licence for transport supports; a closed list, dates only.

## Functional requirements (numbered FR-1 ...)

Session A, the onboarding sequence

- FR-1 `staff_matrix` is the worker row (no new `workers` table). It gains: `role` from a closed list (support worker, team leader, key personnel, admin, contractor, volunteer) beside the free `role_label`; `states text[]` (from the account's states); `works_with_children bool`; `may_use_restrictive_practice bool` (shown only when the account uses any); `ended_on date null`; `membership_id null` (set when the worker accepts an invitation, REQ-020 FR-4); `risk_assessed` stays and drives W-1. No name, no label, no date of birth, no address (D-2406); the code is the name, as today. Existing rows keep working; new columns default to empty.
- FR-2 The onboarding list is derived, not typed: `WORKER_ONBOARDING_ITEMS` (`src/lib/registers/onboarding-items.ts`) becomes a function of the worker's role, states and flags and the account's modules: for each applicable item from W-1 to W-10, who does it (owner, worker, both), what counts as done (a date, a number, an expiry, a tick with a date), the plain-words ask ("Show me this worker's clearance and the date you checked it in the database"), and a source line. Until a state's page is read into the watch file, the item shows the national wording with "check your state's unit" (D-2404); the existing `onboarding_checklists` and `onboarding_ticks` hold the ticks, extended with `done_on`, `confirmed_on`, `expires_on`, `number` (the batch 45 CHECK) and `item_key`.
- FR-3 The owner's views: `/registers/staff` (today's matrix page) lists workers with the derived state (ready for first shift, in progress, expiring, ended) and the next thing to do; the worker's page shows every item with its state and dates, the worker's clearances (REQ-018) and induction rows pulled in, and "Export this worker's file" (FR-6). Every change is an event on the worker's trail, append-only (REQ-009).
- FR-4 "Ready for first shift" is derived: every item marked "before first shift" (W-1 cleared or W-1a, W-2 where it applies, W-3, W-4, W-5, W-6 for the mandatory policies) is done, confirmed and not expired. When the clearance is pending, the owner may record "started under the s 14 exception" with the four W-1a conditions shown as four tick lines in plain words (application lodged on <date>; supervised by <worker code>; our risk management plan is in place and followed; our state allows it: <state wording or "check your state">), the start date, and later the end date; the record is what s 18(3)(c) asks for, except the supervisor's name, which is the supervisor's code (D-2406). The product never offers "start without a check".
- FR-5 Expiries feed the existing reminders job as today (`CLEARANCE_OFFSETS` 90, 30, 7, 0 days already serve `worker_clearances`; the same offsets are extended to onboarding items with an expiry: the working with children check, first aid and CPR with defaults 3 years and 1 year as constants, supervision on the governance cadence). No item is reminded twice: a clearance's reminder comes from `worker_clearances` only.
- FR-6 The worker file export: one sheet per worker in the audit pack's `workers/` folder (not a separate CSV path) with every item, its state, dates, check numbers and the trail, plus `workers/index.csv`; the auditor link shows codes and states only, no numbers (D-2407).
- FR-6a The two Rules lists as exports from the same data: `risk-assessed-roles.csv` (s 17: the role title, the definition paragraph as a code, the description, the date assessed, the assessor's code; the owner keeps the assessor's name and title beside it, D-2406) and `screening-list.csv` (s 18: every current and past worker in a risk assessed role, by code, with the roles, the exception section and dates and supervisor code where one applied, the application number, the check number, the outcome and its expiry, and any suspension or revocation as a code and date). Each export's first line states which s 18 fields are not in the product (full name, date of birth, address, the supervisor's name) and that the owner's HR file holds them against the code. The screening list is reconstructable for any day in the last seven years from the trail (s 20).

Session B, the worker's own steps

- FR-7 On the worker home (REQ-020 FR-4) the worker sees their own list and completes what is theirs: their check application number, check number and expiry (W-1; the owner verifies in the database and confirms "verified on <date>"), the orientation module date (W-4), reads and acknowledges each document (W-3, W-6; new `policy_acknowledgements` rows: worker, document, version, date), and ticks the induction sessions as attended (W-5; the owner confirms). The worker sees nothing of other workers, the registers or the account page; the REQ-020 FR-11 copy changes from "log incidents and complaints" to "log incidents and complaints and complete your onboarding", and the spec that asserts it changes with it.
- FR-8 Two-party items: an item the worker ticks shows "waiting for your manager to confirm" until the owner confirms; the owner's confirmation is the date an auditor reads. The trail holds both dates and both actors by role.
- FR-9 The invitation email (REQ-020 FR-4) carries the worker's first three steps in plain words and the link; the worker's first screen after sign-in is their list.

Session C, keeping it current

- FR-10 The audit-day page's worker group and the checklist's worker items read the derived states (FR-4, FR-5): "3 workers ready, 1 in progress (clearance pending, supervised), 1 check expiring in 20 days"; the quarterly self-check asks its staff-matrix question from the same data.
- FR-11 Supervision rows: `staff_matrix.last_supervision_on` stays the summary; a new `supervision_entries` table holds the history (kind: supervision, probation review, conversation; held on; the supervisor's code; a note capped at 500 characters with the participant warning); never free text about a participant; in the worker file and the pack.
- FR-12 Ending a worker: `ended_on`, the trail closes, the worker's membership is revoked (REQ-020), the row moves under "Past workers" and stays in the s 18 export for seven years (W-1b).
- FR-13 Import: the REQ-020 FR-8 pattern for the new `staff_matrix` columns (role, states, flags, dates) and for onboarding items; the template and the FR-12 refusal rule.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 Workers are people: the product holds a code, a role, states, flags, dates, check and application numbers with the batch 45 CHECK, and capped notes. No names, no labels, no dates of birth, no addresses, no identity documents, no certificates as files. The privacy policy's "What we collect" gains the worker lines (codes and check numbers are personal information once the owner holds the code-to-name key; contractors are outside the employee-records exemption) and the 7-year retention; the collection notice is one screen with one button on the worker's first sign-in.
- SR-2 Policy path for the worker role: `onboarding_ticks.worker_id -> staff_matrix.membership_id -> memberships.user_id = auth.uid()`; a worker may insert their own ticks and update only `done_on`, `number` and `expires_on` on their own items, never `confirmed_on`; the owner reads and writes all rows in the account; the auditor link reads codes and states; integration tests for every policy and both roles in the Supabase job.
- SR-3 Every write is an event on the worker's trail with the actor's role and the time; nothing is deleted; ending a worker is an event.
- SR-4 Reminders name the worker by code and the item, never a number.
- SR-5 The pack and the exports carry codes and check numbers (the auditor verifies by number in the database); the auditor link carries codes and states only (D-2407).
- SR-6 The import refuses rows with a participant-shaped value in any field (REQ-020 FR-12 and the batch 45 CHECK), and the note field's helper says "no names".

## Data (entities, fields, retention)

- `staff_matrix`: the FR-1 columns added; `risk_assessed`, `role_label`, `qualifications`, `started_on`, `last_supervision_on`, `onboarding_signed_on` stay; a status view `staff_matrix_status` with the derived state and the next item.
- `onboarding_checklists` and `onboarding_ticks`: `item_key` (closed list), `owner_role`, `done_on`, `confirmed_on`, `expires_on`, `number` (CHECK), `note` (capped); an events table on the incidents pattern; a migration maps today's ticks to item keys.
- `policy_acknowledgements`: `id`, `account_id`, `worker_id`, `document_slug`, `version`, `acknowledged_on`, timestamps; RLS as SR-2.
- `supervision_entries` (FR-11): `id`, `account_id`, `worker_id`, `kind`, `held_on`, `by_code`, `note`, timestamps; RLS as every register.
- `worker_clearances` rows link to the worker by code as today; `worker_id` is backfilled where a `staff_matrix` code matches; the code stays the join for imports.
- Retention: 7 years from the record's date (s 21); the purge job (REQ-010) learns the rule; past workers stay in the s 18 export for seven years after `ended_on`.

## Acceptance criteria (Given/When/Then, numbered AC-1 ...)

- AC-1 Given a certification provider in NSW with the core module and personal care and no NSW watch entry, when the owner adds a support worker who works with children, then the list shows W-1 to W-7 with the national wording and "check your state's unit" on W-1 and W-2, first aid and CPR from the module, and each item's ask and source; given a verification-only sole trader whose membership is the owner adding themselves as key personnel, then W-5 and W-8 are omitted and W-1, W-3, W-4 and W-6 remain.
- AC-2 Given a worker with every before-first-shift item done and confirmed, when the owner opens the list, then the state is "Ready for first shift"; given the clearance pending, then the state is "In progress" and the s 14 option shows the four W-1a tick lines verbatim from FR-4.
- AC-3 Given a worker signed in through an invitation, when they open their home, then they see their own list and the changed FR-7 copy and nothing else; entering a check number and expiry shows "waiting for your manager to confirm"; the owner's confirmation sets `confirmed_on` and the trail holds both.
- AC-4 Given a first-aid item expiring in 30 days and a clearance expiring the same day, when the reminders job runs, then two emails go out, one per item, each naming the code and the item and no number, once; the audit-day worker row says "2 expiring".
- AC-5 Given two current workers and one ended, when the audit pack is built, then `workers/` holds one sheet per current worker and `index.csv` lists the ended worker under past workers; `screening-list.csv` holds all three with their check numbers and dates and the first line names the fields the product does not hold; `risk-assessed-roles.csv` lists the roles with the assessed date and the assessor's code.
- AC-6 Given a worker session, when it requests another worker's row, the registers, the pack or the account page, then 404 or an empty result; when it updates `confirmed_on` on its own item, then the write is refused; the integration suite proves both.
- AC-7 Given a CSV with a participant-shaped value in the note column, when imported, then the preview refuses that row with the plain message and nothing is written.
- AC-8 Given the invitation email for a new worker, when rendered, then it carries the three first steps and the link and no number.
- AC-9 Given a worker with two supervision entries, when the worker file is exported, then both appear with kind, date and supervisor code, and `last_supervision_on` equals the later date.
- AC-10 Given a worker ended on a date, when the worker file and the screening list are exported, then the worker is under past workers with the end date and the membership is revoked.
- AC-11 Given the worker's first sign-in, when the home renders, then the collection notice screen shows first and the home shows after its one button.

## Test expectations (unit, integration, e2e, manual)

Unit: the derivation of the list from account facts and worker flags (every role, every module, children yes/no, restrictive practice yes/no, the owner-as-worker case); the derived state; expiry and reminder maths with the no-double-reminder rule; the s 18 export's reconstruction for a past day. Integration (Supabase job): RLS for owner, worker and auditor link on the four tables; the tick migration; the backfill; the purge rule. E2E (three projects, one journey per session under D-2207): A, the owner adds a worker and walks the list to "Ready"; B, the worker completes their items through an invitation; C, the pack's `workers/` folder and the two lists. Manual: none; VERIFY items are research in the watch file with read dates.

## Evidence required on delivery

Per session: `npm run check`; the CI run; screenshots of the staff list and one worker's list (owner and worker views) at 360 px and desktop; the pack's `workers/` index and the two Rules exports; the watch file entries for W-1a's state law, W-2, W-4, W-7 and W-9 with read dates per state covered; the ASVS rows for the worker role's RLS and the import; the privacy policy diff; anything UNVERIFIED.

## PO decisions

- D-2401 Workers are codes. The product holds no worker name, label, date of birth or address; the auditor verifies a worker by the check number in the Commission's database.
- D-2402 Derived, never typed. The onboarding list comes from the account's facts and the fixed list; no free-text items.
- D-2403 Pending means the s 14 exception, shown as its four conditions, never "start without a check"; the state-law condition is VERIFY per state and shows "check your state" until read.
- D-2404 State facts come from the watch file; a state line without a read date is never shown as a state fact (D-2212).
- D-2405 Order: A, then B, then C, all after REQ-020; C's period and pack items after REQ-023 Session B.
- D-2406 The s 18 list needs names, dates of birth and addresses the product will not hold. The product exports everything else by code and says on the first line of the export which fields the owner's HR file must hold against the code; the product is the companion to the s 18 list, not the list. If a customer asks for the full list inside the product, that is a new REQ with the privacy policy, the contractor question and a data-minimisation review first.
- D-2407 The auditor link shows codes and states, never numbers; numbers travel in the pack the owner hands over.

## Questions for Dev to answer before building

1. The tick migration: can today's `onboarding_ticks` map to `item_key` values one-to-one, or do some ticks need a "legacy" key?
2. W-7 keys: from the REQ-001 mapping's quality indicators as data, or a hand-kept list per module for now?
3. Estimate per session.

## Dev response

The first version's answers (15 Oct, ab3e936): the worker role keys on `auth.uid()` through `memberships.user_id`; `staff_matrix` and the onboarding checklist already exist. Carried into this version. Awaiting the rest.

## Review

First review 15 Oct 2026 (independent reviewer): Not ready; findings 1 to 18 in `product/qa/req-reviews/2026-10-15-req-022-023-024.md`. This version answers them: 1 (AC-1), 2 and 9 (W-1a quoted, FR-4, AC-2), 3 (AC-8, AC-9, AC-10, AC-11), 4 (FR-1, FR-2, FR-11, Data: extend, not replace), 5 (W-6, FR-7), 6 (FR-7 copy), 7 (FR-5), 8 (D-2212), 10 (W-1b, FR-6a; the reviewer's s 20/21 reading corrected to ss 17/18), 11 (W-1), 12 (D-2401, D-2406, no label), 13 (SR-2), 14 (D-2407), 15 (one e2e journey per session), 16 (W-10), 17 (FR-6, one sheet), 18 (AC-1 national wording). Awaiting the re-review.

## Delivery evidence

Not started.

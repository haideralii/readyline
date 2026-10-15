# REQ-024: Worker onboarding: the worker file an auditor samples, from invitation to first shift

Status: ready (PO, 15 Oct 2026; written from REQ-004, REQ-005, REQ-009, REQ-018 (worker checks, induction register, living policies), REQ-020 (worker role, invitations) and D-2211 (what differs by state); state facts are marked VERIFY and the Dev checks each against the Commission's and the state unit's page with a read date; questions for Dev at the end, answer in the Dev response and start Session A without waiting)
Phase: 6 Priority: should Owner: Dev

## Why (user and business outcome)

An auditor's worker sample is the fastest way to a non-conformity: "show me three worker files" and the file for the newest worker is missing the screening check, the Code of Conduct acknowledgement, the induction, or the orientation module certificate, because nobody wrote down what a new worker needs before the first shift. Today the product tracks worker checks (REQ-018), invites workers (REQ-020 FR-4), keeps an induction register and lets a worker acknowledge living policies (REQ-018 FR-13), but these are four screens and no sequence. This REQ makes the sequence: one onboarding list per worker, generated from the provider's answers and state, that the owner and the worker tick together, with the dates and codes an auditor samples, and one export per worker that is the worker file. It is the third reason to keep the AUD 39 subscription, and it is the part a team leader uses every month.

## Scope (in / out)

In, as three sessions:

- Session A, the onboarding list: the per-worker checklist derived from the account (pathway, modules, states, restrictive practices) and the fixed list below; owner and worker views; dates, codes and expiries; the worker file export.
- Session B, the worker's own steps: through the worker role (REQ-020 FR-4) the worker completes what is theirs (read-and-acknowledge documents, the Code of Conduct acknowledgement, their own check numbers and dates), and the owner verifies.
- Session C, keeping it current: expiries feed the existing reminders and the audit-day list; the "since the last audit" period (REQ-023 FR-5) and the audit pack carry the worker files; the supervision and probation entries.

Out: payroll, rostering, contracts of employment, award interpretation, any HR system integration; storing identity documents or check certificates as files (dates, numbers and codes only; see SR-1); a worker's performance notes; anything that names a participant.

## Domain rules that apply (link to product/domain)

`CLAUDE.md` 4.5 (no participant data), 4.2 (plain words, no pressure), D-052 (explicit grants), D-2211 (state differences). The fixed list of what a worker file holds, each line with its source; the state lines VERIFY per state:

- W-1 NDIS Worker Screening Check: required for workers in risk-assessed roles of a registered provider (key personnel, workers with more than incidental contact with participants); applied for through the state or territory screening unit, valid 5 years, nationally recognised; the provider verifies the clearance in the NDIS Worker Screening Database and keeps the record. Source: NDIS (Practice Standards: Worker Screening) Rules 2018 as read for batch 45 (ss 13 to 15 on pending, excluded and barred); the Commission's worker screening page. VERIFY per state: the unit's name and portal (D-2211 item 1).
- W-2 Working with children check (where the provider delivers supports to children or the state requires it): a separate state scheme. VERIFY per state (D-2211 item 2).
- W-3 NDIS Code of Conduct: every worker is bound by it; the acknowledgement document in the pack (REQ-005) is the record. Source: NDIS (Code of Conduct) Rules 2018.
- W-4 NDIS Worker Orientation Module "Quality, Safety and You": the Commission's free online module; completion certificate commonly expected by auditors for every worker. VERIFY: the Commission's page for the module's current name and whether it is a requirement or an expectation, and quote it.
- W-5 Induction against the provider's own induction procedure (REQ-005 document), recorded in the induction and training register (REQ-018).
- W-6 Read-and-acknowledge of the policies that apply to the role (REQ-018 FR-13 living policies).
- W-7 Qualifications and training the supports require (first aid, CPR, medication, manual handling, high-intensity skills descriptors for the high-intensity module, PBS capability for behaviour support): derived from the account's modules and registration groups; the product names what the module's quality indicators name and marks the rest "your call". VERIFY against the Practice Standards' quality indicators for each module the account carries (REQ-001 mapping).
- W-8 Supervision and probation: the provider's own cadence (the governance and HR fixed text); the auditor expects a record that supervision happened.
- W-9 Restrictive practices: a worker who may use one needs the account's behaviour support arrangements and the state authorisation pathway in their induction (D-2211 item 3). VERIFY per state.
- W-10 Retention of the two worker screening lists is 7 years (Worker Screening Rules ss 20 and 21, batch 45 item 18); the rest "no period set in the Rules; we keep it 7 years, our choice".

## Functional requirements (numbered FR-1 ...)

Session A, the onboarding list

- FR-1 A worker record (REQ-018's worker checks already key on a worker code; REQ-020 invitations key on an email) becomes one `workers` row per account: a worker code (the provider's, as today), a role from a short list (support worker, team leader, key personnel, admin, contractor, volunteer), the states they work in (from the account's states), whether they work with children (yes/no), whether they may use a restrictive practice (yes/no, shown only when the account uses any), start date, end date (optional), and the linked membership when the worker has accepted an invitation. No name field; the code is the name (as the registers today). An optional display label of up to 40 characters for the owner's own use, with the participant-shape CHECK.
- FR-2 The onboarding list is derived, not typed: for each worker, the items from W-1 to W-9 that apply to their role, states and flags, each with: who does it (owner, worker, both), what counts as done (a date, a check number, an expiry, a tick with a date), the plain-words ask an auditor would say ("Show me this worker's screening clearance and the date you checked it in the database"), and a source line. Items the state VERIFY leaves open are shown with the national wording and "check your state's unit" until the watch file carries the state page.
- FR-3 The owner's view: `/registers/workers` lists workers with their onboarding state (ready for first shift / in progress / expiring / ended) and the next thing to do; `/registers/workers/<code>` is the worker's list with every item, its state and its dates, the worker's checks (REQ-018) and training rows (induction register) pulled in, and "Export this worker's file" (FR-6). Every change is an event on the worker's trail, append-only (REQ-009).
- FR-4 "Ready for first shift" is a derived state: every item marked "before first shift" in the fixed list (W-1 cleared or pending-with-supervision per Worker Screening Rules s 13, W-3, W-4, W-5, W-6 for the mandatory policies, W-2 where it applies) is done and not expired. The owner can start a worker anyway with a one-line reason recorded on the trail ("started under supervision while the check is pending" is offered as the first option, because the Rules allow it with conditions; the product says what the conditions are).
- FR-5 Expiries: the screening check (5 years), the working with children check (per state, VERIFY), first aid and CPR (the provider's own cadence, defaults 3 years and 1 year with a comment), supervision (the cadence from the governance text) feed the worker's state and the existing reminders (REQ-018 FR-10): 90, 30 and 7 days before, each once; the audit-day list's worker row reads these states.
- FR-6 The worker file export: one CSV per worker (or one sheet in the audit pack per worker) with every item, its state, dates, check numbers and the trail; the audit pack (REQ-020 FR-1) gains a `workers/` folder with one file per current worker and an index; the auditor link shows the same with codes only.

Session B, the worker's own steps

- FR-7 On the worker home (REQ-020 FR-4) the worker sees their own onboarding list and completes what is theirs: enters their screening check number and expiry (W-1; the owner verifies in the database and ticks "verified in the NDIS Worker Screening Database on <date>"), the orientation module completion date (W-4), reads and acknowledges each document (W-3, W-6; the REQ-018 FR-13 acknowledgement rows), and ticks the induction sessions as attended (W-5; the owner confirms). The worker sees nothing of other workers, the registers, or the account page (REQ-020 FR-11 copy stays true).
- FR-8 Two-party items: an item the worker ticks shows "waiting for your manager to confirm" until the owner confirms; the owner's confirmation is the date an auditor reads. The trail holds both dates and both actors by role.
- FR-9 The invitation (REQ-020 FR-4) carries the first three steps in its email body as plain words and the link; the worker's first screen after sign-in is their list, not a dashboard.

Session C, keeping it current

- FR-10 The audit-day page's worker group and the checklist's worker items read the derived states (FR-4, FR-5): "3 workers ready, 1 in progress (screening pending, supervised), 1 check expiring in 20 days"; the quarterly self-check and the renewal rehearsal (REQ-023 FR-8) ask the worker questions from the same data.
- FR-11 Supervision and probation rows: a dated entry per worker (type: supervision, probation review, performance conversation as "conversation"; a code for the supervisor; a note capped at 500 characters with the participant warning); never free text about a participant; in the worker file and the pack.
- FR-12 Ending a worker: an end date, the trail closes, the worker's membership is revoked (REQ-020), the file is kept for the retention period and shown under "Past workers"; the worker screening lists W-10 requires are derivable from the worker rows and their checks (a "screening lists" export: current and past risk-assessed workers with check dates).
- FR-13 Import: the REQ-020 FR-8 CSV import pattern for workers (codes, roles, states, flags, start dates) and for worker checks already exists; the worker list gains the template and the FR-12 refusal rule.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 Workers are people: the product holds the minimum (a code, a role, states, flags, dates, check numbers with the batch 45 CHECK, a capped label, a capped supervision note). No identity documents, no certificates as files, no dates of birth, no addresses, no phone numbers. The privacy policy's "What we collect" gains the worker lines and the retention (W-10); the collection notice is shown to the worker on first sign-in (one screen, one button).
- SR-2 Tenant isolation and the worker role: a worker reads and writes only their own worker row's worker-owned items (RLS by membership and worker id); the owner reads and writes all rows in the account; the auditor link reads codes and states only; integration tests for every policy and both roles in the Supabase job.
- SR-3 Every write is an event on the worker's trail with the actor's role and the time; nothing is deleted; ending a worker is an event.
- SR-4 Reminders name the worker by code and the item, never the check number.
- SR-5 Exports and the pack carry codes and check numbers (the auditor needs the number to verify in the database), never the label; the auditor link carries codes only.
- SR-6 The import refuses rows with a participant-shaped value in any field (REQ-020 FR-12 and the batch 45 CHECK).

## Data (entities, fields, retention)

- `workers`: `id`, `account_id`, `code` (unique per account), `role` (closed list), `states text[]`, `works_with_children bool`, `may_use_restrictive_practice bool`, `label text null` (CHECK ≤40, participant-shape refused), `started_on`, `ended_on null`, `membership_id null`, timestamps; RLS; a status view `workers_status` with the derived state and the next item.
- `worker_onboarding_items`: `id`, `worker_id`, `item_key` (closed list W-1 to W-9 and the module-derived training keys), `owner_role` (owner, worker, both), `done_on null`, `confirmed_on null`, `expires_on null`, `number text null` (the batch 45 CHECK), `note text null` (capped), timestamps; events trail table as incidents have.
- `worker_supervision`: `id`, `worker_id`, `kind` (closed list), `held_on`, `by_code`, `note` (capped), timestamps.
- Existing `worker_clearances` rows link to the worker by code (migration: backfill `worker_id` from the code where one matches; the code stays the join for imports).
- Retention: 7 years after the end date (W-10); the purge job (REQ-010) learns the rule.

## Acceptance criteria (Given/When/Then, numbered AC-1 ...)

- AC-1 Given a certification provider in NSW with the core module and personal care, when the owner adds a support worker who works with children, then the onboarding list shows W-1 to W-7 with the NSW screening unit named (or the national wording with "check your state's unit" until VERIFY), the working with children line, first aid and CPR from the module, and each item's ask and source; a verification-only sole trader adding themselves as key personnel sees W-1, W-3, W-4, W-6 and no induction of themselves by themselves.
- AC-2 Given a worker with every before-first-shift item done and confirmed, when the owner opens the list, then the state is "Ready for first shift"; with the screening check pending, the state is "In progress" and the "start under supervision" option appears with the Rules' conditions in plain words.
- AC-3 Given a worker signed in through an invitation, when they open their home, then they see their own list and nothing else; entering a check number and expiry shows "waiting for your manager to confirm"; the owner's confirmation sets the date and the trail holds both.
- AC-4 Given a screening check expiring in 30 days, when the reminders job runs, then one email goes out naming the worker code and the item, once, and the audit-day worker row says "1 check expiring".
- AC-5 Given two current workers and one ended, when the audit pack is built with "since the last audit", then `workers/` holds one file per current worker and the index lists the ended worker under past workers; the screening lists export holds all three with their check dates.
- AC-6 Given a worker session, when it requests another worker's row, the registers, the pack or the account page, then 404 or an empty result, and the integration suite proves the policy.
- AC-7 Given a CSV with a participant-shaped value in the label column, when imported, then the preview refuses that row with the plain message and nothing is written.

## Test expectations (unit, integration, e2e, manual)

Unit: the derivation of the list from account facts and worker flags (every role, every module the product carries, children yes/no, restrictive practices yes/no); the derived state; expiry maths. Integration (Supabase job): RLS for owner, worker and auditor link on the three tables; the backfill migration; the purge rule. E2E (three projects): the owner adds a worker and walks the list to "Ready"; the worker completes their items through an invitation; the pack's `workers/` folder; the worker 404s. Manual: none; VERIFY items are research recorded in the watch file with read dates.

## Evidence required on delivery

Per session: `npm run check`; the CI run; screenshots of the workers list, one worker's list (owner and worker views) at 360 px and desktop; the pack's `workers/` index; the watch file entries for W-1, W-2, W-4, W-7 and W-9 with read dates per state covered; the ASVS rows for the worker role's RLS and the import; the privacy policy diff; anything UNVERIFIED.

## PO decisions

- D-2401 Workers are codes. No name field; the optional label is for the owner's eyes and never leaves the account. The auditor verifies a worker by the check number in the Commission's database, which is what the file carries.
- D-2402 Derived, never typed. The onboarding list comes from the account's facts and the fixed list; the owner cannot add free-text items (a "your own item" line is out of scope until a customer asks; then it is a closed list of extra training names).
- D-2403 Pending means supervised. The product offers "start under supervision while the check is pending" as the first option, with the conditions from the Worker Screening Rules in plain words, because that is what the Rules allow and what small providers actually do; it never offers "start without a check".
- D-2404 State facts come from the watch file. Until a state's unit page is read and recorded, the list shows the national wording; a state line without a read date is never shown as a state fact (D-2211).
- D-2405 Order: A, then B, then C; the REQ-023 period and pack items in C wait for REQ-023 Session B.

## Questions for Dev to answer before building

1. The worker code today: where is it held (REQ-018 clearances, REQ-020 invitations) and can one `workers` row own both without breaking the CSV import's column names?
2. Does the worker role's RLS (REQ-020 FR-4) key on a membership id that a `workers.membership_id` can join to, or does it need the user id?
3. The module-derived training keys (W-7): can they come from the REQ-001 mapping's quality indicators as data, or is a hand-kept list per module the honest answer for now?
4. Estimate per session.

## Dev response

Awaiting Dev.

## Delivery evidence

Not started.

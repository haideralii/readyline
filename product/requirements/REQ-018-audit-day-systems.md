# REQ-018 Audit-day systems: the registers an auditor asks for

Status: approved by PO, 14 Oct 2026. Source: PO review of the Effective Policy webinar "How To Ace Your NDIS Audit" (Gina Ingrouille, April 2024) checked against the NDIS Practice Standards and the Commission's provider obligations. Builds on REQ-009 (registers) and REQ-017 (guided path).

## Why

Auditors do not grade a folder of policies. They ask to see living systems: a register with every field filled in, a review date on every policy and plan, and evidence that the provider runs the system (minutes, signed checklists, supervision notes). Our pack gives the policies; our registers give incidents, complaints, worker checks and policy reviews. The registers below are the ones an auditor asks for next, and small providers most often do not have them.

## Scope (all on the AUD 39/month plan, same append-only pattern and plain-words voice as REQ-009)

FR-1 Corporate risk register. One row per risk. Fields: risk area (fixed list: emergency and disaster, participant-related, compliance, people and staffing, organisational sustainability, governance, finance, legislation change, data and privacy), what could happen, likelihood (low, medium, high), what we do about it (controls), owner, review date. Pre-filled on first open with one plain-words starter row per area drawn from the provider's questionnaire answers, each marked "check this and change it", so a sole trader never faces an empty table.

FR-2 Participant risk register. One row per participant: initials or code (no full names: REQ-009's no-participant-personal-data-by-schema rule, the `participant_ref` pattern and the NDIS-number CHECK in D-901's migration), risk, what we do, review date. Linked from the participant's support plan review reminder.

FR-3 Conflict of interest register. Staff and participants. Fields: who, the conflict in plain words, how it is managed, declared on, review date. Our conflict-of-interest policy already names this register by its canonical record name, whether or not the provider subscribes. (The sentence that stood here, a "where the register is kept" blank auto-filling to "Readyline registers" on the plan, was never built and is struck; PO decision 15 Oct 2026, retro review finding 4.)

FR-4 Delegations register. Each key role (owner or director, key management personnel, incident reporter, complaints contact, finance approver, worker screening checker) with the person, their backup, and what the backup may do when the person is away.

FR-5 Insurances and vehicles register. Public liability, professional indemnity, workers compensation and any other policy: insurer, policy number (optional), expiry; vehicles used for participant transport: rego expiry, insurance expiry, driver licence expiry per driver. Reminders 30 and 7 days before each expiry and on the day (email only, same rule as REQ-009).

FR-6 Continuous improvement register. Fields: what we learned from, what we changed, who, done by date, done on. Every closed reportable incident and every closed complaint offers one tap to add a row with the source pre-filled. Survey and feedback can be added by hand.

FR-7 Record of decisions. A dated list of decisions with who decided, for governance evidence. A sole trader can use it alone; a board uses it as minutes. Each entry is one short line plus an optional note.

FR-8 Staff matrix. One row per worker, joined to the worker-check register by worker code (the row is typed; the status view reads the worker's checks): qualifications, mandatory training (NDIS worker orientation module, first aid, manual handling, medication where relevant) with expiry, worker screening clearance expiry, risk-assessed role flag, last supervision date, last appraisal date, onboarding checklist signed on. Reminders: supervision monthly, appraisal yearly, training expiries (the monthly and yearly cadences are Readyline's suggestion; the Practice Standards ask for timely supervision and documented performance management and set no interval).

FR-9 Onboarding checklists. Two short checklists (new worker, new participant) in the same instruction voice as the readiness checklist, each item tickable with the date and the name of who ticked it; a completed checklist is the "signed and dated" evidence an auditor asks for. The worker checklist feeds the staff matrix's onboarding date.

FR-10 Reminders added: support plan review (per participant, date set by the provider), emergency drill (every 6 months, Readyline's cadence; the Practice Standards require emergency and disaster plans and set no drill interval), each register's review date. Same email-only rule.

FR-11 Audit-day page. Add "What the auditor will ask to see", one line per item with the state of our matching register (filled, missing fields, overdue review) and a tap to fix. Name the audit types in plain words: provisional, first audit with participants (auditors talk to participants), mid-term, renewal, and conditional (the Commission sets conditions and re-checks).

FR-12 Pricing page (batch 49 item 2 moves the sentence to the registers page intro). One plain sentence that the registers are linked (an incident becomes an improvement row, a worker check becomes a staff-matrix row) and send the reminders, which a spreadsheet does not.

## Security and privacy

SR-1 Append-only and tenant-scoped like REQ-009; revoke update on the new event tables; integration tests assert 42501.
SR-2 Participant rows store initials or a code, never a full name (the per-tenant "full names on" option that stood here until 15 Oct 2026 is struck: CLAUDE.md 4.5 forbids participant personal information and the `participant_ref` CHECK refuses a name).
SR-3 No document uploads in this REQ (insurance certificates stay on the provider's own files; we store dates only).

## Acceptance

AC-1 Each register opens with no empty required field for a newly subscribed provider (starter rows or a guided "add your first row" step), passes copy-lint, and the iPhone and android-small projects show no sideways scroll and no letter-by-letter table wrapping.
AC-2 Closing a reportable incident shows the one-tap improvement row and the row appears in the register with the source link.
AC-3 Reminders job tests cover every new reminder kind with the fixed dates in the fixtures.
AC-4 The audit-day page lists the twelve items above (thirteen with the hazard register once REQ-020 FR-7 is on main, D-2236) with live states, and the five audit types appear in the plain-words glossary.

## Out of scope

Document uploads, participant full records, rostering, payroll, training delivery.
## Added 14 Oct 2026 (PO, after the webinar research in `product/research/webinars/2026-10-14-what-auditors-look-for.md`)

FR-13 Document control register. Generated from the pack itself, no typing: one row per document with title, version, adopted on, adopted by (role), next review date, and whether the latest version was circulated to workers (ticked in the Adopt step). Shown first in the registers list and exported as the first page of the readiness summary from the adoption re-render on (the first generation has nothing adopted and no such page). Changes when a document is re-generated or re-adopted.

FR-14 Policy circulation record. When a provider adopts a document in the Adopt step (REQ-017), they tick which workers were walked through it and when; the record is appended to the document control register row. Auditors ask how workers were told about a policy; this is the evidence.

AC-5 A newly adopted pack shows a complete document control register with no empty cells and a next review date 12 months from adoption; re-adopting one document updates only its row.

Source note: the register list in this REQ matches section B of the research file; the five gaps in section D map to FR-1, FR-2, FR-6 and REQ-005's incident, complaints, risk, restrictive practice and worker screening briefs (batch 40).

## Delivery evidence (standing backlog 4, Dev, 14 Oct 2026; branch `req-018-register-tests`, D-1908)

Register tests, reminder fixtures, the docx lint in CI and the Playwright retry policy. The branch starts from `req-011-guides-2` with `req-018-audit-day-systems` merged in (two code conflicts resolved: the iPhone project's spec list is the union; the registers index keeps batch 42's two groups and D-549's codes panel, adds the nine REQ-018 registers to them, and shows the document control register first under its own heading, FR-13).

- **SR-1 and SR-2, every register (`tests/integration/audit-day-rls.test.ts`).** Existing: a subscribed member inserts and reads one row in each of the eight editable registers, the other tenant and the anonymous key read nothing, a forged insert fails; decisions, onboarding ticks and register events take an insert and refuse an update with 42501. Added: every editable register takes the owner's update and gives the other tenant's update zero rows with no error (RLS hides the row rather than confirming it exists), read back with the admin key; the three append-only tables are read by their own tenant only; the corporate risk starter rows are seeded once for a fresh tenant (nine rows, one per area, all marked starter, owner role from the reference case), a second seed inserts nothing, and the other tenant sees none.
- **AC-3, reminder fixtures.** `fixtures/reminders/<kind>.json`, one per entry in `REMINDER_KINDS` (thirteen: the seven REQ-009 kinds and the six REQ-018 kinds), each with fixed dates around 13 October 2026, a note saying why it fires, and the exact rows `dueReminders` must return. `src/lib/registers/reminder-fixtures.test.ts` fails on a kind without a fixture, a fixture without a kind, or any drift in the offsets. The integration test `reminders-job.test.ts` already seeds the same eleven firing kinds into a real stack with the fixed date.
- **The docx lint over the full pack in CI.** The sole-trader set is the 16-document pack (fifteen documents and the self-assessment); `docx-lint.test.ts` already renders it from the skeletons and replays it through the recorded fixtures, and now pins the count. The main CI job runs that test by name after `npm test` with the report printed and uploaded, so it no longer depends on the LibreOffice job's trigger.
- **Playwright flake triage.** Global retries are now zero in CI. Three signed-in specs keep one CI retry each, with the race written above the configure call: the purchase flow (webhook `after()` hook and the job route landing in either order), the guided path (the "wait" step written by the webhook while a cold runner compiles the job route) and the subscription (the payment-failed event applied after the page moved on). Every WebKit race found so far is handled inside the tests (settled goto, tap and fill retries, end-of-page wrap), so a red run on the other specs is a defect.
- **Not run here.** The hosted Supabase project lacks the REQ-018 migrations, so the integration file cannot run on this machine; the unit suite, lint, format and typecheck are green, and CI's Supabase job is the gate for the integration cases when the PO re-runs it.

## PO review notes

- 15 Oct 2026: the strike of SR-2's per-tenant "full names on" clause is confirmed (retro review `product/qa/req-reviews/2026-10-15-retro-req-018-021.md`, finding 14). FR-3's auto-fill sentence is struck (finding 4).

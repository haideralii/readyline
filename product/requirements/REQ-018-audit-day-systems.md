# REQ-018 Audit-day systems: the registers an auditor asks for

Status: approved by PO, 14 Oct 2026. Source: PO review of the Effective Policy webinar "How To Ace Your NDIS Audit" (Gina Ingrouille, April 2024) checked against the NDIS Practice Standards and the Commission's provider obligations. Builds on REQ-009 (registers) and REQ-017 (guided path).

## Why

Auditors do not grade a folder of policies. They ask to see living systems: a register with every field filled in, a review date on every policy and plan, and evidence that the provider runs the system (minutes, signed checklists, supervision notes). Our pack gives the policies; our registers give incidents, complaints, worker checks and policy reviews. The registers below are the ones an auditor asks for next, and small providers most often do not have them.

## Scope (all on the AUD 39/month plan, same append-only pattern and plain-words voice as REQ-009)

FR-1 Corporate risk register. One row per risk. Fields: risk area (fixed list: emergency and disaster, participant-related, compliance, people and staffing, organisational sustainability, governance, finance, legislation change, data and privacy), what could happen, likelihood (low, medium, high), what we do about it (controls), owner, review date. Pre-filled on first open with one plain-words starter row per area drawn from the provider's questionnaire answers, each marked "check this and change it", so a sole trader never faces an empty table.

FR-2 Participant risk register. One row per participant: initials or code (no full names by default, D-9xx privacy rule), risk, what we do, review date. Linked from the participant's support plan review reminder.

FR-3 Conflict of interest register. Staff and participants. Fields: who, the conflict in plain words, how it is managed, declared on, review date. Our conflict-of-interest policy already says this register exists; the policy's "where the register is kept" blank auto-fills to "Readyline registers" when the provider is on the plan.

FR-4 Delegations register. Each key role (owner or director, key management personnel, incident reporter, complaints contact, finance approver, worker screening checker) with the person, their backup, and what the backup may do when the person is away.

FR-5 Insurances and vehicles register. Public liability, professional indemnity, workers compensation and any other policy: insurer, policy number (optional), expiry; vehicles used for participant transport: rego expiry, insurance expiry, driver licence expiry per driver. Reminders 30 and 7 days before each expiry (email only, same rule as REQ-009).

FR-6 Continuous improvement register. Fields: what we learned from, what we changed, who, done by date, done on. Every closed reportable incident and every closed complaint offers one tap to add a row with the source pre-filled. Survey and feedback can be added by hand.

FR-7 Record of decisions. A dated list of decisions with who decided, for governance evidence. A sole trader can use it alone; a board uses it as minutes. Each entry is one short line plus an optional note.

FR-8 Staff matrix. One row per worker, built from the worker-check register: qualifications, mandatory training (NDIS worker orientation module, first aid, manual handling, medication where relevant) with expiry, worker screening clearance expiry, risk-assessed role flag, last supervision date, last appraisal date, onboarding checklist signed on. Reminders: supervision monthly, appraisal yearly, training expiries.

FR-9 Onboarding checklists. Two short checklists (new worker, new participant) in the same instruction voice as the readiness checklist, each item tickable with the date and the name of who ticked it; a completed checklist is the "signed and dated" evidence an auditor asks for. The worker checklist feeds the staff matrix's onboarding date.

FR-10 Reminders added: support plan review (per participant, date set by the provider), emergency drill (every 6 months), each register's review date. Same email-only rule.

FR-11 Audit-day page. Add "What the auditor will ask to see", one line per item with the state of our matching register (filled, missing fields, overdue review) and a tap to fix. Name the audit types in plain words: provisional, first audit with participants (auditors talk to participants), mid-term, renewal, and conditional (the Commission sets conditions and re-checks).

FR-12 Pricing page. One plain sentence that the registers are linked (an incident becomes an improvement row, a worker check becomes a staff-matrix row) and send the reminders, which a spreadsheet does not.

## Security and privacy

SR-1 Append-only and tenant-scoped like REQ-009; revoke update on the new event tables; integration tests assert 42501.
SR-2 Participant rows store initials or a code, never a full name, unless the provider turns full names on per tenant and the setting is logged.
SR-3 No document uploads in this REQ (insurance certificates stay on the provider's own files; we store dates only).

## Acceptance

AC-1 Each register opens with no empty required field for a newly subscribed provider (starter rows or a guided "add your first row" step), passes copy-lint, and the iPhone and android-small projects show no sideways scroll and no letter-by-letter table wrapping.
AC-2 Closing a reportable incident shows the one-tap improvement row and the row appears in the register with the source link.
AC-3 Reminders job tests cover every new reminder kind with the fixed dates in the fixtures.
AC-4 The audit-day page lists the twelve items above with live states, and the five audit types appear in the plain-words glossary.

## Out of scope

Document uploads, participant full records, rostering, payroll, training delivery.

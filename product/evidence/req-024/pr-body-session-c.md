# REQ-024 Session C: keeping it current (supervision, the derived states, the import, ending a worker, the pack's period)

Branch `req-024-session-c`, stacked on `req-024-session-b` (bec2c93) with `next` b603ec2 under it, into `next`. Dev-1, 18 Oct 2026.

## What this PR does

- **FR-11, supervision rows.** Migration `20261017140000_worker_supervision_c.sql`: `supervision_entries` (kind: supervision, probation review, conversation; held on; the supervisor's code; a note of what was covered for the first two kinds, an outcome code and no note for a review, as two CHECKs; RLS as every register; revoke then grant), a trigger that keeps `staff_matrix.last_supervision_on` the latest `held_on` of any kind on insert, update and delete (D-2829), and the `register_events` and `imports` CHECKs widened. The owner's Supervision section on a staff row: the history newest first and one add form (today at most, the D-2833 helper under the note, the participant warning). The worker file carries each entry in the pinned columns (AC-9); the account export gains `supervision_entries.csv` and `policy_acknowledgements.csv`.
- **FR-10, the derived states where the owner looks.** One sentence over every current worker's state (D-2411's words) under "Then they ask about your workers" on the audit-day page, as the self-check's staff-matrix live state, and under the checklist's two people items, whose statuses the staff list derives while the account has rows (D-2831).
- **FR-12, ending a worker.** The save that sets `ended_on` writes the `ended` event once and revokes the worker's membership through the owner's own delete policy with the team page's audit line; the staff list keeps current workers under its filters and a "Past workers" section under them; the index, the file and the screening list keep the worker with the end date (AC-10).
- **FR-13, the import.** The staff matrix takes a spreadsheet through REQ-020's import page: the template is the export's columns minus what the system fills, every row through A1's form and the participant detector, a code twice in a file or already on the list handled in words, and each imported row derives its checklist through `afterStaffMatrixSave`; nothing of a checklist is imported (D-2402). Undo takes untouched derived checklists with it.
- **The period and the pack (after REQ-023 B).** `PERIOD_COLUMNS` gains `supervision_entries: held_on`; the pack filters the entries by its period and the Rules lists speak as at a custom period's end day (D-2832); one builder serves the owner's pack and the auditor link's pack (D-2407).

## Tests

- Unit: `supervision.test.ts` (the form per kind, the words, the derivations), `worker-states-line.test.ts` and `checklist/worker-states.test.ts` (FR-10), `import.test.ts` (the staff matrix round trip, the refusals, the duplicate code), `worker-exports.test.ts` (AC-9's rows, the pack's columns with an entry), the copy, class and boundary lints.
- Integration (the Supabase job): `tests/integration/worker-supervision-c.test.ts` (the trigger's three cases, eight CHECK refusals, RLS for a stranger and a worker, the widened CHECKs), `worker-ending-c.test.ts` (AC-10: the event once, the membership revoked, the rows kept, past workers in the exports); the grants map gains the table.
- E2E (the Supabase job): `e2e/signed-in/worker-supervision.spec.ts` on `desktop-chromium`, `android-small` and the iPhone project.

## Decisions

D-2283 to D-2286 in `DECISIONS.md`; the PO's D-2829 to D-2833 applied as written.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

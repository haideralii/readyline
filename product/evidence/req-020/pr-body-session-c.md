# REQ-020 Session C: the hazard register, spreadsheet imports and the quarterly self-check

Base: `next`. Branch: `req-020-session-c` (cut from `next` at 5866b4a; independent of Sessions A and B, so it can merge in any order with them).

## What this delivers

- **FR-7 Hazard and WHS register.** `/registers/hazards`: one row per hazard with where (a site or vehicle code, never an address), what, who it could harm, how likely and how serious (the corporate risk scales), what we did, done by, done on and a review date. Linked from the incident page ("Was a hazard behind this? Add it to the hazard register") and from the corporate risk register. The register-review reminder covers it (14 days before and on the day). It is the thirteenth line on the audit-day page's "What the auditor will ask to see", with its live state.
- **FR-8 and FR-12 CSV import.** "Import from a spreadsheet" on incidents, complaints, worker checks and corporate risks, with a downloadable empty template per register. The preview lists every row's result; rows that pass are imported with one `imported` line each in the trail and one audit line per import with the counts; rows that fail are listed with the row number and the reason. A file whose columns do not match, or more than half of whose rows fail, is refused whole. The owner can undo an import for one hour. Limits: 500 rows, 1 MB, five imports an hour.
- **FR-9 Quarterly self-check.** "Check my systems" on the audit-day page, due every three months and on demand: one screen per record with its live state and one plain question, yes or no with a note. Every "no" becomes an improvement row (source `self-check`, due in 30 days). The walk ends with the count and the next date; the audit-day page shows the last walk and its open findings.

## Tests

- Unit: `src/lib/registers/import.test.ts` (parser, template, preview, the half rule, limits, undo window), `self-check.test.ts` (questions, dates, offer, findings, summary), `audit-day-ask.test.ts` (the thirteenth line and its states).
- Integration (CI's Supabase job): `tests/integration/req-020-session-c-rls.test.ts`; `reminders-job.test.ts` gains the hazard's register-review reminder (AC-6).
- E2E (three projects): `e2e/signed-in/records.spec.ts` (hazard from an incident, audit-day state; import preview, commit, the row's trail, undo, a wrong-column file refused; the self-check walk with two findings and the audit-day line); `guided-path.spec.ts` now expects 13 records.

## Decisions and evidence

- D-2236 in `DECISIONS.md`; ASVS rows under "REQ-020 Session C additions" in `product/security/asvs-l1-check-2026-10-14.md`.
- The Delivery evidence paragraph in `product/requirements/REQ-020-registers-audit-pack.md`.
- Migration `supabase/migrations/20261015060000_hazards_imports_self_checks.sql` (first real run is this PR's Supabase job).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

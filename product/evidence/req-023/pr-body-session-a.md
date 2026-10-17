# REQ-023 Session A: the registration timeline

Base: `next`. Branch: `req-023-session-a` (cut from `next` at c2c6ff8, after #72).

## What this delivers

- **FR-1 "Your registration".** The form on the account page: the period's start and end dates typed from the certificate, the audit type, an optional date the Commissioner allowed or set for the mid-term audit with its source (a certificate condition or a letter), the last-audit and mid-term dates. The owner's save writes the first `registration_periods` row (D-2312), derives whether the mid-term audit applies from the audit type and the questionnaire's reading of the classes, mirrors the two `accounts` columns the existing readers use, writes one audit line per changed field and clears the unsent timeline reminders through an owner-only function.
- **FR-2 The timeline.** One pure module (`src/lib/registers/timeline.ts`): every row with its date and its source word ("our suggestion", "Rules s 13B", "your certificate's conditions", "the Commissioner's letter", "NDIS Act s 73K", "your certificate"), the position sentence in its five forms, the fixed sentence under the table. The account page shows the table and the sentence; the audit-day page shows the legal rows, the period end and the done dates only (D-2314); the registers page links to the timeline instead of its own date; the periods join the account export.
- **FR-3 The five reminders.** `midterm-prepare`, `midterm-start-by`, `renewal-window`, `renewal-apply-by`, `renewal-last-call`, as lines in the nightly register email with the fixed sentence once; the period row is the subject, so each kind goes once per period; the last call is withheld when the period end changed inside the window or an application is recorded; they stop on a cancelled subscription and stay on through a pause (D-2313); one audit line per send. The two old kinds, their fixtures and the three-year constants go; the migration deletes their unsent rows.
- **FR-4 Dated checklist items.** `checklist_items.done_on` and three dated audit items ("Type the date your mid-term audit started", "... you applied for renewal", "... your renewal audit was done") that replace the first-audit booking and mid-term calendar items once a period exists; a date sets Done.

## Tests

- Unit: `src/lib/registers/timeline.test.ts` (AC-1 with the fixed clock), `reminders.test.ts`, the five fixtures through `reminder-fixtures.test.ts`, `src/lib/checklist/derive.test.ts`.
- Integration (CI's Supabase job): `tests/integration/registration-periods.test.ts` (RLS, the CHECKs, the clear function), `reminders-job.test.ts` (the prepare line, the fixed sentence, the audit line).
- E2E (three projects): `e2e/signed-in/account-setup.spec.ts`, "the registration timeline" (the form, the rows, the audit-day copy, the registers link, the dated checklist item).

## Decisions and evidence

- D-2243 in `DECISIONS.md`; ASVS rows under "REQ-023 Session A additions" in `product/security/asvs-l1-check-2026-10-14.md`.
- The Delivery evidence paragraph in `product/requirements/REQ-023-renewal-readiness.md`; the sources in `product/research/ndis-watch/2026-10-16.md`.
- Migration `supabase/migrations/20261016010000_registration_periods.sql` (first real run is this PR's Supabase job).
- Not built here, said in D-2243: the change-of-ownership row and item (Session D's register) and the application-inside-the-window test (Session C's FR-7 date).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

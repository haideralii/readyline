# REQ-032 Session A: public holidays in the business-day count

PR into `next`, branch `req-032-session-a` from `next` 5d6cea7 (with `next` 4f920f3 merged before the push, D-2827). Dev-1, 18 Oct 2026. Head: 807421d.

## What this PR does

- **FR-1, the table (D-2914, D-2915).** `data/public-holidays/2026.json` and `2027.json`, one row per holiday and jurisdiction, typed from the eight state and territory government pages on 18 October 2026; `source.json` names each page with its read date and copyright line, the retired data.gov.au dataset (the REQ's source: "[INACTIVE]", 2019 to 2025, its record points to the eight pages), the Acts Interpretation Act 1901 s 2B definition with its compilation (No. 39, 28 March 2026), what was left out (part-day, regional and public-service-only days, the NSW Bank Holiday) and the two UNVERIFIED rows. The loader refuses a row outside the closed list (SR-2). The migration `20261018200000_public_holidays.sql` creates `public.public_holidays`, read-only to the client roles (RLS, revoke then grant select, D-2245), seeded with the fixture's rows through `scripts/holidays/seed.mjs`; `seed.test.ts` holds the migration and the fixture equal. `standards.meta.json` records the definition and the two Rules checked (neither defines the term).
- **FR-2, FR-3, the count (D-2916).** `addBusinessDays(date, days, states)` in TypeScript and `add_business_days(p_date, p_days, p_states)` in SQL skip weekends and the holidays that are holidays in every one of the account's states; the two-argument forms stay as the weekends-only count. `incident_notify_by` gains the same argument with its four-argument wrapper. The ISO date helpers move to `iso-date.ts` (re-exported from `status.ts`) so the table and the status rules share them. AC-2's parity: `add_business_days_range` answers every day of 2026 and 2027 in one call per state set, compared with TypeScript for NSW, {NSW, VIC} and no state.
- **FR-4, the derived date (D-2917).** `incidents.notify_by` becomes a plain column kept by a trigger on save (the row and the account's states) and `recompute_incident_notify_by(account)`, which the reminders job calls once per account each run, so a holiday added to the table moves the date; only rows whose date moves are written. The status view is recreated around the column; the one-time fill leaves `updated_at` alone. The job passes the account's states to the complaint and role-assessment lines.
- **FR-5, the bracket (D-2921).** One helper, `notify-by-line.ts`: "13 Apr 2026 (Good Friday and Easter Monday do not count)" on the register list's status label, the row page's fact, the account page's due-soon line, the incident form's preview (owner's and worker's) and the auditor's web view. The 24-hour kinds carry none (D-2920).
- **FR-6, the year runs out (D-2918).** Past the table's last year the count is weekends only and the bracket reads "(public holidays after 2027 are not yet counted)"; `public-holidays.test.ts` fails from 1 October 2027 until 2028's file is added.
- **FR-7, the documents (D-2919).** "A business day is not a Saturday, a Sunday or a public holiday in the state where we work." once in the incident management policy (after the escalation table) and once in the safeguarding policy (after the restrictive-practice steps); pinned verbatim in `legal-copy.test.ts`, the render checked in `business-day-sentence.test.ts`; the structure snapshot moved by that paragraph and was reviewed.

## Notes for the PO

- The dataset the REQ named is retired; the fixture's provenance is the eight government pages, each with its URL and read date, as the Dev response proposed (option (a)).
- Victoria's 2027 Grand Final Friday has no date yet ("Subject to AFL schedule"); the row is absent and marked UNVERIFIED in `source.json`, so a Victorian count across late September 2027 may read one business day short until it is published.
- The audit pack's CSV keeps the plain date in `notify_by`; the bracket is on the screens (D-2299). Say if the CSV should carry it too.
- AC-3: the reminders integration fixture's dates (a complaint received 8 October 2026, due 12 October) cross no holiday, so no expected date changed and the count is unchanged.

## Verification

- `npm run check`: lint, format, typecheck green; 193 test files, 1,390 tests passed, 6 skipped.
- From the main tree's production build of the head, on desktop and Android: `home-v2`, `req-025`, `req-013-p2`, `req-015-a11y` and `health` on desktop-chromium and android-small, 28 passed in 1.7 min.
- Unit: `public-holidays.test.ts` (FR-1 counts and dates, SR-2, FR-2, FR-3's AC-1 dates, FR-5 words, FR-6, D-2918), `notify-by-line.test.ts`, `status.test.ts`, `reminders.test.ts` (the states case), `due-soon.test.ts` (the bracket case), `worker.test.ts` (the aware sentence with states), `seed.test.ts`, `business-day-sentence.test.ts`, `legal-copy.test.ts`'s pin.
- Integration (the Supabase job): `tests/integration/public-holidays.test.ts` (the table's rows and grants, AC-2's parity over 730 days and three state sets, AC-1's dates on saved rows, the trigger on update, the recompute and its grant).
- E2E (the Supabase job): `e2e/signed-in/req-032.spec.ts` AC-1's four cases on desktop and Android (the form's preview, the row's fact, the database's date); `registers.spec.ts` now counts NSW's holidays in its expected date.
- AC mapping: AC-1 `req-032.spec.ts` and the integration case; AC-2 the integration parity; AC-3 the reminders job test unchanged (no fixture crosses a holiday); AC-4 `public-holidays.test.ts`; AC-5 `legal-copy.test.ts` and `business-day-sentence.test.ts`; AC-6 `npm run check` and the a11y spec unchanged.

## Evidence

- `product/evidence/req-032/pr-body-session-a.md` (this file). Screenshots of AC-1 come from the CI run's artefacts (the signed-in job).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

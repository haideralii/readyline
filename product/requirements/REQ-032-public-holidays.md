# REQ-032: Public holidays in the business-day count

Status: ready for Session A (PO, 18 Oct 2026 20:20; lawyer's and NDIS expert's reads applied as D-2914 to D-2921, D-2222)
Phase: 6   Priority: should   Owner: Dev (one session, Dev-1)

## Why (user and business outcome)

- Every statutory window Readyline counts in business days skips Saturday and Sunday only; public holidays are not modelled (REQ-009, D-2244 "said, not built"; `add_business_days` in SQL and `addBusinessDays` in `src/lib/registers/status.ts`). The provider sees a notify-by date that can be a day or two early around Easter, Christmas and a state holiday, and the reminder email fires the same day. Early is the safe side, but a provider who plans a Commission report around a wrong date loses trust in every date we show.
- The Rules read "business day" with the Acts Interpretation Act 1901 s 2B meaning: a day that is not a Saturday, a Sunday or a public holiday in the place concerned (lawyer, D-2914; Dev verifies the section against legislation.gov.au and records the read date).

## Scope

In: the 5-business-day windows (Incident Rules ss 20 and 21: the unauthorised restrictive practice notification, the 5-day full report line), the complaint acknowledgement at 2 business days (our own number, REQ-009), the Worker Screening Rules s 17(2)(b) 20-day and 10-day lines (REQ-024 FR-6a), the reminders job, the register status views and the auditor's view, the incident register's "notify by" text, the generated documents' fixed timeframe sentences where they name a date rule.

Out: the 24-hour windows (calendar time, unchanged); any time-of-day; substituted holidays we cannot source; local (council) holidays; the questionnaire; the price.

## Functional requirements

- **FR-1 Holiday table.** A fixture `data/public-holidays/<year>.json` for 2026 and 2027 from the Australian Government's machine-readable public holidays dataset on data.gov.au (CC BY 4.0), one row per holiday with date, jurisdiction (NSW, VIC, QLD, SA, WA, TAS, ACT, NT) and name, plus `source.json` with the dataset URL, licence and the date Dev read it. A unit test pins the row count per jurisdiction and year and a handful of known dates (1 January, 26 January, Good Friday, 25 December, and one state-only day per state). The same rows go into a table `public.public_holidays (holiday_date date, jurisdiction text, name text)` by migration, seeded by the migration from the fixture, read-only to `authenticated` (revoke-then-grant, D-2245), so SQL and TypeScript count the same days (NDIS expert, D-2915).
- **FR-2 The place concerned.** The holidays that count are those of the account's `states`. With one state, that state's holidays. With more than one, a day counts as a holiday only when it is a holiday in every one of those states (national days and shared days), so the date we show is never later than the true date in any of them (lawyer, D-2916: the safe side when the place is unclear). With no state recorded, weekends only, as today.
- **FR-3 One function.** `add_business_days(p_date, p_days, p_states text[])` in SQL and `addBusinessDays(date, days, states)` in TypeScript, both skipping weekends and the FR-2 holidays; the two-argument forms stay as thin wrappers that pass no states, so nothing else changes until the caller passes them. A unit test and an integration test assert the two give the same answer for every day of 2026 and 2027 for NSW alone, for `{NSW, VIC}` and for no state.
- **FR-4 Callers.** `incident_notify_by`, the status views, `reminders.ts` and the register pages pass the account's states. A row's notify-by date is computed when the row is saved and recomputed by the reminders job each run from the same inputs, so a holiday added to the table moves the date (D-2917: the date is derived, never stored as the truth).
- **FR-5 What the provider sees.** Where a window landed on a public holiday, the date line adds, in brackets, the holiday that moved it: "notify by Monday 13 April 2026 (Good Friday and Easter Monday do not count)". One sentence, no second line. The auditor's view carries the same date and the same bracket.
- **FR-6 The year runs out.** For a date past the last year in the table, the count falls back to weekends only and the line reads "(public holidays after 2027 are not yet counted)". A unit test in `workflows.test.ts` or the NDIS-watch list fails from 1 October of the last year in the table, so the next year is added before it is needed (D-2918).
- **FR-7 Documents.** The fixed timeframe sentences in `fixed-extras.ts` that say "within 5 business days" gain, once per document where the first such sentence appears, the Acts Interpretation Act meaning in plain words: "A business day is not a Saturday, a Sunday or a public holiday in the state where we work." No other wording changes (D-2919).

## Security and privacy

- SR-1 The table holds no account data; RLS select for `authenticated` and `service_role` only; no insert, update or delete except by migration.
- SR-2 The fixture is data, not instructions: the loader validates each row's date and jurisdiction against the closed list and refuses the file otherwise.

## Acceptance criteria

- AC-1 An unauthorised restrictive practice recorded on Thursday 2 April 2026 by an NSW account shows notify by Monday 13 April 2026 (Good Friday 3 April and Easter Monday 6 April do not count), with the FR-5 bracket; the same row for a `{NSW, WA}` account shows the same date (both days are national); a `{NSW, VIC}` account recorded on Friday 30 October 2026 shows Friday 6 November 2026 (Melbourne Cup Day is Victoria's alone, so it counts as a business day under FR-2), where a VIC-only account shows Monday 9 November (e2e, desktop and Android).
- AC-2 FR-3 parity test green for both years and three state sets.
- AC-3 The reminders integration test's expected dates updated for the fixtures that cross a holiday; count of reminders unchanged.
- AC-4 FR-6 fallback line appears for a date in 2028; the year-runs-out test fails when the clock is set to 1 October 2027.
- AC-5 `legal-copy.test.ts` pins the FR-7 sentence; docx render of the incident management policy carries it once.
- AC-6 `npm run check` green; a11y spec unchanged.

## Lawyer's read (D-2914, D-2916, D-2919, D-2920)

Business day is defined in the Acts Interpretation Act 1901 s 2B and applies to the Rules as legislative instruments (Legislation Act 2003 s 13) unless the Rules define it otherwise; Dev checks the Incident Rules and the Worker Screening Rules for their own definition before building and records the result in `standards.meta.json`. "The place concerned" is not defined further; counting a holiday only when it is one in every state the provider works in gives a date that is never later than the law's in any of those states (D-2916). The FR-7 sentence states the definition without quoting the Act, which is not legal advice (D-2919). D-2920: nothing in this REQ changes a 24-hour window; "24 hours" stays calendar time, and the incident form's help text stays as it is.

## NDIS expert's read (D-2915, D-2917, D-2918, D-2921)

An auditor checks a notification against the Commission's own calendar; a provider whose register shows a date later than the Commission's would be late, so the safe-side rule (D-2916) and the derived date (D-2917) are the right shape. The dataset on data.gov.au is the one government source that covers all eight jurisdictions in one file; it is published a year ahead, so the 1 October check (D-2918) leaves three months. D-2921: the bracket in FR-5 names the holiday because an auditor asked "why the 13th" should see the reason on the row, not in a help page.

## Delivery evidence

(Dev appends: branch, commits, test counts, screenshots of AC-1 on desktop and Android.)

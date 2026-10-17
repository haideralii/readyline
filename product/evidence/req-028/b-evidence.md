# REQ-028 Session B: delivery evidence

Dev, 17 Oct 2026. Branch `req-028-session-b` from `next` c987d20 (A1 and A2 in), PR #95 into `next`, with `next` c987d20 merged in before the last commit. The session's scope is FR-7 (documents, the audit pack and the registers on a laptop), FR-8 (the register tables), FR-9 (the checklist) and the empty states; the public flow (FR-5, FR-6, FR-10, FR-11) is Session C's. The Dev's calls are D-2275 in `DECISIONS.md`.

## Commits

| # | Commit | What |
| --- | --- | --- |
| 1 | 04e3c81 | `RegisterTable` and the columns as data: `table-columns.ts` (one `ColumnSpec` list per register, `cellsFor`, `formatShortDateAu`), the ten lists on `RegisterMeta.columns`, the four named exported; `register-table.tsx`; the unit tests (allow-list, forbidden keys, the planted name, the table's rendering) |
| 2 | 5e5b07f | The fourteen register pages on the table with their cards under it; `RegisterPage`'s header row with FR-7's export labels; the empty state with the primary and the import link, the header's actions stepping aside at 0 |
| 3 | bfc37a4 | The registers index: the pack button as the primary with "Last downloaded", the "What is in the pack" disclosure, the ready line "N of 15 registers started", the groups as two-column cards |
| 4 | e731e3c | Documents: the set page's header row with the zip as the primary and the count-and-size line (`zipSizeLine`, `setZipSize`), the two-column body, the list rows with the `Tag`, the version and the `.docx` link; the documents page's ready state the same; the reader's sticky aside with the section list |
| 5 | d2945bc | The checklist's 4 + 8: the ready line with the progress line as its live sentence (`ReadyLine` gains `sentenceTestId` and `live`), the next three and the print control sticky, the note and the groups right |
| 6 | 33f1c5f | `e2e/helpers/registers-seed.ts` and `e2e/signed-in/req-028-b.spec.ts`; `guided-path.spec.ts` reads the documents pages' primary and line |
| merge | (none needed: `next` stayed at c987d20, the branch's base) | `next` c987d20 merged in |
| 7 | (this) | The evidence and D-2275 |

## Acceptance criteria in B's scope

| AC | Test | Level | Result |
| --- | --- | --- | --- |
| AC-6 (documents) | `e2e/signed-in/guided-path.spec.ts` where it reaches a ready set: one `btn-primary` "Download all as one file (zip)" on the documents page and on the set's page with the count-and-size line beneath, the `.docx` link named for its document | e2e, Supabase job | on #95's run |
| AC-6 (the index) | `e2e/signed-in/req-028-b.spec.ts` "the index": the primary "Download my audit pack as one file (zip)", "Not downloaded yet" then "Last downloaded <day>" after one download through the request context, the disclosure's kinds | e2e, Supabase job | on #95's run |
| AC-6 (the table) | `req-028-b.spec.ts` "the incidents table": thirty seeded rows, D-2814's five headers and no other at 1280, the rows newest first, the planted name in no cell of the incidents, complaints and corporate risks tables (D-2815), the cards at 360; `src/lib/registers/table-columns.test.ts` (every list against the allow-list and the forbidden keys; the planted name through every column list); `src/components/register-table.test.tsx` | e2e and unit | unit green in `npm run check`; e2e on #95's run |
| AC-7 | `req-028-b.spec.ts` "an empty register" (the sentence, the primary, the header's actions absent) and the ready line at "0 of 15" then "3 of 15 registers started" | e2e, Supabase job | on #95's run |
| FR-7 (the reader, the register pages' headers) | by the screenshots and the public shell spec; the signed-in screenshots from the Supabase job's EVIDENCE run | screenshots | #95's `signed-in-screenshots` artefact |
| FR-9 | `src/components/ready-line.test.tsx` (the live sentence with its own test id); `e2e/signed-in/checklist.spec.ts` unchanged (`checklist-progress` keeps its id, its text and its live region) | unit, e2e | unit green; e2e on #95's run |

AC-1 to AC-4 and AC-9 were A1's and A2's; AC-5, AC-8 and AC-10 are Session C's.

## Runs

- `npm run check` green on every commit (lint, format, typecheck, unit: 164 files, 1,178 tests at the head).
- A production build from the main tree at every pushed commit with a quick public spec or two (health, the shell, documents, the checklist, the ready line): green each time.
- The whole public set in CI mode on the three projects from a production build of the head: 291 passed, 25 skipped, none failed (5.9 min).
- PR #95's CI: the runs at bfc37a4, e731e3c and d2945bc were cancelled by the next push each time; the run at the head (the evidence commit) is the one to read, the new spec and the four changed signed-in specs on its Supabase job.
- The run at 87b41a0 (39010415976): the new spec green; three older signed-in specs red on the session's own changes (the pack-contents list without an accessible name, the onboarding table's link no longer named "New worker W-1", the documents row's two links making `purchase-flow.spec.ts`'s one-link locator ambiguous), fixed in 7a: the table link's accessible name is the row's title as the card gives it, the list carries `aria-label`, the spec takes the title by name.
- The run at 1cca4a4 (run 39012268206): one line left, the incidents table with a row had no caption or label; 7b names the table by the register's h1 and, on the PO's 18:55 line, names the six narrative-title registers' links by the code with its kind.
- The run at 8d03fed (run 39014005694): the same page's last check, 200% text, found the header's actions column (three controls, `lg:shrink-0`) wider than the shell on a list with a row; 7c lets the actions side shrink and wrap (`min-w-0`, `lg:max-w-[32rem]`) and the header row wrap so the two sides stack when they cannot share it, on the register pages and the set page, and `req-028-b.spec.ts` runs the 200% pass on the incidents page with its rows. The pass checks names before widths, which is why each run surfaced one new line on that page.

## Screenshots (the after set, D-2271 (12))

The public set is unchanged by B (no public page moved), so no new public capture; the signed-in states (the registers index with the pack button and the ready line, the incidents table at 1280 and its cards at 360, the corporate risks table, an empty register, the documents and set pages, the reader with its aside, the checklist's 4 + 8) are the Supabase job's `signed-in-screenshots` artefact on #95: `req-028-b.spec.ts` writes `registers-index-b-*`, `incidents-table-b-*`, `corporate-risks-table-b-*` and `hazards-empty-b-*` under `product/evidence/req-028/`, and the existing specs write their own states.

## New words (for the PO's read; copy is out of scope for the session)

D-2275 (12) lists them: the column labels of D-2814; the empty words ("Not yet", "Not reportable", "Pending", "No expiry", "No date yet", "None", "None recorded", a dash); "Download all as one file (zip)" and the zip line; "Download my audit pack as one file (zip)", "Last downloaded <day>", "Not downloaded yet"; "What is in the pack" and its seven lines; "N of 15 registers started"; "Sections"; the reader's "Not yet adopted. Adopt it on the adopt step once it says what you do."; FR-7's two export labels. No `meta.empty` sentence was re-worded.

## Not in B

The public flow and its heights (C), the Lighthouse re-measure (C), `RegisterTable` on the auditor's page (it keeps `DataTable`, strings only), the hallway test and the VoiceOver note (after C).

# REQ-023 Session C evidence (Dev-2, 18 Oct 2026)

Branch `req-023-session-c`, stacked on `req-023-session-d` at d0051cd (#103 after its run-2 pin fix); commits 41ddb1f (the renewal path, the rehearsal, the sheet and the tick, with the unit, integration and e2e tests), 7bd3fd6 (D-2342, the ASVS rows, the watch entry, the PR body) and this evidence commit as the head; `next` b603ec2 was already in the stack when C was cut and has not moved (D-2827 checked before the push). Migration `supabase/migrations/20261017130000_renewal_path.sql`, its first real run the PR's Supabase job. Built in the Dev-2 worktree (CHAT-2 rule 3); no shared or Dev-1 file is touched: the reminders job needs no change, since `src/lib/registers/reminders.ts` reads the s 73K answer from the period row itself.

## AC mapping

- AC-5, the ten states → `e2e/signed-in/req-023-c.spec.ts` "the ten steps read AC-5's states, in the Commission's order, with one primary action": the certification fixture with its window open a week, two reviews due before the end, no rehearsal and no application reads done, to read, 2 due, not yet, optional, not yet, not yet, not yet, not yet, not yet, in that order, with one `btn-primary` and one h1; the account page's link inside the window, the audit-day page's link, the unticked checkbox on the link form; unit `src/lib/path/renewal.test.ts` on the same input.
- AC-5, the sheet → the same spec's third test: the rehearsal from the path's own link, the walk in rehearsal mode with no "this quarter", one "no" with a code, the done screen's closing line and its way back to the path, no `improvements` row, one `self_checks` row with `mode = rehearsal` and the period, `rehearsal-<today>.csv` in the owner's pack headed "Our own working note, <date>" with the coded note, absent from a plain auditor link's pack and present in a ticked one.
- FR-7, the dated steps → the same spec's second test: the application saved to its column with the s 73K line on the path, the booking refused on a person's-number shape by the server's words and saved with the auditing company's name; the practice lines on the apply screen; `tests/integration/renewal-path.test.ts` on the CHECKs (the order, the name's length, charset and the NDIS-number refusal); unit `timeline.test.ts` on `applicationInsideWindow` and the position sentence.
- FR-8 → unit `self-check.test.ts` (the questions, the two orders, the sheet's heading, file name, columns and ordering, the closing line); the integration test on `self_checks.mode` and the period CHECK.
- FR-9 → by construction (D-2342 (12)); the path's copy module holds no "mid-term" word (the copy lint walks it).
- SR-1 → the schema and CHECK on the name; SR-5 → the worker redirect on both screens and on the walk (the check page's existing gate).
- D-2309 → the integration test on the tick's default and the lookup's new column; the e2e on the two auditor packs.

## Counts

- `npm run check` at 7bd3fd6: green, 173 files (1 skipped), 1,263 tests, 6 skipped.
- The once-a-session full run (D-2319), every public spec in CI mode on the three projects from a production build of 7bd3fd6 in the Dev-2 tree on port 3100: 307 passed, 29 skipped, 2 failed in 17.2 minutes; the two reds are one case of `e2e/req-022-b.spec.ts` ("a malformed or unknown token is a plain 404", desktop and Android), answering 500 because the hosted project the Dev-2 tree reads has no `public.reminder_settings` table (migration `20261017050000_reminder_settings.sql`, REQ-022 Session B, not applied there); not a Session C change, and the PR's job runs every migration. The signed-in spec and the integration test run in the PR's Supabase job, their first run.

## Evidence paths

- The e2e saves `product/evidence/req-023/renewal-path-<project>.jpg`, `renewal-application-<project>.jpg`, `renewal-booked-<project>.jpg`, `rehearsal-start-<project>.jpg` and `rehearsal-done-<project>.jpg` under `EVIDENCE=1` in CI's Supabase job (the signed-in pages cannot be driven locally, D-2205).
- `product/research/ndis-watch/2026-10-18-req-023-c.md`: the two Commission pages NOT RE-READ (timed out 18 Oct 2026); the practice lines rest on the 16 October read.
- `product/evidence/req-023/pr-body-session-c.md`.

## Said, not built (D-2342 (2), (15))

No mark of a "what changed" reading, so that step is always "to read"; the rehearsal keeps the walk's 300-character note; the privacy page is unchanged; the change-of-ownership and variation audits have no step on this path.

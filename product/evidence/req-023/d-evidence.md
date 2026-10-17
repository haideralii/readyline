# REQ-023 Session D evidence (Dev-2, 18 Oct 2026)

Branch `req-023-session-d`, cut from `next` 7728979 (after #97); commits a381499 (the register and everything it joins, FR-2's row, FR-4's item, FR-11's lines), a5511f9 (the tests, the decision, the ASVS rows, the watch entry, the PR body), 35b9b57 (D-2320, the ownership row's line), the merge of `next` 48c978e (D-2827) and this evidence commit as the head. Migration `supabase/migrations/20261017120000_commission_changes.sql`, its first real run the PR's Supabase job. Built in the Dev-2 worktree (CHAT-2 rule 3); the one shared file touched is `src/lib/registers/table-columns.ts`, append-only in a Dev-2 block (D-2317), and Dev-1's columns test gains the register's sample row.

## AC mapping

- AC-6, the result page → `e2e/signed-in/req-023-d.spec.ts` "the result page prompts on the groups and the added state, and writes no row": the groups [0120] in the ready set against [0120, 0115] in the new questionnaire shows the "apply to vary" line with its link; the states [NSW] on the account against [NSW, QLD] shows the conditional Queensland line with the Blue Card and restrictive-practice words and no "you must"; the register holds no row after.
- AC-6, the register's states → the same spec's second test through the form and the row page (a s 13A event known ten days ago that happened yesterday is overdue; a s 13 contact change is to notify; notified in the approved form is notified; "not sure" is told, form not confirmed) and `tests/integration/commission-changes.test.ts` on the view directly, with the variation's three states; unit `commission-changes.test.ts`.
- AC-6, the timeline → the same spec's third test: a change of ownership on the AC-1-shaped certification period adds "Change-of-ownership audit must start by <change + 3 months> (Rules s 13BA)" on the account page and the audit-day page, and the dated checklist item; unit `timeline.test.ts` (the row and its three suppressions) and `derive.test.ts` (the item).
- FR-10, the pack and the auditor link → the same spec's fourth test: `commission-changes-<date>.csv` in the pack with the row's code and no hidden column; the register's table and its records line on the auditor page.
- SR-1, SR-2 → the integration test (RLS for the other tenant and the anonymous key, no forge, no change, no delete; the CHECKs on the kinds, the form answer, the NDIS-number shape in the reference and the note); the import's detector on both fields (`import.ts`).
- FR-10, the governance policy's table → `commission-changes.test.ts` holds the five rows to the 15 October 2026 words; the skeleton snapshot is unchanged.

## Counts

- `npm run check` at a5511f9: green, 170 files, 1,214 tests, 6 skipped.
- The once-a-session full run (D-2319), every public spec in CI mode on the three projects from a production build of a5511f9 in the Dev-2 tree on port 3100: 305 passed, 29 skipped, none failed in 18.9 minutes; two `Invalid Server Actions request` lines in the server log during the run were not a failure. The signed-in spec and the integration test run in the PR's Supabase job, their first run.

## Evidence paths

- Screenshots: the spec writes `product/evidence/req-023/result-changes-<project>.jpg`, `changes-form-<project>.jpg` and `changes-list-<project>.jpg` under `EVIDENCE=1` in CI's Supabase job.
- Decisions: D-2341 in `DECISIONS.md` under "REQ-023 Sessions B to D (Dev-2)" (the heading arrives twice when B and D both merge; one copy stays); the PO's D-2316 to D-2319 in `product/CHAT-2.md`.
- Security: "REQ-023 Session D additions" in `product/security/asvs-l1-check-2026-10-14.md`.
- Sources: `product/research/ndis-watch/2026-10-18-req-023-d.md`.
- PR body: `product/evidence/req-023/pr-body-session-d.md`.

## Said, not built

- FR-6's last line and the sheet's rows for this register (changes notified, variations applied for) read Session B's `what-changed.ts`, not on `next` when D was cut; one small commit once B merges and `next` comes into D.
- The self-check question for the register is a Dev-2 draft for the PO's words, as D-2236's were.
- The variation's "to apply" is a plan with no date; the Rules set none.

## UNVERIFIED

- The Commission's manage-your-registration page, which FR-10's variation helper asks to be re-read when this register ships, timed out on 17 October 2026; the helper keeps the 16 October read.

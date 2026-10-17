# REQ-023 Session B evidence (Dev-2, 17 Oct 2026)

Branch `req-023-session-b`, cut from `next` c343642; five code commits (9e9b918, a87da7c, 3f0b021, 4a1d3ce, 35d5a76) and this evidence commit as the head. No migration. Built in the Dev-2 worktree `../readyline-dev2` (CHAT-2 rule 3); nothing of Dev-1's files was touched (rule 4).

## AC mapping

- AC-3 → `e2e/signed-in/req-023-b.spec.ts`, "the register, its export and the pack filter by the period" (desktop-chromium and android-small): the incidents register under "Since the last audit" shows the later row alone, the export's file name carries `-since-audit-<date>`, the pack's zip name carries it, its incidents file holds the later row and its cover sheet reads "Period shown: Since the last audit"; the pack with no selection shows the whole registration period (`-this-period-from-<date>`, both rows, "Period shown: This registration period"). Unit: `src/lib/registers/period.test.ts` (the closed list, the labels, the suffixes, the filter string).
- AC-4 → the same spec, "what changed since the last audit, on the screen and in the sheet": three documents with their dates, the one due, the incident count 1, the worker line "Checks 1 added (W-1).", and `since-last-audit.csv` from the pack matching each; unit `src/lib/registers/what-changed.test.ts` (the fixture of AC-4, renewals and expiries, the whole-period form with its reason, the sheet's rows).
- AC-8 → the same spec, "a worker opening the new screen lands on their own home": a seeded worker membership, `/path/audit-day/what-changed` answers with `/worker`.
- AC-9 → the same spec: eleven years, `from` after `to`, a non-date and a word off the list each answer 400 "Bad request" on the incidents page and on its export route; the auditor link answers 400 for `period=bogus`. Unit: `src/proxy.period.test.ts` and `period.test.ts`.
- SR-3 → the auditor link's page shows the period-filtered incidents and the period line, its pack link carries the period, and the open's audit line ends ` from:<last-audit date> to:-` (asserted on `audit_log`); `audit-pack.spec.ts`'s `viewer:` regex loses its end anchor.
- SR-5 → AC-8 above; the exports and the pack answer a worker with 404 as before (no account on the viewer).
- Finding 38 → `product/legal/privacy.md` and `src/lib/legal/legal-copy.test.ts` (the sentence pinned, the old one refused, the per-page updated map).

## Counts

- `npm run check` at the head: green, 168 files, 1,213 tests, 6 skipped (new: 40 in `period.test.ts` and `proxy.period.test.ts`, 8 in `what-changed.test.ts`, 1 in `legal-copy.test.ts`).
- The once-a-session full run (D-2319), every public spec in CI mode on the three projects from a production build of 35d5a76 in the Dev-2 tree on port 3100: 290 passed, 25 skipped, 1 failed in 18.5 minutes; the one red was `req-015-width.spec.ts` "/terms fits the screen" on the iphone project, a 30-second test timeout under the full run's load, and the spec alone in CI mode on that project passed straight after (14 passed, 43.9 s); two `Invalid Server Actions request` lines appeared in the server log during the run and were not a failure. The signed-in specs (`req-023-b.spec.ts` and the four REQ-020 and REQ-009 specs the session touches) run in the PR's Supabase job, which is their first run.

## Evidence paths

- Screenshots: the spec writes `product/evidence/req-023/period-incidents-<project>.jpg` and `what-changed-<project>.jpg` under `EVIDENCE=1` in CI's Supabase job (the signed-in pages cannot be driven from the laptop, D-2205).
- Decisions: D-2340 in `DECISIONS.md` under "REQ-023 Sessions B to D (Dev-2)"; the PO's D-2316 to D-2319 in `product/CHAT-2.md`.
- Security: "REQ-023 Session B additions" in `product/security/asvs-l1-check-2026-10-14.md`.
- Sources: `product/research/ndis-watch/2026-10-17-req-023-b.md`.
- PR body: `product/evidence/req-023/pr-body-session-b.md`.

## Said, not built

- The audit-day registers (REQ-018's nine and the hazard register) keep "All" under every period until a later session adds their date column to the REQ's Data table (FR-5's own words).
- The FR-10 line of "what changed" (changes notified, variations applied for) joins in Session D with the changes register.
- Session A's two links on the account page and the audit-day page move to `/path/renewal` in Session C (finding 65).

## UNVERIFIED

- The Commission's types-of-audits page timed out a third time (17 Oct 2026); nothing in this session rests on it.

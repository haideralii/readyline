# REQ-023 Session C: the renewal path and the rehearsal (FR-7, FR-8, FR-9; AC-5)

Stacked on Session D (`req-023-session-d`, #103); PR to `next`. Dev-2's worktree build (CHAT-2 rules); the one shared file touched is none: every edit is in Session C's own files, the self-check's files, the pack, the auditor-link files and the three pages that gain a link.

## What this adds

- **The renewal path** at `/path/renewal` (FR-7): ten steps in the Commission's order, each with its live state and one action, one primary button (the next step not done). The four dated steps (application, scope of audit, booking, decision) each have their own screen at `/path/renewal/<step>` with one date, the booking also the auditing company's name (at most 80 characters, the SR-1 shapes refused; no list, no fee, no recommendation). The application date is tested against the s 73K window: the step's line, the account page's position sentence and the last-call reminder read the same function (finding 83). The Commission's three practice lines on the apply step are the REQ's words (findings 88 and 89).
- **The rehearsal** (FR-8): "Check my systems" gains `?mode=rehearsal`, the same questions with "this quarter" read as "in this period", stored on `self_checks` with its mode and period, writing no improvement row and never counting as the quarter's walk. It ends with one dated sheet of what is missing, `rehearsal-<date>.csv`, headed "Our own working note, <date>", in the owner's own pack always and in an auditor link's pack only when the owner ticked "Include my rehearsal notes" when creating that link (off by default, D-2309). The mid-term variant, when the mid-term audit is the next audit, opens with the corrective-action question and leads with the governance records (s 13B(5)).
- **FR-9**: the path's own words never say "mid-term"; the mid-term words exist only inside a mid-term rehearsal, which exists only when the mid-term audit applies.
- **Ways in**: the account page from the day the window opens, the audit-day page at any time, the registers index's timeline link.

## Migration

`supabase/migrations/20261017130000_renewal_path.sql`: five columns on `registration_periods` with their CHECKs (D-2316), `self_checks.mode`, `period_from`, `period_to` with their CHECK, `auditor_links.include_rehearsal` (default false), and `auditor_link_lookup` re-created to return the tick (service role only, as before). First real run: this PR's Supabase job.

## Tests

- Unit: `src/lib/path/renewal.test.ts` (AC-5's ten states, the dated steps, the s 73K line, the practice lines verbatim), `self-check.test.ts` (the rehearsal's questions, order, sheet and closing line), `timeline.test.ts` (`applicationInsideWindow` and the position sentence).
- Integration: `tests/integration/renewal-path.test.ts` (the five columns and both CHECKs, the rehearsal's mode and period CHECK, the tick's default and the lookup).
- E2E (desktop and Android, D-2207): `e2e/signed-in/req-023-c.spec.ts` (AC-5's states in order with one primary action; the application and booking saved, the SR-1 refusal; the rehearsal with no improvement row, the sheet in the owner's pack, absent from a plain auditor link's pack and present in a ticked one).
- `npm run check`: __UNIT__. The D-2319 public run in CI mode on the three projects from a production build: __CIMODE__.

## Decisions and records

D-2342 (fifteen calls) under the Dev-2 heading in `DECISIONS.md`; the ASVS rows under "REQ-023 Session C additions"; `product/research/ndis-watch/2026-10-18-req-023-c.md` (the two Commission pages timed out and are marked NOT RE-READ; the lines rest on the 16 October read); evidence in `product/evidence/req-023/c-evidence.md`.

## For the PO

- The reminders job (Dev-1's file) needs no change for finding 83: `src/lib/registers/reminders.ts` reads the s 73K answer from the period row before calling `registrationReminders`.
- The REQ's "pack page" for the tick is read as the auditor-link form on the account page, the one place a link is created (D-2342 (10)).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

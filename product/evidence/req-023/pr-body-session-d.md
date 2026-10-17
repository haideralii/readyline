# REQ-023 Session D: the changes register

Base: `next`. Branch: `req-023-session-d` (cut from `next` at 7728979, after #97). Built by Dev-2 (`product/CHAT-2.md`).

## What this delivers

- **FR-10 "Changes we told the Commission".** One constant (`src/lib/registers/commission-changes.ts`) names every change type with its kind (a notification under the Rules' s 13 or s 13A, or a variation under the Act's s 73M), the Rule's own timing words for its helper and the governance policy's table row it belongs to; the policy's "Telling the Commission about changes" table is built from it, words unchanged, held by a test. The register rides the REQ-018 meta: one form for both kinds, the generic row page with the Rule's words under the status, the register's own list page with the kind as a filter chip (D-2317), the `ColumnSpec` block posted in CHAT-2 before the page. States as D-2306 and D-2311 read them: a s 13A event is overdue past the earlier of the day known and the day it happened, a s 13 change is never overdue, a notice counts as notified only in the approved form, a variation is to apply, applied, decided.
- **Migration `20261017120000_commission_changes.sql`.** The table with its CHECKs, the status view on the Sydney day, RLS as the registers with no delete, revoke-then-grant per verb, the row code `CHG-0001` from the shared sequence, the trail's register list.
- **Everywhere the register joins.** The fourteenth audit-day record (the ask list, the self-check question, the index), the pack and the auditor view, the CSV import with the SR-1 refusals on the Commission's reference and the note.
- **FR-2, FR-4.** The change-of-ownership audit row on the timeline (Rules s 13BA; held back for a verification provider, when the registration ends inside the three months, or when a mid-term audit is under way) and the fourth dated checklist item, both reading the register's newest change of ownership.
- **FR-11.** The result page's two prompts for a signed-in owner with a ready set: the groups changed (a variation to apply for, with the link to record it) and a state added (conditional, with that state's own checks from the state reference); no row written.

## Tests

- Unit: `commission-changes.test.ts` (the constant against the migration's CHECK list, the policy table's words, the states of AC-6), `timeline.test.ts` (the ownership row and its three suppressions), `derive.test.ts` (the fourth item), the record-list tests moved to fourteen.
- Integration (CI's Supabase job): `tests/integration/commission-changes.test.ts` (RLS, the CHECKs, the view's states on the AC-6 fixture, the code, the trail).
- E2E (desktop and Android, CI's Supabase job): `e2e/signed-in/req-023-d.spec.ts` (AC-6 on the result page and in the register, the kind chips, the timeline row and the checklist item, the pack and the auditor link).

## Decisions and evidence

- D-2341 in `DECISIONS.md` under "REQ-023 Sessions B to D (Dev-2)"; D-2316 to D-2319 are the PO's answers in `product/CHAT-2.md`.
- ASVS rows under "REQ-023 Session D additions"; the watch entry `product/research/ndis-watch/2026-10-18-req-023-d.md` (the manage-your-registration page timed out; the 16 October read stands).
- Said, not built: FR-6's last line and the sheet's rows for this register follow once Session B merges and `next` comes into this branch (D-2341 (12)).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

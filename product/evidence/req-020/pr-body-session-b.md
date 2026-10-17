# REQ-020 Session B: the worker role, invitations and the report link

Branch `req-020-team` (cut from `req-020-audit-pack`, so this PR shows Session A's commit until that PR merges; open it after #A, base `next`). Compare: `next...req-020-team`.

## What it does (FR-4, FR-5, FR-6, FR-11; PO review 14 Oct)

- **Worker role.** `memberships.role` gains `worker` with the worker's code. `is_member` now means owner or member, so every existing policy excludes a worker; `is_worker` gates only their own incident and complaint rows, their events and their own membership row. The worker home (`/worker`) has two actions and the list of what they logged; the site header shows them one link. Every owner page sends a worker home; the exports are not theirs.
- **Invitations.** The owner invites by email and worker code from the account page ("Your team"); the address is stored as a hash, the token hashed, 7 days, one accept by the invited address only (`accept_invitation` runs as the user and matches the session's email hash). The invitation goes by email and the link is shown once on the page. Pending invitations by code, revocable; workers removable (their rows stay with `logged_by_ref`; access ends on the next request).
- **Report link.** One per account, on, regenerate, off. The signed-out form (`/report/<token>`) carries the 000 line, the general-information line, the participant-data warning, and "who are you" as a worker code or a name-free role, never free text. Submitting writes through `submit_incident_report` (service key only) a `draft` row with `aware_at = now()`, refuses the eleventh unconfirmed draft, and emails the owner at once; the nightly job nudges again from twelve hours after the report (`report-to-confirm`).
- **Confirming.** "N reports to confirm" on the registers index, the incidents register and the audit-day page, each one tap from the confirmation screen (`/registers/incidents/[id]/confirm`): what the reporter wrote, "Reported <time>; if this is a reportable incident the Commission must be told by <time + 24 h>", the two notification fields, one Confirm button, Reject with a reason folded under it. Confirming makes an ordinary open row dated from the later of the occurred and aware dates, and `notify_by` is generated from that date. Drafts and rejected rows count in no total, no overview and no incident reminder; the status view names them.
- **Limits and logging.** 10 reports an hour per address, 50 a day per account, 10 unconfirmed drafts; audit lines for every invite, accept, revoke, remove, link create, regenerate, revoke, report submitted, confirmed, rejected.

## Deviations for the PO

- The two-hour nudge is one email at submission; the twelve-hour nudge is the nightly job's daily reminder from twelve hours after the report. A second schedule would need a cron the Hobby tier does not have (D-2231).
- A removed worker's session is not revoked server-side; the membership is re-read on every request, so their access ends on the next request (FR-11's words).

## Tests

- Unit: `src/lib/registers/worker.test.ts` (reporter field, report and invite schemas, expiry, the aware sentence, the "N reports to confirm" line), `reminders.test.ts` (the twelve-hour rule and the line), `fixtures/reminders/report-to-confirm.json`.
- Integration (Supabase job): `tests/integration/worker-rls.test.ts` (accept once by the invited address; a worker's own rows and nothing else across eight tables; the draft with `aware_at` at submission, the eleventh refused, confirm sets the clock, reject keeps the row, the CHECK on the reason, revoked link answers P0002, removal ends access), `reminders-job.test.ts` (two drafts: the 13-hour-old one raises `report-to-confirm` and nothing else; the one-hour-old one nothing).
- E2E (three projects, incl. iPhone): `e2e/signed-in/team.spec.ts`: invite, accept, log, see own rows, every owner page bounces, owner sees "Logged by W-003", remove; report link on, signed-out report, "1 report to confirm", confirm on one screen, "Notify by", link off is 404; axe and width checks on the team panel, the worker home, the report form and the confirm screen.
- `npm run check` green locally; the public smoke (home, not-found, a11y, subscription story) green on desktop Chromium. The signed-in e2e and the integration suites run only in CI's Supabase job (never against the hosted project).

## Decisions and security

D-2231 in `DECISIONS.md`; seven ASVS rows appended to `product/security/asvs-l1-check-2026-10-14.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

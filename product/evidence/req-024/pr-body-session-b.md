# REQ-024 Session B: the worker's own steps through the worker role

Branch `req-024-session-b` from `next` 48c978e, into `next`. Dev-1, 18 Oct 2026.

## What this PR does

- **FR-7, the worker's home.** `/worker` opens on "Your steps" above "What you logged": the derived list in the owner's order, each item's state in five fixed words (to do; waiting for your manager to confirm; confirmed; recorded by your manager; your manager records this) with the control for what is theirs: the application number, the check number and the expiry on their own screening row (`worker_update_clearance`), a date on a shared item (`worker_update_item`), "I have read this" per adopted document for W-3 and W-6. Reads go through the worker's own policies and the A1 views (no `note`); the adopted documents' names and versions through the new `document_versions_worker` view (D-2826).
- **The acknowledgements (Data, SR-2, D-2828).** Migration `20261017060000_worker_steps_b.sql`: `policy_acknowledgements` (one row per worker, document type and version; members read, the worker reads and inserts their own code alone, the owner inserts for any code, no update or delete; writes under the subscription gate, reads never; revoke then grant); `register_events.register` gains it. When every document an item names is acknowledged for its adopted version, the item takes the worker's date through the function, so the owner's confirmation stays the date an auditor reads (FR-8).
- **FR-9, the invitation.** The subject and body carry the role's sentence ("log incidents and complaints and complete your onboarding") and the worker's first three steps in their own words before the link; no number but the code and the date (AC-8). The sentence changes in its three homes (the worker home, the invite screen, the invitation).
- **FR-8, the owner's page.** A tick's actor is read from `actor_user_id` and its role from `memberships`, shown beside the typed code (D-2444).

## Tests

- Unit: `worker-steps.test.ts` (the five states, the acknowledgement documents, the latest-adopted rule), `templates.test.ts` (AC-8), the copy and boundary lints.
- Integration (the Supabase job): `tests/integration/worker-steps-b.test.ts` (the view's rows and the base table's silence; the worker's own insert, the key, the forged code's 42501, the stranger's empty read, no update or delete; the three fields through the function and the item's date waiting for the owner); the grants map gains the table and the view.
- E2E (the Supabase job): `e2e/signed-in/worker-steps.spec.ts` on `desktop-chromium` and `android-small` (the owner invites, the worker accepts, the notice once, the steps first, the three fields and "Waiting for your manager to confirm", the owner's confirmation read on the worker's home, the registers and the account not the worker's); `team.spec.ts` reads the new sentence.

## Not in this PR

Supervision, ending a worker, the period filter, the pack and the import (Session C); W-7 to W-10 stay the owner's.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

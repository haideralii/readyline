# REQ-024 Session B: delivery evidence

Dev-1, 18 Oct 2026. Branch `req-024-session-b` from `next` 48c978e (A0 to A3 and REQ-022 B in), PR into `next` (the PO opens it). The session's scope is Session B of the Scope: the worker's own steps through the worker role (FR-7), the two-party items (FR-8), the invitation's first steps (FR-9); AC-3, AC-6's worker half, AC-8. The Dev's calls are D-2282 in `DECISIONS.md`; the plan was the Dev response of 00:24 with its three questions, answered 01:55 (D-2826, D-2828; one table).

## Commits

| # | Commit | What |
| --- | --- | --- |
| 1 | d86bd8e | `20261017060000_worker_steps_b.sql` (`policy_acknowledgements` with its policies and grants, the register CHECK, `document_versions_worker`); the pure step words and the acknowledgement documents (`worker-steps.ts`, unit-tested); the worker's reads through the worker's policies and views |
| 2 | 1b2f014 | The three server actions behind the worker session; the worker home's "Your steps" list with its controls |
| 3 | 1735780 | The invitation's first three steps and the FR-7 sentence in its three homes (AC-8's test); the tick trail's actors by role on the owner's page |
| 4 | (this) | The integration test, the signed-in spec, this file, the PR body and D-2282 |

## Acceptance criteria in B's scope

| AC | Test | Level | Result |
| --- | --- | --- | --- |
| AC-3 (the worker's list, the three fields, "waiting for your manager to confirm", the owner's confirmation, the actors by role) | `e2e/signed-in/worker-steps.spec.ts` (the flow from the invitation to the owner's confirmation read on the worker's home); `tests/integration/worker-steps-b.test.ts` (the fields through the function, the item's date waiting, both dates read back) | e2e and integration, the Supabase job | on the PR's run |
| AC-3's "recorded by your manager" | `src/lib/registers/worker-steps.test.ts` (the five states, finding 224); the owner's recording path is A1's | unit | green in `npm run check` |
| AC-6 (the worker's acknowledgement under another code is 42501; own rows readable; the base table silent) | `worker-steps-b.test.ts` | integration | on the PR's run |
| AC-6's page half (the registers and the account are not the worker's) | `worker-steps.spec.ts` | e2e | on the PR's run |
| AC-8 (the invitation's three steps, the link, the FR-7 subject, no number) | `src/server/email/templates.test.ts` | unit | green |
| FR-7's sentence in three homes | `team.spec.ts` (the invite screen's words), `worker-steps.spec.ts` (the home's words), `templates.test.ts` (the subject) | e2e and unit | on the PR's run; unit green |
| SR-2 (the worker's reads, no `note`) | `worker-steps-b.test.ts` (the view, the base table) and A1's suite unchanged | integration | on the PR's run |

## Runs

- `npm run check` green on every commit (lint, format, typecheck, unit: 169 files, 1,208 tests at commit 2; 169 files, 1,209 tests at the head).
- A production build from the main tree at every pushed commit with the public smoke (health, headers): green each time.
- The whole public set in CI mode on the three projects from a production build of the head: 305 passed, 29 skipped, none failed (8.7 min), from 1735780 with the unsubscribe spec left to CI's public job.
- The integration test and the two signed-in specs run on the PR's Supabase job alone (the standing rule keeps them off this machine, whose environment points at the hosted project).

## Screenshots

`worker-steps.spec.ts` writes `worker-steps-b-*`, `worker-steps-waiting-b-*` and `worker-steps-confirmed-b-*` under `product/evidence/req-024/` with `EVIDENCE=1` on the Supabase job's run (the `signed-in-screenshots` artefact), at 360 and desktop.

## Said, not built

Supervision, ending a worker, the period filter, the pack and the import (Session C); W-7 to W-10 stay the owner's; the owner's acknowledgement on a worker's behalf has its insert policy and no form yet (the owner records the item's date through A1's path).

## UNVERIFIED

None of the Commission's: the session adds no regulatory sentence. The acknowledgement column's name (`document_type_id`) differs from the Data section's `document_slug` (D-2282 (1)).

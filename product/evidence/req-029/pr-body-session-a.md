# REQ-029 Session A: fill at download, the customer's details typed once

PR into `next`, branch `req-029-session-a` from `next` 4ddf51b (with `next` 3e62b88 merged before the push, D-2827). Dev-1, 18 Oct 2026. Head: 414cbf0.

## What this PR does

- **FR-5, the snapshot (D-2290).** Migration `20261018160000_fill_at_download.sql`: `document_versions.approver_name` and `approver_role`, written by `adopt_document_version` alone from `account_facts` inside the function (never client-supplied), fixed once written (a trigger refuses the move), a missing name refused with P0004 (the action says "Add your name on your details page first"), a carried adoption copying the earlier version's approver. No stored text is rewritten.
- **FR-2, FR-3, FR-7, FR-8, FR-10, two fills and one renderer (D-2291).** The job stores the model with its brackets. Every `.docx` renders on request through `fillForRead`: the live fill (contact and appendix answers, never the approver or the date), the adoption fill (the snapshot, through the same `fillText`, which also holds FR-7's participant-reference rule) and the ABN rebuild (the Provider cell's ABN part only). The document page shows the same filled model. `rerenderSetWithFacts` and `refreshSetSummary` are one rebuild of the zip and the summary from the filled models and insert no version. The set page, the adopt gate and the path strip count open blanks by the facts. The register's "by whom" reads the snapshot first. The adopt action writes no `date` fact (D-2854) and no longer re-renders before adopting.
- **FR-1, FR-4, FR-12, SR-1, SR-3, SR-6, "Your details" (D-2292).** One page in FR-1's order (name and role always, the date never), the state pre-filled from the account, business name and ABN read-only, the PO's warning verbatim, each field saved on blur with "Saved", a cleared field deleting its row, the detector's name and health parts on the four free-text fields alone, "I use no other digital tool" writing D-2879's row to the three appendix keys, brackets and control characters refused in words, one audit line per save and clear with the key only. The account form keeps its name and role fields over the same rows with FR-6's sentence under them. The set page and every document page point at the details page while a detail is open.
- **FR-6, re-approval (D-2293).** `needsReapproval` and `reapprovalModel` (the version moved, the earlier change-log rows fixed to the approver who signed them, one bracketed row "Approver changed to [role]; re-approved"); `reapproveAction` stores the version, adopts it through the function and audits `documents.reapproved`. Offered on the details page under the role field with a confirm. A changed phone or email never makes a version.
- **FR-13, the legal lines (D-2858).** The two PO sentences typed verbatim into `privacy.md` and `terms.md`, both dates moved to 18 October 2026, held by `legal-copy.test.ts`.

## Not in this PR (Session B)

The Start here sheet's one rule and its two open-line texts (AC-7), the register's "Contact details updated on <date>" line, the rule for sets made before this REQ and the set page's sentence (AC-9), the auditor pack rendered once per link (AC-8), the export and delete paths for the facts and snapshots (SR-5), and the zip rebuild on every save with the measured `ms` (question 1, PO answer (b)). The zip and the summary already carry both fills on every rebuild.

## Verification

- `npm run check`: green, 184 files, 1,337 tests.
- From the main tree's production build of the head, public specs on desktop: `health`, `home`, `legal-pages`, `req-025` on desktop: 9 passed, 1 skipped, no retries.
- Unit: `facts-fill.test.ts` (the live fill, FR-7's sentence rule, the fact-aware count, the details questions' order, the value rule), `adoption.test.ts` (the snapshot fill, a missing role, a pre-snapshot version, the ABN rebuild, `fillForRead`), `reapproval.test.ts`, `document-control-approver.test.ts`, `job.test.ts` flipped to the stored brackets, `legal-copy.test.ts`; the copy, class and path-screen lints green.
- Integration (the Supabase job): `adoption-per-version.test.ts` gains the snapshot on the owner's adoption, the carried copy, P0004 without a name, the fixed snapshot and the re-approval's version.
- E2E (the Supabase job, desktop and Android): `e2e/signed-in/fill-at-download.spec.ts`, AC-1 to AC-6, AC-11 and AC-12 in one serial journey; `guided-path` and `purchase-flow` read the new heading.
- AC mapping: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-11, AC-12 the journey above; AC-10 `facts-fill.test.ts` (FR-7); AC-13 `legal-copy.test.ts`; AC-7, AC-8, AC-9 Session B.

## Evidence

- `product/evidence/req-029/pr-body-session-a.md` (this file); D-2290 to D-2293 in `DECISIONS.md`; the CI run's job log for the `path.finish.rerendered` `ms` figure (question 1).
- Screenshots, the draft and adopted governance policy and the sheet under `product/evidence/req-029/`: from the Supabase job's run (EVIDENCE), not from this laptop (D-2859: the fixture account only).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

# REQ-029 Session B: the fill in the zip, the sheet, the register's line, the once-rendered auditor pack, the older sets

PR into `next`, branch `req-029-session-b` stacked on `req-029-session-a` (merged into `next` as #112, 5d6cea7), with `next` 5d6cea7 merged before the push (D-2827). Dev-1, 18 Oct 2026. Head: aab3e57 (the tree of 1c6fb4c, which `npm run check` passed: 1,360 tests).

## What this PR does

- **FR-4, FR-9, FR-10, AC-7, the Start here sheet (D-2295 (1), (2)).** `isTemplateSet` tells a set made from this REQ on from an older one. On a template set a Fill in line is done when `account_facts` holds its key and an open one reads "Fill this in on your details page"; the approver and date blanks are listed once each ("Approval line: [name]" and so on), done on adoption, open ones reading "Fills in when you adopt this document"; done lines print a tick in Word and on the page. An older set keeps REQ-026 FR-4's rule and its set page carries D-2861's sentence. The sheet's top count is the set page's.
- **FR-6, the register's line (D-2856).** "Contact details updated on <date>" on an adopted row whose "[phone or email]" was saved after the adoption day, on the page and as a column of the pack's document-control CSV; the version does not move.
- **Question 1 (b), the rebuild on save (D-2859).** A save or a clear on the details page rebuilds the newest ready set's zip and summary; the `path.finish.rerendered` line carries the `ms` (the figure for the evidence comes from the CI job log); a rebuild that fails is logged and never shown as a failed save. The zip and the summary already carried both fills from Session A's rebuild.
- **SR-5, the export.** The facts (key, value, when) and every document version's approver snapshot and adoption day are in `account.json`.
- **FR-11, SR-4, SR-5, the auditor pack rendered once (D-2863, D-2294).** The link's default period is rendered at creation with both fills as they stand and stored under the account's prefix beside the link's id; every later download of that period serves the stored bytes; another period renders on its first download and is kept the same way. The cover carries the render day's line and the general-information and AI statements. The pack's adopted documents render through `filledForRead` (the stored files keep their brackets). The stored packs go when the link is revoked or replaced, when an ended link is purged, and with the account.

## Verification

- `npm run check`: green, 185 files, 1,345 tests.
- From the main tree's production build of the head, public specs on desktop: `health`, `home`, `legal-pages`, `req-025` on desktop: 9 passed, 1 skipped, no retries.
- Unit: `start-here.test.ts` (the template rule, the notes, the adoption lines, the older-set rule, `isTemplateSet`), `document-control-approver.test.ts` (the contact line's day rule and the row), `link-pack.test.ts` (the stored pack's names), `auditor-links.test.ts` (the purge reads the ended links first).
- E2E (the Supabase job, desktop and Android): `fill-at-download.spec.ts` gains AC-7, AC-8 and AC-9.
- AC mapping: AC-7 and AC-9 the sheet case; AC-8 the link case; the register's line `document-control-approver.test.ts`; SR-5 the export's two new fields (read in the account export's JSON).

## Evidence

- `product/evidence/req-029/pr-body-session-b.md` (this file); D-2294 and D-2295 in `DECISIONS.md`; the CI job log for the `ms` figure.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

# REQ-033: Bring your audit findings: each one mapped to the document and section that answers it

Status: ready for Session A (PO, 18 Oct 2026 21:25; lawyer's and NDIS expert's reads applied as D-2929 to D-2938, D-2222)
Phase: 6   Priority: should   Owner: Dev (Session A now, Session B later, Dev-1)

## Why (user and business outcome)

- Readyline starts from the questionnaire, which serves a first-time applicant. A registered provider who has just had a mid-term, renewal or failed audit arrives with something else in hand: the auditor's report, a list of non-conformities against quality indicators, each with a severity and a date to fix it by. Today nothing in Readyline takes that list; the provider reads it next to the pack and works out the mapping alone.
- Competitors sell exactly this entry point (research, 18 Oct 2026). We can do it without storing the report and without participant data, which they cannot say.
- The auditor at the next visit looks for the corrective action trail: what the finding was, what changed, who approved it, when. The continuous improvement register is where that trail belongs (NDIS expert, D-2929).

## Scope

Session A: the findings register (paste or upload, parsed in memory, never stored as a file), the participant-data gate, the mapping of each finding to a standard, to the pack's documents and sections, the improvement register link, the audit-day card, export and the auditor's view.
Session B (deferred, not in this REQ's ACs): a redraft of one mapped tailored section with the finding as context, as a new document version (REQ-029 D-2855 rules).

Out: reading the auditor's report for anything but findings; storing the uploaded file; a finding without a standard (it is kept as "unmapped" and the provider picks the standard); any claim that addressing a finding closes it with the Commission.

## Functional requirements

- **FR-1 Entry.** `/registers/findings`, owner only, with "Add findings" taking either pasted text or a PDF or DOCX up to 5 MB. The file is read in the request, split into candidate findings (one per numbered item, table row or paragraph that names a standard, an indicator or the words non-conformity, non-conformance, finding, corrective, major, minor) and discarded; nothing of the file is written to storage, the log or the model (D-2930). The page says so in one sentence above the control.
- **FR-2 The gate.** Each candidate runs through the participant detector (REQ-003 SR-2, all five rules). A flagged candidate cannot be saved until the provider edits the words; the message is the detector's. Auditor reports name participants by initials or codes and sometimes in full; the gate is the reason the register holds the provider's words, not the auditor's (lawyer, D-2931).
- **FR-3 The row.** A finding row: the standard (from `data/standards.json`, picked by the provider from a list grouped by module, prefilled by the mapping in FR-4), the indicator text when one matches, severity (major, minor, observation, as the auditor wrote it; a closed list), the finding in the provider's words (at most 500 characters), the auditor's due date if any (typed), the status (open, addressed, verified), the addressed date and who (role, D-2913), and the improvement register row it created (FR-5). Rows are the account's, RLS as the other registers; the `findings` table joins the export set (D-2898 is amended: findings go in the account export and the pack) (D-2932).
- **FR-4 The mapping.** For each saved row, the standard gives the documents of the pack that carry that standard (`document-types.json` standards ids) and, for each, the section whose brief names the indicator; the row shows "Answered in: Incident management policy, section 3 What we do; Incident register" with links into the provider's set. A finding whose standard maps to no document says "No document in your pack carries this standard" and links the catalogue (D-2933). The model is used for one thing only: when the provider pastes text with no standard named, it proposes the standard from the finding's words, after the gate, and the provider confirms; the proposal is never saved on its own (D-2934).
- **FR-5 The trail.** Saving a finding creates a continuous improvement register row with source "audit finding", the finding's words and the standard, linked both ways; closing the improvement row addresses the finding; the finding's "verified" status is the provider's record that the auditor accepted the change, typed with a date, never set by Readyline (D-2935).
- **FR-6 Where it shows.** The audit-day page gets a card "Findings from your last audit: 3 open, 2 addressed" linking the register; the auditor's view (REQ-020) shows the findings table with status and dates; the audit pack's CSV set gains `findings.csv`; the account export includes the rows.
- **FR-7 Words.** The page's intro: "Type or paste your auditor's findings in your own words. Readyline shows which document and section in your pack answers each one and keeps the record of what you changed. It does not decide whether a finding is closed; your auditor does." (lawyer, D-2936). No "resolve", "clear" or "pass" on buttons: "Mark as addressed", "Record the auditor's verification".

## Security and privacy

- SR-1 Upload parsing runs with a size cap (5 MB), a page cap (60), a time cap (10 s), and file-type sniffing; a file that fails any cap is refused with a plain message; nothing is retained.
- SR-2 The gate (FR-2) runs server-side on save as well as in the browser; a save with a flagged field is refused (the REQ-024 pattern).
- SR-3 Audit log rows for create, address and verify (D-2306 kinds).

## Acceptance criteria

- AC-1 Paste of a three-item findings text (fixture `fixtures/findings/sample-report.txt`, fictional, with one item naming "Mr J. Smith"): two rows save, the third is refused until edited, then saves (e2e, desktop and Android).
- AC-2 Upload of the same fixture as PDF and as DOCX gives the same three candidates; no object is written to storage; the log carries the count, not the text (integration).
- AC-3 Each saved row shows its standard, at least one document and section from the provider's set, with links that open (e2e).
- AC-4 A saved row has its improvement register row; closing it marks the finding addressed with the date; recording verification sets verified (e2e, integration for RLS: a member reads, cannot write).
- AC-5 The audit-day card counts match; the auditor's view and `findings.csv` carry the rows (e2e, audit-pack spec extended).
- AC-6 A row whose standard maps to no document shows the D-2933 line (unit).
- AC-7 `legal-copy.test.ts` pins FR-7; privacy.md gains one bullet under "What we collect" for findings in the provider's words, and ai.md one sentence that a pasted finding's words may be sent to the model to propose its standard after the participant check (D-2937).
- AC-8 `npm run check` green; a11y spec covers the new page at 360 and 1280.

## Lawyer's read (D-2931, D-2936, D-2937, D-2938)

The auditor's report is the provider's document to use; nothing here copies it beyond the provider's own words, and the file is never retained, so no new collection arises beyond the row (D-2930). The gate is what keeps participant information out of a feature whose input is the one place it is most likely to appear; the server-side refusal (SR-2) makes that a control, not advice (D-2931). FR-7 keeps Readyline out of the auditor's decision; "verified" is the provider's own record of what the auditor said (D-2936). The model's use is a disclosed, narrow purpose (D-2937). D-2938: findings rows are in the export and purge scope and the privacy page says so; no retention beyond the account's life.

## NDIS expert's read (D-2929, D-2932, D-2933, D-2934, D-2935)

Auditors report non-conformities against quality indicators with a severity and expect a corrective action plan with dates and evidence of change at the next visit; the improvement register is the record they ask to see first, so a finding that lives only on its own page would miss the point (D-2929, D-2935). Mapping to the standard, not just to a document, is right because the same indicator is carried by more than one document in the pack (D-2933). The severity words differ between auditors; the closed list keeps "as the auditor wrote it" but normalises for the card (D-2932). Dev verifies the Commission's current wording on audit outcomes and corrective actions on ndiscommission.gov.au before writing the FR-7 intro's second sentence and records the read date in `standards.meta.json` (D-2934).

## Dev response

Dev-1, 18 Oct 2026, on `req-033-session-a` from `next` b14206d. D-2929 to D-2938 read first.

**D-2934, the Commission's wording, checked first.** The Commission's page "Information for quality auditors" (ndiscommission.gov.au/provider-registration/apply-registration/information-quality-auditors, "Last updated 15 October 2026", read 18 Oct 2026) says: "At the end of the audit, you will give the provider a rating for each NDIS Practice Standard: 3 – conforms with elements of best practice; 2 – conforms with NDIS Practice Standards; 1 – minor non-conformity; 0 – major non-conformity." For a 0 or 1 the auditor asks the provider to "provide a corrective action plan that describes how they'll address the non-conformity. The provider must give you the plan within seven calendar days of your request." The auditor reviews the plan "and decide[s] if the ratings will be updated or remain the same"; a 0 or 1 that stays is "an open non-conformity", followed up "after the required period of time" by a desktop review or an on-site follow-up; "Critical risks or other serious matters would normally require an on-site follow-up or re-audit within three calendar months." A minor non-conformity the provider has addressed is "'closed' in the NDIS Commission's records" by the auditor (verification: through the Commission's closure process; certification: at the next applicable audit). So the words are "non-conformity" (hyphenated), "minor" and "major" by rating, "corrective action plan", "open" and "closed"; the auditor decides the rating and the closure, and the Commission records it. FR-7's second sentence stands as the PO wrote it ("It does not decide whether a finding is closed; your auditor does."); I would add nothing. The page, the quotation and the read date go into `standards.meta.json` at commit 1, as D-2934 asks. The REQ's "observation" severity is not a Commission rating; see question 2.

**Approach, Session A (five commits).**

1. **The register.** `findings` as an audit-day register slug, so the list, new and edit pages, the filters, the registers index, the pack's CSV set, the audit-day overview and the auditor's view all come from `AUDIT_DAY_META` and `AUDIT_DAY_SLUGS` as the other registers do (REQ-018 D-1904); the migration gives it the table with FR-3's columns and CHECKs (the severity list, 500 characters, no NDIS-number shape), RLS as every register (members read, subscribed members write), the `findings_status` view (open, addressed, verified; overdue when the auditor's due date has passed unaddressed), and the export's table list gains it (D-2932 amends D-2898). A finding row carries `improvement_id`; the improvement row carries `source_kind` and `source_ref` back (question 4).
2. **The entry and the gate.** A server action takes pasted text or a file: a DOCX is unzipped with `fflate` and its `document.xml` read as paragraphs (no new dependency); a PDF needs a text layer reader (question 1). Candidates are the numbered items, table rows and paragraphs that name a standard, an indicator or the words the REQ lists; the file bytes live in the request alone, nothing written to storage, the log line carries the count (D-2930). Each candidate runs through `detectParticipantData` (the five kinds) in the browser as it is shown and again in the action on save (SR-2); a flagged candidate is refused with the detector's own message until the words change. Size 5 MB, 60 pages, 10 seconds, type sniffed by the file's first bytes (SR-1).
3. **The mapping and the proposal.** For a saved row, the standard id gives the document types whose `standards` list carries it (`document-types.json`), and in each the section whose brief names the indicator (word overlap between the indicator's text and the section briefs, the best above a floor, else the document's first tailored section); the row reads "Answered in: <document>, section N <heading>; <register>" with links into the account's newest set, or D-2933's line with the catalogue link. The model is asked one thing, after the gate: given a finding's words and the standards list, which standard; `createModelClient()` as the generator uses it (replay in tests, live in production), the reply validated against the standards' ids, shown as a proposal the provider confirms, never saved on its own (D-2934's second half).
4. **The trail and the card.** Saving a finding inserts the improvement row (source, the finding's words, the standard, due date the auditor's) and links both ways; closing the improvement row addresses the finding with the day; "Record the auditor's verification" takes a typed date and sets verified (D-2935); audit lines for create, address and verify (SR-3). The audit-day page gets the card "Findings from your last audit: 3 open, 2 addressed" from the overview; the auditor's view and `findings.csv` come with the slug.
5. **The words and the pages.** FR-7's intro and buttons, the privacy and AI bullets (D-2937), the legal pins, the a11y spec at 360 and 1280, the fixtures (`fixtures/findings/sample-report.txt` and its PDF and DOCX renderings, fictional, one item naming "Mr J. Smith"), the e2e for AC-1 and AC-3 to AC-5, the integration for AC-2 and AC-4's RLS.

**Questions (none blocks the start; I build on the recommendations).**

1. *Reading a PDF.* The repo has `pdf-lib` (writes PDFs, reads no text) and no text extractor. (a) Add `pdfjs-dist` (Mozilla's reader, the legacy build for Node; about 2 MB, no native code), read page text up to the 60-page cap. (b) Add `unpdf` (a serverless wrapper around the same engine). (c) Paste and DOCX in Session A, PDF in B. **(a)**: one dependency, the engine the browsers use, and the cap keeps it bounded; the main tree needs its `npm ci` once.
2. *Severity list.* (a) `major`, `minor`, `observation` as the REQ has it. (b) The Commission's two ratings alone. **(a)**: auditors' reports do carry observations and opportunities for improvement outside the ratings; the card counts majors and minors as non-conformities and observations apart, and the row keeps the auditor's own word in the finding text.
3. *The second sentence of FR-7.* (a) As written. (b) "…; your auditor decides that and the Commission records it." **(a)**: true to the page and shorter.
4. *The improvement row's source.* The improvements table's `source_kind` CHECK lists `external-audit` among its kinds. (a) Use `external-audit` with `source_ref` the finding's reference (FND-0001), the label reading "External audit FND-0001". (b) Add `audit-finding` to the CHECK and the labels so the row reads "Audit finding FND-0001" as FR-5 says. **(b)**: the words FR-5 wants, one migration line and one label.
5. *The finding's reference.* (a) `FND-0001` through `next_register_reference`, as incidents and complaints get theirs. (b) None. **(a)**: the improvement row and the auditor's view need a handle.
6. *The model's fixture.* The tests run the proposal through the fake and replay clients, as every generator test does; a recorded fixture would need one live call. (a) Record one fixture for the sample report when you say so (one call, a few hundred tokens). (b) Fake replies only. **(b)** for Session A; (a) when you want the replay to be the real reply.

**Hours.** 11 to 13: the register and migration 2 to 3, the parser and the gate 3 (the PDF reader and its caps), the mapping and the proposal 2 to 3, the trail and the card 1 to 2, the words, pages and tests 2 to 3. Five commits as above; if the day runs out, commit 5's e2e lands first thing next session.

## Delivery evidence

**Session A.** Dev-1, 18 Oct 2026. Branch `req-033-session-a` from `next` b14206d, with `next` a60f7df merged before the push (D-2827; DECISIONS.md by union, the export readme carrying both D-2898's and this session's words). Head: db46105; self-check commit 827fd88 (#122's branch moved to it). PR body: `product/evidence/req-033/pr-body-session-a.md`.

Commits:

1. 18f4bc6: the register (FR-3, FR-5's source, FR-7's words, SR-2, SR-3): migration `20261018210000_findings.sql`, the meta, the columns, the three routes, the index, the export.
2. a55dd11: the entry and the gate (FR-1, FR-2, SR-1 to SR-3): `/registers/findings/import`, the server read of PDF (`pdfjs-dist`), Word and text with the caps, the candidates, the detector in the browser and in the schema, the fixtures.
3. 4f1157b: where the pack answers a finding and the model's one proposal (FR-4; D-2933, D-2934, D-2937).
4. 29409e3: the trail and the card (FR-5, FR-6, SR-3; D-2935, D-2936).
5. 4d05484: the words, the pages and the tests (FR-7, SR-1; D-2937, D-2938, D-2300): privacy and AI pages and their pins, the signed-in spec, the integration test.
6. c451b56: the findings table in the grants list and the data-promises list after the merge of `next` a60f7df.
7. db46105: the ASVS re-verification table's eight file:line references follow the lines they name (three moved by this branch, five already stale on `next` a60f7df).

| AC | Test | Level | Status |
| --- | --- | --- | --- |
| AC-1 | `e2e/signed-in/req-033.spec.ts` "AC-1: three candidates…"; `findings-actions.test.ts` (parse, save, the refused row) | e2e, unit | written; the e2e runs in CI's Supabase job |
| AC-2 | `findings-text.test.ts` (PDF, Word, text, the sniff, the caps, the refusals); `findings-actions.test.ts` "AC-2: reads an uploaded PDF and an uploaded Word file" | unit | green locally |
| AC-3 | `req-033.spec.ts` "AC-3: a row names the document and section…"; `findings-map.test.ts` | e2e, unit | written; green locally |
| AC-4 | `req-033.spec.ts` "AC-4, AC-5…"; `findings-trail-actions.test.ts`; `tests/integration/findings.test.ts` (the member read, the other account's refusals) | e2e, unit, integration | written; unit green locally |
| AC-5 | `req-033.spec.ts` (the card, the auditor's view, `findings-<stamp>.csv`); `findings.test.ts` (the card line) | e2e, unit | written; green locally |
| AC-6 | `legal-copy.test.ts` (the privacy bullet and the AI sentence pinned; the AI page's date) | unit | green locally |
| AC-7 | `findings.test.ts` (no resolve, clear or pass in the register's words); the copy lint | unit | green locally |
| AC-8 | `req-033.spec.ts` axe at 360 and 1280 on the list and the row | e2e | written; runs in CI's Supabase job |

Checks: `npm run check` green on the head (209 test files, 1,570 tests passed, 6 skipped). From the main tree's production build of the head: `home-v2`, `req-025`, `req-013-p2`, `req-015-a11y`, `health` on desktop-chromium and android-small, 30 passed in 2.5 min. Not run locally by rule: the signed-in spec and the integration test (CI's Supabase job). Screenshots of AC-1 and AC-3 at 360 and desktop come from that job's artefacts.

Open for the PO: the six Dev questions were built on the recommendations (1a, 2a, 3a, 4b, 5a, 6b); Session B (the redraft) stays deferred by the REQ.

### Acceptance self-check (Dev-1, 18 Oct 2026, on `req-033-session-a` at 827fd88)

Walked against the branch, one line per AC: pass, the proof, or the gap and what closed it. The signed-in spec and the integration test run in CI's Supabase job by rule, so their lines name what the spec asserts, not a local run.

| AC | Result | Proof on the branch | Note |
| --- | --- | --- | --- |
| AC-1 | pass | `e2e/signed-in/req-033.spec.ts` "AC-1" on desktop-chromium and android-small (the android project runs every spec): the fixture pasted gives three candidates; the third carries `data-blocked="true"` and the detector's sentence; the save button is disabled and the blocked line reads "1 marked above cannot be saved"; after "Mr J. Smith" becomes "participant P-014" the row unblocks, the save lands on `?saved=3`, three rows and FND-0001 in the list. `findings-actions.test.ts` holds the server side: the refused row's message, the others saved. | The AC's "two rows save, the third is refused until edited" is walked as one save after the edit, since the form holds the whole save while a row is blocked (SR-2's server gate refuses the one row if the browser check is bypassed, `findings-actions.test.ts`). |
| AC-2 | pass, with the level noted | `findings-text.test.ts` reads the PDF and the Word renderings of the fixture into the same text; `findings-actions.test.ts` "AC-2": both uploads give the same three candidates, the Supabase `storage` getter throws if touched and is not, the log line carries counts and never a word of the report. | Unit with fake clients, not integration: the read never reaches the database and tests make no model call (question 6 (b)); the integration test covers the rows (AC-4). |
| AC-3 | pass, one gap closed | `req-033.spec.ts` "AC-3": the row names "Incident management policy", "section N", "Incident register"; **gap:** the tenant had no set, so the link fell back to `/documents` and "from the provider's set" was not walked; closed at 827fd88 by seeding one ready version of the incident management policy from the sole-trader fixture's skeleton (as the fill-at-download spec seeds its set); the link's href is `/documents/<set>/incident-management-policy-and-register` and opening it lands on that page. `findings-map.test.ts` holds the mapping. | |
| AC-4 | pass, one gap closed | `req-033.spec.ts` "AC-4, AC-5": the saved row's improvement row exists with source `audit-finding`; marking the finding addressed closes it (`done_on` = the day); verification sets "Verified by the auditor 9 October 2026" and the forms leave; **gap:** the AC's direction "closing it marks the finding addressed with the date" (the improvement row closed from its own register) was not walked; closed at 827fd88: FND-0002's improvement row is opened from `/registers/improvements`, "Change this improvement" sets Done on 2026-10-05, and FND-0002 reads "Addressed 5 October 2026". `findings-trail-actions.test.ts` holds the actions; `tests/integration/findings.test.ts` "AC-4": a member reads the row through `findings_status`, another account reads nothing, its update touches no row, its insert is refused (42501). | The member "cannot write" line is the other account's refusal; a member of the same account may write under `insert_subscribed`, as every audit-day register allows (REQ-018 D-1904). |
| AC-5 | pass, one gap closed | `req-033.spec.ts`: the card reads "3 open", then "2 open, 1 verified by the auditor", then "1 open, 1 addressed, 1 verified by the auditor"; the auditor's view carries "Audit findings" and FND-0001; the pack holds `findings-<date>.csv`. **gap:** the audit-pack spec was not extended; closed at 827fd88 (`audit-pack.spec.ts` lists the findings file among the pack's names). `findings.test.ts` holds the card line's counts. | |
| AC-6 | pass | `findings-map.test.ts` "AC-6": a standard no document carries reads D-2933's line; an unmapped finding has no line; `finding-answers.tsx` renders the line with the link to the documents page. | |
| AC-7 | pass | `legal-copy.test.ts`: the privacy bullet (findings in the provider's words; the uploaded report not kept, logged or sent) under "What we collect" and the AI sentence (a finding's words to the model after the participant check; the report never) pinned verbatim, the AI page's `updated` 2026-10-18. FR-7's two sentences are pinned verbatim in `findings.test.ts` "FR-7" (the register's intro), with no button reading resolve, clear or pass. | FR-7's words are the register's, not a legal page's, so their pin sits in `findings.test.ts`; say if you want them in `legal-copy.test.ts` as well. |
| AC-8 | pass, one gap closed | `npm run check` green at 827fd88 (209 files, 1,570 tests); **gap:** axe ran on the list and the row, not on the new page; closed at 827fd88: `req-033.spec.ts` runs axe serious/critical and the sideways-scroll check on `/registers/findings/import` with its candidates showing, at 1280 and at 360, and on the list and the row. | |


## Session C (Dev-2): the plain-language summary's review state

Status: ready for Session C (PO, 19 Oct 2026 04:55; D-2959's item, with the lawyer's and NDIS expert's reads as D-2977 to D-2982, D-2222). Branch `req-033-session-c` from `req-033-session-b` 4f872ef (D-031 stacking; rebase onto `next` once #125 is in). One short session.

### Why

Five document types open with "In plain words", the summary a participant reads on their own (REQ-016 S-4). Session B replaces one section of a document with the finding as context; the living-policies path replaces a sentence when the NDIS watch applies a change. Neither touches the summary, so the document a participant reads can promise one thing in plain words and another in section 5. An auditor who interviews participants finds that gap first (NDIS expert, D-2979).

### Functional requirements

- **FR-C1 The state.** When any path replaces or re-generates a tailored section of a document whose outline carries `plain-language-summary` (Session B's redraft; the living-policies one-section re-generate where it exists; nothing else), the new version's document control row takes the state `summary-review` with the line "In plain words may be out of date: section N <heading> changed on <date>". The state is on the control register row and the document's page; it never changes the document's adoption state (D-2977). A document without the summary section never takes it (D-2977).
- **FR-C2 Two ways out.** On the document's page, under the summary: "Redraft the summary" (owner; one model request through Session B's builder with the changed section's new text as the context instead of a finding, the summary's own brief, the Year 6 readability gate the generator already applies to this section, the same limiter and quota; accepted into a new unadopted version with the change-log row "In plain words redrafted after section N changed; approved by [role]") or "The summary is still right" (owner or the role Session B lets approve; records the day and the role as a change-log row "In plain words confirmed after section N changed"; no model call). Either clears the state (D-2978).
- **FR-C3 The Easy Read place.** The fixed section "Easy Read version" takes no state; while `summary-review` is set, the page shows one line under it: "If you keep an Easy Read version, check it too." (D-2980).
- **FR-C4 Where it shows.** The control register's filter gains the state; the audit-day page's documents card counts "1 summary to check"; the auditor's view shows the state's line on the document row as the other states (D-2981).
- **FR-C5 Words.** No "compliant", "closed" or "resolved"; the state's label is "Summary to check". Pinned.

### Acceptance criteria

- AC-C1 A Session B redraft of a section in a participant-facing document sets `summary-review` on the new version's row with the line; a redraft in a document without the summary does not (unit on the version function, e2e on the row).
- AC-C2 "The summary is still right" clears the state and writes the change-log row with the role and day (e2e, integration for the member's refusal).
- AC-C3 "Redraft the summary" under the fake mode produces the new unadopted version with the summary replaced, the change-log row and the state cleared; the readability gate runs on the reply (unit with a reply above Year 6 refused, e2e for the walk).
- AC-C4 The control register filter, the audit-day count and the auditor's view carry the state (e2e).
- AC-C5 `npm run check` green; the a11y spec covers the document page with the state at 360 and 1280.

### Lawyer's read (D-2977, D-2978, D-2980)

The summary is the part of the policy a participant relies on; a summary that contradicts the policy is the misleading document, whatever the policy says, so the state must follow every path that changes the policy's substance and must be visible wherever the document's state is read (D-2977). The way out is the provider's act, recorded with a role and a day; Readyline never clears the state on its own and never sends the summary to the model without the owner's click (D-2978). The Easy Read version is the provider's own document outside Readyline, so the line asks, and asserts nothing about it (D-2980).

### NDIS expert's read (D-2979, D-2981, D-2982)

The Core module's rights standard asks that participants get information in the language, mode of communication and terms they are most likely to understand; auditors check it by asking participants what they were told and reading what they were given, so the plain-words summary is evidence in its own right and must match the policy it summarises (D-2979). The state belongs on the control register and the auditor's view, because that is where the auditor reads a document's standing (D-2981). D-2982: the summary's redraft keeps Session B's rule that the policy text never names the audit or the finding; the change-log row is the record.

### Dev response

(Dev-2 answers here: which paths replace a section today, the state's storage, questions.)

### Delivery evidence (Session C)

(Dev appends.)

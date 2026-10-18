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

## Delivery evidence

(Dev appends: branch, commits, test counts, screenshots of AC-1 and AC-3 on desktop and Android.)

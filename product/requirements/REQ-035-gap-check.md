# REQ-035: Bring your own policy: the gap check against the pack's outline

Status: ready for Session A (PO, 19 Oct 2026 04:10; lawyer's and NDIS expert's reads applied as D-2962 to D-2969, D-2222)
Phase: 6   Priority: should   Owner: Dev (one session, Dev-1)   Builds on: REQ-033 Session A (the import reader and the gate), REQ-033 Session B (the fake model mode, once #125 is in `next`)

## Why (user and business outcome)

- A registered provider arrives with policies already: written years ago, bought as templates, or handed down by a consultant. Their question is not "which documents do I need" but "is what I have enough". Today Readyline answers only the first question; the second is answered by reading the pack's outline next to their file, alone.
- The competitor research of 18 Oct 2026 (move 2) names this entry path as the one a rival sells to existing providers. We can offer it without keeping the file and without a verdict on the Standards, which is the honest version: a comparison of their document against the outline Readyline writes from the quality indicators, section by section.
- The result feeds the two things that make money: a gap the provider cannot close alone points at the pack's document and section; a provider who keeps their own policy still gains the registers, because the outline's "record" sections name them.

## Scope

In: one page, `/documents/gap-check`, signed in, owner only; one document at a time (pasted text, PDF, DOCX or TXT); the participant gate; one model request per check; the gap list stored as rows (never the file, never its text); links into the catalogue and, when the account has a set, into its documents; the checklist and audit-day lines; the AI and privacy sentences; the limiter.
Out: storing or reproducing any part of the uploaded document; a rewrite of the provider's document (REQ-033 Session B's redraft works on the pack's own versions, not on theirs); a verdict against the Practice Standards; a gap check for registers (the registers are records, not documents; the result says which register the outline names); a per-indicator score.

## Functional requirements

- **FR-1 Entry.** `/documents/gap-check`, owner only, with the document type picked from the catalogue (`document-types.json`, titles only; the types the account's result does not need are shown under "Not in your audit type" and still allowed), a title field for the provider's own document name (120 characters, the gate applies), and the text: pasted, or a PDF, DOCX or TXT up to 5 MB, read by REQ-033's reader with its caps (SR-1 there) and discarded in the request. The page says above the control: "Readyline reads your document once, compares it with its outline for this document type, and keeps only the list below. The file and its words are not stored." (D-2962).
- **FR-2 The gate.** The whole text runs through the participant detector (REQ-003 SR-2, all five rules) in the browser as it is pasted and again on the server before the model request. A flagged text is refused with the detector's sentence and the line "Remove the names or details it points to, then run the check again"; nothing is sent (D-2963, the REQ-033 FR-2 rule on a bigger input).
- **FR-3 The request.** One model request per check (prompt `gap-check-1`): the document type's title and kind, its outline as the generator holds it (every numbered section's id, heading, brief and the standard and indicator ids the catalogue gives it), the provider's text as data, and the instruction to answer for each section one of `covered`, `partly`, `missing` with one reason sentence that names what the outline asks for and does not quote the provider's document. The reply is read as JSON against the outline: a section id outside the outline is dropped; a missing section is `missing`; a reason that contains any run of eight consecutive words from the provider's text is replaced by the fixed sentence "The outline asks for this; your document does not say it in a way the check could find." (lawyer, D-2964). The request goes through the generator's client, `GENERATION_FAKE=1` answering from the request (a section is `covered` when its heading's words appear in the text, else `missing`), the daily quota spent only when the model is called, and an hourly limiter of three checks per account (`GAP_CHECK_LIMIT`), the REQ-033 Session B pattern (D-2965).
- **FR-4 The result.** The gap list, stored as `gap_checks` (one row: account, document type, the provider's title, the run date, the counts) and `gap_check_sections` (one row per outline section: state, the reason sentence, the standard and indicator ids). The page shows: "Your <title> against Readyline's <document type> outline: 6 sections covered, 2 partly, 3 not covered", then the sections in outline order, each with its state, the reason, the indicator ids as the Standards name them ("Core 1.3, indicator 2") and, for `partly` and `missing`, "In the Readyline pack: <document title>, section N <heading>" linking into the account's newest set when it holds that document, otherwise into the catalogue entry on the documents page (D-2966). A section whose brief names a register says "Kept as a record: the <register name>" with the register's link. Nothing from the provider's document is shown back except the title they typed.
- **FR-5 Where it shows.** The documents page lists the account's gap checks with the date, the type and the counts, each opening its result; a second check for the same type replaces the list on the page and keeps the older rows (the result keeps its date). The checklist's document item for that type gains the line "Gap check <date>: 3 sections not covered" linking the result; the item's own status is untouched (NDIS expert, D-2967). The audit-day page's documents card counts "2 of your own policies checked, 5 sections to close".
- **FR-6 Words.** The page's intro, pinned: "Compare a policy you already have with the outline Readyline writes from the NDIS Practice Standards' quality indicators. The check tells you which sections of the outline your document covers, partly covers or leaves out. It is a comparison with Readyline's outline, not an audit, and an auditor may read your document differently." No "compliant", "pass", "approved", "meets the Standards" or "audit-ready" anywhere on the page or in a reason; the claims lint (REQ-012 Session B) runs over the fixed copy and the fake replies (lawyer, D-2968). The states' labels: "Covered", "Partly covered", "Not covered".
- **FR-7 The pages.** `privacy.md` gains one bullet under "What we collect": the gap check's list (the document type, the title you give it, the state and reason per section); the document itself is read once and not kept. `ai.md` gains one sentence: the text of a policy you ask Readyline to check is sent to the model once, after the participant check, and is not kept. Both pinned in `legal-copy.test.ts`; `ai.md`'s `updated` moves to 19 October 2026 (D-2969).

## Security and privacy

- SR-1 The reader's caps as REQ-033 SR-1 (5 MB, 60 pages, 10 s, sniffed type); the request body is the only place the file exists; no object storage call, no log line with the text (the log carries the type, the section count and the states).
- SR-2 The gate runs server-side before the model request; a flagged text is refused and nothing is sent (FR-2).
- SR-3 `gap_checks` and `gap_check_sections` under the account's RLS as the registers (owner writes, members read), in the grants list and the data-promises list; the export includes the rows; purge removes them.
- SR-4 Audit log rows for a check run and for a result opened by a member (D-2306 kinds).
- SR-5 The limiter (FR-3) and the daily quota are the cost controls; the checks page shows "3 checks an hour" above the button.

## Acceptance criteria

- AC-1 A pasted fictional complaints policy (`fixtures/gap-check/sample-policy.txt`, written to cover five of the outline's sections by heading and leave the rest) gives, under `GENERATION_FAKE=1`, five `covered` and the rest `missing`, in outline order, each `missing` with its pack link; the counts line matches (e2e, desktop and Android).
- AC-2 The same fixture as PDF and DOCX gives the same result; no object is written to storage; the log carries no word of the text (integration).
- AC-3 A text naming "Mr J. Smith" is refused before any request; the request count is zero (unit on the action, e2e for the message).
- AC-4 A reply with a reason quoting eight words of the input has that reason replaced by the fixed sentence; a reply naming a section outside the outline drops it; a reply missing a section marks it `missing` (unit).
- AC-5 The documents page, the checklist line and the audit-day count show the stored result after reload; a member reads the result and cannot run a check (e2e, integration RLS).
- AC-6 `legal-copy.test.ts` pins FR-6 and FR-7; the claims lint passes over the page's copy and the fake replies (unit).
- AC-7 The fourth check in an hour is refused with the limiter's sentence (unit on the action).
- AC-8 `npm run check` green; the a11y spec covers the page and a result at 360 and 1280.

## Lawyer's read (D-2962, D-2963, D-2964, D-2968)

The provider's document may not be theirs to copy: templates are licensed and consultants keep copyright. Reading it once to answer a question is the provider's own use; storing it, showing it back or letting the model's reason quote it would be ours, so the check keeps the list and nothing else, and the eight-word rule (D-2964) is the control that makes "nothing of your document is kept" true in the output as well as the database (D-2962). The gate on the whole text, server-side, before any request, keeps participant information out of the one feature where a provider might paste a case file by mistake (D-2963). The result is a comparison with our outline, said in those words; a state called "Covered" describes our outline, not the Standards, and the banned words keep it from reading as a verdict an auditor could be held to (D-2968). The AI and privacy sentences are the disclosure of a new, narrow purpose; they are pinned so the page cannot drift from the code.

## NDIS expert's read (D-2965, D-2966, D-2967, D-2969)

Auditors read a provider's policy against the quality indicators of the standard it serves, and the outline's sections already carry those indicator ids, so the gap list names what an auditor would look for without pretending to be one (D-2966). A section the outline keeps as a record (the incident register, the complaints register) is where most old policy sets fall down, because the policy promises a register that does not exist; the "Kept as a record" line sends them to the register, which is the subscription's reason to exist (D-2966). The checklist item's status stays the provider's own call: a "covered" outline is not an adopted policy with a review date and an approver, and the check must not tick it (D-2967). One request per check, limited, is enough: a provider has a handful of policies, not hundreds, and the fake mode gives the e2e a fixed answer so the walk is tested without a model (D-2965). D-2969: `ai.md`'s date moves because the disclosure changed, as it did for REQ-033.

## Dev response

(Dev-1 answers here: the branch, the outline's indicator ids as the catalogue holds them today, the prompt name, the fake mode's rule, questions.)

## Delivery evidence

(Dev appends: branch, commits, test counts, screenshots of the page and a result on desktop and Android.)

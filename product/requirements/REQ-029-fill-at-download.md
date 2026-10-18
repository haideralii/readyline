# REQ-029: Fill at download: the customer's details typed once, every document complete

Status: ready for Session A (PO, 18 Oct 2026 14:10; lawyer's and NDIS expert's reads applied as D-2854 to D-2863, D-2222)
Phase: 6 Priority: should Owner: Dev

## Why (user and business outcome)

- A pack's 15 to 24 Word files carry the same facts: who approves, their role, the date, how to reach them. Today the owner gives those once (REQ-017 FR-2) and the product writes them into every document's stored text as a new version (`rerender.ts`): a changed phone number is 16 new versions. D-541 says a blank is a fact, not content.
- After this REQ: the account holds the contact details, the adoption record holds who approved what and when, the stored document stays the template, and every downloaded file carries the values. Change your phone number and the next download is right; change who approves and the change log says so.

## Scope (in / out)

In, as two sessions:

- Session A: the form, the storage, the approver snapshot at adoption, the job no longer writing values into stored text, the single-document download and document page filled at read time, the legal lines (D-2858).
- Session B: the fill in the zip, the summary PDF, the Start here sheet, the once-rendered auditor pack, the register's line, the rule for older sets.

Out: participant or worker names as fields (CLAUDE.md 4.5; D-2406); blanks filled by hand in the signed copy (signature, register row templates, "[participant reference]"); the "[Provider to complete: …]" blanks in 33 recorded replies across six types, replaced at the next recording (D-542); any model call; the questionnaire.

## Domain rules that apply (link to product/domain)

`CLAUDE.md` 4.2, 4.3 (notices at the point of delivery, D-058), 4.5, section 5 (no urgency: an unfilled blank is a fact, never red). `house-style.md` "Tailoring" and "Fixed text we always include". `ui-copy.md`. REQ-016 S-2, S-8, D-541, D-1704. REQ-017 D-1702, D-1703. REQ-018 FR-13. REQ-026. REQ-024 FR-6b, SR-7, SR-8. REQ-020. REQ-015.

The blanks the code produces today (18 Oct 2026): every document's fixed text carries "[name], [role]" (Approver), "[date]", "[role]" (responsibilities) and "[name]" (change log); the AI appendix "[name]", "[role]", "[other tool]", "[allowed use]", "[limits]"; fallback text "[role]", "[notice period]" and "their representative [name]" (FR-7). "[phone or email]", "[state]", "[period]" and "[location]" are model-side and absent from the 185 parsed recorded replies.

## Functional requirements (numbered FR-1 ...)

- FR-1 **One form.** `/documents/[setId]/finish` becomes one page, "Your details", reached from the set page, every document page and the download button while a blank is open. It asks for every fact key the set's blanks use, once each, in this order: Your name; Your role; How workers reach you (phone or email); Your state or territory (pre-filled from the account when it has one); then the business facts the set needs (records period and location, notice period, the other digital tool). The approval date is not a field (D-2854). Business name and ABN show read-only. "Other digital tool" offers "None", which fills the three AI-appendix keys with the house-style no-tool sentence (D-2862).
- FR-2 **Stored on the account, not in the text.** Every value is one row in `account_facts` (D-1702), saved as each field loses focus, with "Saved" in words. The job stops applying facts before it stores a version (`job.ts` 478): every stored model and `.docx` keeps its brackets; `rerenderSetWithFacts` inserts no version for a fact change. A version changes only for content: a regenerated section, a rule change, a re-approval, a new pack.
- FR-3 **Two fills, one renderer.** Every download renders from the stored model by deterministic string substitution (`fillText`), never a model call; the `.docx` renderer needs no change: a filled blank is plain text and `runsFor` tints only the brackets left. (a) The live fill from the account applies only to "[phone or email]" and the AI-appendix answers on unadopted text. (b) The adoption fill: the Approver row, "[date]", the responsibilities "[role]" and the change log's "[name]" fill only from the adoption snapshot (FR-5) through `applyAdoption`; a draft shows those brackets (D-2854).
- FR-4 **An empty value stays a visible blank**: brackets and tint in Word, a line on the readiness summary, an open Start here line reading "Fill this in on your details page" or, for the Approver and date lines, "Fills in when you adopt this document". Never a silent blank (FR-6b's SR-8(c)).
- FR-5 **The approver is snapshotted at adoption** (D-2855). Adopting a group (D-1703) stores the approver's name and role from the account that day, with the date, on the adoption record; an adopted document fills from that record, never from the live account. Adoption with no name is refused: "Add your name on your details page first".
- FR-6 **A changed approver is a re-approval** (D-2855). Changing the name or role behind an adopted document goes through the adoption flow and makes a new version whose change-log row reads "Approver changed to [role]; re-approved", with the new snapshot and date; the account form says so under the two fields. A changed phone or email makes no version: the next download carries it, the register row gains "Contact details updated on 17 October 2026" (D-2856; the key's `updated_at`), and `audit_log` records the key, never the value.
- FR-7 **Only the closed list fills.** A "[name]" in the same sentence as "[participant reference]" is a Word blank, never the owner's name; a rule in `facts-fill.ts` makes that so. Row templates and signature lines stay REQ-026's "Fill in Word" lines.
- FR-8 **Business name and ABN** are written into the stored text at generation (`fixed-text.ts` 104), not as blanks. The Provider cell rebuilds the ABN part only, from the account at download; the trading name is never rebuilt, and a changed trading name is content that takes a new version (D-2857).
- FR-9 **Sets made before this REQ** keep the values in their text; their Start here sheet keeps REQ-026 FR-4's rule (done when the stored text carries no blank). The set page reads: "This set was filled before your details page existed; to change the name in it, regenerate the section or start a new pack." (D-2861). No migration rewrites text.
- FR-10 **Done means the record holds it.** For a template set, the sheet's ticks, the set page's count and the summary's count read one rule: a contact or AI-appendix blank is done when `account_facts` holds its key; an approver or date blank when the document is adopted.
- FR-11 **The auditor pack** is rendered once when the link is created, with both fills as they stand, and served for the link's life with the render date on its cover; a new link makes a new render (D-2863). Its cover note carries the zip cover note's general-information and AI statements; the owner's own pack renders on request, as today.
- FR-12 **Copy.** Every new string lives in a copy module the lint walks (REQ-015 FR-2). The form's warning reads exactly: "Your own name and details, nothing else. Never a participant's name, number, date of birth or address." (D-2860).
- FR-13 **Legal lines** (D-2858). `privacy.md` "What we collect" gains, verbatim: "Your name, your role and the phone number or email address you give us for your documents. We put them into every document you download, into your audit pack and into the auditor link you share, and we keep them while your account is open."; `terms.md`'s share sentence gains "and the name, role and contact details on your account" after "your records". PO copy, typed by Dev, held by `legal-copy.test.ts`; both updated dates move.

## Security and privacy requirements (numbered SR-1 ...)

- SR-1 The fields hold the owner's own business details; none is for a participant or a worker. The detector (CLAUDE.md 4.5) runs its number, date-of-birth and address parts on every field and its name part only on the free-text fields (other tool, allowed use, limits, location); it warns, never blocks (D-2860).
- SR-2 RLS as `20261014000000_account_facts.sql` grants it; the service role reads the facts for the job and the link's render; the worker role cannot open the form; the snapshot columns follow the adoption record's policies.
- SR-3 Values never reach the model, a log line, an error report (`redact.ts` gains the keys), a query string or an email.
- SR-4 The download routes keep their session, account, `isSetLocked` and `isOwnedPath` checks; every filled response is `Cache-Control: no-store`. The link's render is made under the admin client scoped to the link's account and served only through the link's checks.
- SR-5 Retention (D-2859): `account_facts`, the snapshots, the stored `set.zip` and `readiness-summary.pdf` (which carry the values) and the link's render are deleted with the account; the facts and snapshots are in the export.
- SR-6 Values are plain text of at most 200 characters; the server refuses control characters and square brackets, so a value is never read as a blank.

## Data (entities, fields, retention)

- `account_facts` unchanged; the `date` key is no longer written (D-2854). `document_versions` stays the template from this REQ on.
- The adoption record (the per-version row or `policy_reviews`; question 3) gains `approver_name` and `approver_role`, at most 200 characters, written at adoption and re-approval, never updated in place.
- The stored `set.zip` and `readiness-summary.pdf` carry the values (D-2859): rebuilt on every save of a fact or an adoption; deleted with the account. UNVERIFIED: whether rendering 16 to 24 documents in one request fits the route's time budget (question 1).
- The link's render: one stored zip per link, removed when the link ends and with the account.
- `audit_log`: `documents.details.saved` (key only); `documents.reapproved` (type, version).

## Acceptance criteria (Given/When/Then, numbered AC-1 ...)

- AC-1 Given the recorded sole-trader set and no facts, when the owner opens "Your details", then the form asks for each key the set's blanks use, once each, in FR-1's order, and no approval date.
- AC-2 Given the owner types a name, a role and a phone number, when each field loses focus, then "Saved" appears in words, three `account_facts` rows exist and no version row does.
- AC-3 Given AC-2 and no adoption, when the owner downloads the governance policy, then the Approver row still reads "[name], [role]" with its tint, the date "[date]", the change log "[name]", the footer the draft mark.
- AC-4 Given AC-3, when the owner adopts the governance group and downloads again, then the Approver row reads "Jane Citizen, Owner", the change log "Jane Citizen", the responsibilities row "Owner", the date is the adoption day, the draft mark is gone, and the stored model still carries "[name], [role]".
- AC-5 Given AC-4, when the owner changes the role to "Director", then the adopted document still reads "Owner"; when the owner re-approves, then a new version exists whose change log reads "Approver changed to Director; re-approved" with the new date, and the register's version moves.
- AC-6 Given AC-4, when the owner changes the phone number and downloads again, then the file carries the new number, the version is unchanged and the register's row reads "Contact details updated on <today>", no value shown.
- AC-7 Given AC-2, when the Start here sheet renders on screen and in Word, then the three AI-appendix lines are open with "Fill this in on your details page", the Approver and date lines read "Fills in when you adopt this document", and the top count equals the set page's; with "None", the three are done.
- AC-8 Given AC-4 and a subscription, when the owner creates an auditor link, downloads its pack, changes the phone number and downloads it again, then both files are byte-identical, the cover carries the render date and the two statements, and a new link's pack carries the new number.
- AC-9 Given a pre-REQ set whose text carries "Jane Citizen", when the owner changes the name, then that set still downloads "Jane Citizen" and the set page carries D-2861's sentence.
- AC-10 Given the service agreement's generic section and a name on the account, then "their representative [name]" keeps its brackets.
- AC-11 Given a 360 px viewport, when the form renders, then there is no sideways scroll, every field has a visible label and a 44 px target, the error summary links to each field, and axe is clean; likewise at 200 percent zoom.
- AC-12 Given square brackets in any field, then the server refuses them in words; given "Jane Citizen" in "other tool", then the name warning shows and the save goes through.
- AC-13 When `legal-copy.test.ts` runs, then both D-2858 sentences are present and the dates have moved.

## Test expectations (unit, integration, e2e, manual)

Unit: `facts-fill.ts` (FR-7; brackets refused; the live fill's key list; "None"); `adoption.ts` (the snapshot fills the four fixed blanks; a draft keeps them); the download render over the fixture set (AC-3, AC-4); the Start here builder (AC-7, N = 0, the pre-REQ rule); the register's lines; the pack's cover; the docx lint over the adopted render. Integration (Supabase job): RLS on the facts and snapshot columns; a fact save inserts no version; a re-approval inserts one; the link's render. E2E, desktop and Android (D-2207): the form through the guided path; AC-3 to AC-6 and AC-8; the width and keyboard checks. Manual: Haider opens one adopted document in Word on a laptop and an iPhone.

## Evidence required on delivery

Per session: `npm run check` and the CI run; screenshots of the form, the set page line and the sheet at 360 px and desktop; the draft and adopted governance policy and the sheet under `product/evidence/req-029/`, all from the fixture account (D-2859); the docx lint report; the `audit_log` and logger lines for one save and one re-approval, keys and no values; the whole-set `ms` figure; the legal diff; the ASVS rows; anything UNVERIFIED.

## PO decisions

- **D-2854 The approval date and the approver are not form fields (L-6, N-4).** "[date]" fills only from the adoption record; the Approver row stays bracketed until adoption; a draft shows the brackets. Why: a date typed before anything is approved records something that has not happened. Revisit: only on Commission guidance.
- **D-2855 The approver is a snapshot at adoption; a change is a re-approval (L-7, N-1, N-2, N-5).** The adoption record stores the approver's name and role that day; adopted documents fill Approver, "By whom", the responsibilities "[role]" and the date from it, never from the live account; a later change goes through the adoption flow and makes a new version with "Approver changed to [role]; re-approved". Live fill applies only to contact details and AI-appendix answers on unadopted text. Why: an auditor reads the approver and date as a record of who approved that version. Revisit: if re-approval proves heavy in the trial, make it one tap, never drop the version.
- **D-2856 The register line names contact changes only (N-9, L-7).** "Contact details updated on <date>" for phone or email alone; "Filled from your account details" goes. Why: with D-2855 nothing else changes under a version. Revisit: when another live key exists.
- **D-2857 Only the ABN cell rebuilds at download (N-3).** The trading name is never rebuilt; a changed name is content and takes a new version. Why: the name sits in tailored sentences and the approved control table. Revisit: if the control table changes shape.
- **D-2858 Two legal sentences (L-1, L-2).** `privacy.md` gains the FR-13 sentence verbatim; `terms.md`'s share sentence gains "and the name, role and contact details on your account"; PO copy, typed by Dev, held by `legal-copy.test.ts`; the dates move. Why: the auditor link now carries the owner's name and contact details. Revisit: the lawyer's next read.
- **D-2859 The stored derived files carry the values (L-3, L-10).** Data says so; SR-5 names them; rebuilt on every save, deleted with the account; evidence uses the fixture account only. Why: a stored file with a real name is personal information wherever it sits. Revisit: if the zip renders on request.
- **D-2860 The detector's name part runs on free text only (L-4, L-5).** Number, date-of-birth and address parts run on every field; the name part only on other tool, allowed use, limits and location; the warning text is in FR-12. Why: a warning that fires on the owner's own name teaches the owner to ignore warnings. Revisit: if a trial owner types a participant's name in a name field.
- **D-2861 Older sets keep REQ-026's rule (N-6, L-9).** A pre-REQ set's sheet marks a line done when the stored text carries no blank; FR-10 applies to template sets; the set page carries FR-9's sentence. Why: those sets hold the values in their text. Revisit: when no such set remains.
- **D-2862 "None" is an answer for the other tool (N-7).** It fills the three AI-appendix keys with the house-style no-tool sentence; Dev proposes it, the PO confirms. Why: most sole traders use no other tool. Revisit: at the next recording.
- **D-2863 The auditor pack is rendered once per link (N-8, L-8).** Rendered at link creation and served for its life, render date on the cover; a new link makes a new render; the cover note carries the zip's general-information and AI statements. Why: an auditor who downloads twice must get the same file; the statements belong at every point of delivery. Revisit: if a link outlives a re-approval, a "new pack available" line.

## Questions for Dev to answer before building

1. The zip and the summary PDF: render on each request, or rebuild the stored files on each save and keep the redirect? Recommendation: rebuild on save; give the measured `ms`.
2. REQ-017 FR-2 asks one question per screen on a phone; FR-1 makes the form one page. Keep the wizard on phones, or one page? Recommendation: one page; Haider decides.
3. The snapshot's home: `policy_reviews` or the per-version adoption row? Recommendation: per-version, since a re-approval is a new version.
4. The 33 "[Provider to complete: …]" blanks: leave them to the next recording (D-542)? Recommendation: yes.
5. Hours for Session A and B separately, what in B waits for REQ-020's auditor link on `next`, and the no-tool sentence for D-2862.

## Dev response

(Dev fills in.)

## Delivery evidence

(Dev fills in.)

## PO review

(PO fills in.)

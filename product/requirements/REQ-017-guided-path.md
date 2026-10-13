# REQ-017: The guided path: one step at a time, from the result to audit day
Status: ready (PO, 13 Oct 2026, from Haider's product principle)   Phase: 6   Priority: must   Owner: Dev
Depends on: REQ-006 (checklist), REQ-007 (payments), REQ-015 (plain language), REQ-016 (document standard, fill-in blanks)

## The principle (Haider, 13 Oct 2026; add to CLAUDE.md section 1 as a product rule)
Our customer is a support worker who does not like paperwork, is not technical and may not have done well at school. The site must work for that person. After the questionnaire they do not want options; they want to be taken by the hand, one step at a time, told exactly what to do next and shown when it is done. Every screen after the result answers one question: "What do I do now?" Anything that makes them read, decide or search is a cost we pay for in lost customers.

## What the path looks like
1. **Result** (REQ-015 card): one button, "Start getting ready".
2. **Before you buy**: one screen, three lines: what you get, the price, the refund promise; one button "Get my documents"; the sample document link for the cautious.
3. **While we draft** (REQ-010 batch 32): "You can close this page; come back in about 20 minutes." with a progress line that counts documents, nothing else.
4. **Finish your pack**: a guided form, one question per screen, that collects every blank the documents still need (name of the person responsible, phone or email, approval date, state), in plain words with an example under each field, with Back and Next only. On the last screen the documents are re-rendered with the answers filled in, so the provider never opens Word to fill a blank. Answers are saved to the account as facts for every future document.
5. **Adopt**: one screen per document group (Running the business; Your workers; Participants and supports; Environment and safety): the document names with a two-line summary each and one button "These are our policies" that marks them adopted (REQ-006), sets the approval date, removes the draft footer (REQ-016) and seeds the policy review register (REQ-009). A provider who wants to read first taps the name and reads it on the page.
6. **Your audit checklist**: the REQ-015 task list, but opened on "Next three things", with each item written as an instruction ("Ask each worker for their NDIS Worker Screening clearance and type the expiry date here"), one tap to do it, and the count of what is left.
7. **Audit day**: one page, printable: what the auditor will ask for, in the order they ask, with a tick for each thing the provider has, the download of the full pack, and the readiness summary. Written as a conversation, not a list of standards.

## Functional requirements
- FR-1 A persistent "Your next step" strip at the top of every signed-in page: one sentence and one button, computed from the account's state (questionnaire done, paid, pack generating, blanks left, documents not adopted, checklist items left, registration date not entered). It never shows two things.
- FR-2 The Finish your pack form (step 4): fields come from the blanks the generator recorded (REQ-016 S-8); one per screen on phones, grouped by topic on desktop; examples under each field; the participant-data warning once; re-render on finish; a confirmation that reads "Done. Your 22 documents are complete."
- FR-3 The Adopt screens (step 5) and the audit-day page (step 7) as described, both printable, both passing copy-lint and the width check.
- FR-4 Every step is resumable: closing the phone and coming back a week later lands on the same step with the same words.
- FR-5 No screen on the path has more than one primary button, one heading, and three lines of text above the control.

## Acceptance criteria
- AC-1 Haider's test: a person who has never seen the site completes result to audit-day checklist on a phone without asking a question, and can say at every screen what to do next.
- AC-2 After step 4, the fixture pack renders with zero blanks; the facts persist and appear in a second pack.
- AC-3 The next-step strip is right in every account state (unit test over the state table).

## Dev response
**14 Oct 2026, batch 34 (branch `req-017-guided-path`, from `req-016-document-standard`). No model calls.** Decisions D-1701 to D-1703; the principle paragraph is in `CLAUDE.md` section 1 (v2.7).

- **FR-1.** `nextStep(state)` is a pure state table (eight rows, first match wins) with a unit test per row (AC-3); `NextStepStrip` in the root layout reads the state once per signed-in page and renders one sentence and one button; nothing signed out.
- **Step 2.** `/path/before-you-buy`: three lines (what you get with the real document count, the price from config, the first paragraph of the refund promise from `refunds.md`), one button (the existing Buy action with its own cancel path), the sample link. A paid provider is sent on.
- **Step 3.** The documents page's preparing state from batch 32 ("You can close this page…" with the document count); the strip says the same.
- **FR-2.** `/documents/<set>/finish` is the form: one question per fact across the whole set (the "[name]" asked for in thirty documents is one question), with an example under each, one per screen on a phone with Back and Next, grouped by topic on desktop; the participant-data warning once; every answer saved to `account_facts` as it is given; the last screen re-renders every document (new versions, fresh summary and zip) and reads "Done. Your N documents are complete." The job fills a new pack from the same facts (AC-2 in `job.test.ts`).
- **FR-3.** `/path/adopt/<group>`: one screen per group in audit order, names with the catalogue purpose as the two-line summary, names as links, one button; adopting marks checklist Done, sets the adopted date, seeds the policy review register, saves the approval date and re-renders. `/path/audit-day`: the auditor's questions in order with a tick each, the pack download, the summary; both pages print.
- **FR-4.** Every path page derives from the same state and the strip always points at the current step; the finish form resumes at the first unanswered question; the adopt door lands on the first group left.
- **FR-5.** `tests/path-screens.test.ts` fails a path screen with more than one primary button, one h1, or three paragraphs above the control.
- **Not done here, for the PO:** the checklist items rewritten as instructions ("Ask each worker for…") is REQ-006 copy for thirty items; I left the titles and opened the checklist as REQ-015 built it. AC-1 (Haider's test on a phone) is his to run. The e2e that walks the path on the three projects needs this branch's migrations, so it runs in CI's Supabase job.

## Delivery evidence
**14 Oct 2026, batch 34, branch `req-017-guided-path`** (SHA in the NEXT.md status).

- `npm run check` and `npm run build` green (outputs in the NEXT.md status). Unit: the state table (`next-step.test.ts`, AC-3), the fact mapping and filling (`facts-fill.test.ts`), the job filling a later pack from saved facts (`job.test.ts`, AC-2), the screen rule over every path page (`tests/path-screens.test.ts`, FR-5), copy-lint over the new screens.
- Migration `20261014000000_account_facts.sql` (owner-scoped facts; `migrate.yml` applies it on merge).
- `e2e/signed-in/guided-path.spec.ts` on the three projects (desktop, small Android, iPhone): a fresh account from the result to the audit-day page with the strip checked at every stage, screenshots under `product/evidence/req-017/` (`before-you-buy`, `while-we-draft`, `finish-pack`, `finish-done`, `adopt-group`, `checklist`, `audit-day`) with `EVIDENCE=1`. It runs in CI's Supabase job; the hosted project lacks this stack's migrations, so it cannot run on the Dev machine yet.
- AC-1 is Haider's walk on his phone once the branch is deployed.

## PO review
(PO fills in.)

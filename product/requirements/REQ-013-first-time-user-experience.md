# REQ-013: First-time user experience and accessibility fixes
Status: ready
Phase: 4 (items P1 before public launch); P2 items in Phase 6   Priority: must (P1), should (P2)   Owner: Dev

## Why
The PO walked the questionnaire on 12 Oct 2026 at phone size as a first-time, non-technical sole trader (the actual customer). The flow works and is honest, but several things would stop or confuse that person, and two are accessibility defects the automated checks (axe, Lighthouse) do not catch. These are cheap to fix now and expensive in lost sign-ups later.

## Findings and requirements

### P1: before public launch
- FR-1 **Validation messages are developer text.** Submitting step 1 empty shows "Too small: expected string to have >=1 characters" and "Invalid option: expected one of 'sole-trader'|'partnership'|...". Replace every message with plain English per field ("Enter your trading name", "Choose your business structure", "Choose at least one state or territory"), via a field-to-message map, and test that no raw zod message can reach the UI (unit test over every schema error path). The ABN message is already right; copy its style.
- FR-2 **Screen-reader names.** Registration-group checkboxes are announced as the code only ("0107"); radios are announced by value ("sole-trader", "not-sure"); the business structure, states, restrictive-practices, workforce and "already have" groups have no `fieldset`/`legend`, so the question is not announced with its options. Fix: visible label text as the accessible name (code as secondary text), `fieldset` and `legend` for every radio or checkbox group, and an e2e assertion using the accessibility tree that each control's name is its human label. Add a manual screen-reader pass (NVDA or VoiceOver) to the Definition of Done for form steps.
- FR-3 **Supports step leads with jargon.** "Registration groups (class of support)" and "0101 Accommodation/tenancy assistance" is the first thing a support worker sees. Re-order: lead with a plain question ("What do you do for participants?") and group the 38 classes under everyday headings (personal care at home; help around the house and getting out; therapy and health; equipment and modifications; housing and living arrangements; children and families; specialist supports; business and platform services), codes shown as secondary text, audit type shown as a small tag. Add search synonyms (support worker, cleaning, community access, SIL, group home, transport, respite, cooking) to the descriptions data. Add a "Not sure? Most sole-trader support workers choose Assistance with daily personal activities and Household tasks" hint that selects both when tapped.
- FR-4 **Restrictive practices step frightens or misleads.** The explanation is a paragraph of regulation; "Not sure" silently adds a module and two documents. Add three concrete examples in plain words (locking a cupboard or door to stop someone getting something; holding someone to stop them moving; medicine given mainly to control behaviour), a "What counts?" expander, and make "Not sure" open three yes/no helper questions that resolve to yes or no, with the assumption shown on the result page only if it still resolves to yes.
- FR-5 **Result page overwhelms.** 24 documents in a flat list. Add a three-line summary at the top ("Your audit: certification. You will need 24 documents and 5 registers. Readyline can draft the documents and keep the registers."), a plain-words paragraph on what certification means in practice (someone visits, talks to workers and participants), and group the document list by the four headings (Running the business; Your workers; Participants and supports; Environment and safety). Keep the sources.

### P2: soon after launch
- FR-6 Number fields use `inputmode="numeric"`; sole traders get defaults (workers 1, key personnel 1, risk-assessed role yes) that they can change.
- FR-7 Step indicator wraps to two rows on phones; replace with "Step 2 of 6: Supports" plus a progress bar, keeping the links for completed steps.
- FR-8 Home page before launch: replace "is being built" with the value proposition, "free, about ten minutes", and trust cues (Australian-hosted, no participant data, independent of the NDIA and the Commission), plus one example result.
- FR-9 A visible way to ask a question (contact email) in the footer and on the result page.
- FR-10 "Key personnel" and "risk-assessed role" get one-line examples under the labels.

## Acceptance criteria
- AC-1 Submitting each step empty shows only plain-English messages; a unit test proves every schema error maps to a message.
- AC-2 Accessibility-tree test: every radio and checkbox in the questionnaire has its human label as its accessible name and belongs to a fieldset with a legend; manual screen-reader pass recorded in evidence.
- AC-3 Supports step shows the everyday groupings; searching "support worker", "cleaning" and "SIL" each return the expected classes; the hint selects 0107 and 0120.
- AC-4 "Not sure" on restrictive practices opens the helper and resolves to yes or no; the result page shows the assumption only when the resolution is yes.
- AC-5 Result page shows the summary and grouped documents; Lighthouse accessibility stays 100 and axe stays clean on both projects.

## Evidence required on delivery
Screenshots at 360x740 of every changed step; the accessibility-tree test output; a one-paragraph screen-reader walkthrough note.

## Dev response

Written 2026-10-12 on branch `req-013-first-time-ux` (from `main` at aa52c8a), alongside the P1 build (batch 9 item 2 asked for the build directly).

- FR-1: messages live in the zod schemas themselves (`error` option on every field, D-1301), so the client, the server action and any later API say the same words and a message cannot be missed by a separate map; `messages.test.ts` is the unit test over every schema error path (AC-1).
- FR-2: `ChoiceRow` gives every radio and checkbox an `aria-labelledby` name from the visible label only, with codes and help as `aria-describedby`; groups are fieldsets with legends (they already were; the group checkboxes were the case where the code led the name). The accessibility-tree test reads the computed name and legend of every control on every step (AC-2). A manual NVDA or VoiceOver pass is now in the definition of done; Dev has no screen reader on the build machine, so that pass is recorded as owed (see Delivery evidence).
- FR-3: groupings, question and hint are Readyline data with a coverage test; synonyms added to the descriptions data under their own draft status so the PO's reviewed descriptions stay as reviewed (D-1303). The Commission's names, codes and audit types are unchanged; the audit type becomes a small "desk audit" or "site audit" tag per row.
- FR-4: "not sure" stays a valid stored answer (old drafts keep working) and a required three-question helper resolves it in the schema (D-1304); the result page shows the assumption only when the helper resolved to yes (AC-4).
- FR-5: the four headings are Readyline data (D-1305) with a coverage test that also tolerates the two document ids REQ-005 adds on PR #9; summary line and the plain "in practice" sentence per pathway.
- Order followed: Session 1 (FR-1, FR-2) pushed first, then FR-3, then FR-4, then FR-5, each with its tests.


## Delivery evidence

### P1 (2026-10-12), branch `req-013-first-time-ux` from `main` aa52c8a; commits 44b8f1b (FR-1, FR-2), 3c36a0a (FR-3), 6ba2416 (FR-4), b19776a (FR-5)

**FR-1 / AC-1.** Every step schema field carries a plain message (`schema.ts`; `text()` takes a required message and a plain type message). `src/lib/questionnaire/messages.test.ts` submits every step empty, with wrong types and out-of-range values and rejects any message shaped like zod's defaults (expected/received, invalid option, too small, type names); it also pins the three step-1 messages. Screenshot `1-business-plain-errors-*.jpg`: "Enter your trading name", "Choose your business structure", "Choose at least one state or territory".

**FR-2 / AC-2.** `ChoiceRow` in `fields.tsx`: accessible name from the visible label via `aria-labelledby`; class code and help text via `aria-describedby`; every radio and checkbox group is a fieldset with a legend. `e2e/questionnaire-a11y-tree.spec.ts` walks every radio and checkbox on the five answer steps (69 controls per project), reads the computed name and legend, fails on an empty name, a raw value or a leading class code, and cross-checks with Playwright's accessible-name computation; passes on both projects. Output: `product/evidence/req-013/accessibility-tree-{desktop-chromium,android-small}.json` (step, id, value, name, legend for every control). The manual screen-reader pass is added to `product/qa/definition-of-done.md` item 7.

**Screen-reader walkthrough note.** Dev's build machine has no NVDA or VoiceOver, so the manual pass could not be done here and is owed by Haider; what the automated tree shows is what a screen reader will announce: on the supports step a checkbox is announced as "Assistance with daily personal activities, checkbox, not checked" with "0107" and the description read as the description, inside the group "What do you do for participants?"; on the business step "Sole trader, radio button" inside "Business structure" with the help text as description; on the practices step "Not sure, radio button" inside "Do you use, or plan to use, any of these with a participant?", and the three helper questions each as their own group. Haider: run NVDA on Windows through the five steps, confirm the announcements match, and note any surprise in the PO review.

**FR-3 / AC-3.** Supports step leads with "What do you do for participants?"; the 38 classes sit under eight everyday headings from `data/readyline-content/group-categories.json` (test: every class exactly once), codes as secondary text, a "desk audit" or "site audit" tag per row, search over code, name, description and the new `synonyms` in `registration-group-descriptions.json` (draft status, PO's descriptions untouched), and the hint with a "Choose those two for me" button that ticks 0107 and 0120. Unit test: "support worker", "cleaning" and "SIL" each find the expected class. e2e: groupings visible, the three searches, the hint ticks both. Screenshots `2-supports-everyday-groupings-*`, `2-supports-search-cleaning-*`, `2-supports-hint-applied-*`.

**FR-4 / AC-4.** Three plain examples, a "What counts?" expander holding the Commission's definition and link, and three helper questions under "Not sure" (`notSureHelper` in the schema, `resolveRestrictivePractices`). Unit tests: all-no resolves to no with no module and no flag; one yes adds the implementing module and sets the flag. e2e: the helper must be answered (plain error), the live resolution text, no module and no assumption on the result for all-no; the existing "not sure" test keeps the yes path. Screenshots `3-practices-examples-*`, `3-practices-not-sure-helper-*`.

**FR-5 / AC-5.** Summary block ("Your audit: certification. You will need 22 documents and 5 registers. Readyline can draft the documents and keep the registers.") with a plain "in practice" sentence per audit type; documents grouped under the four headings from `document-groups.json` (test: every document exactly once; two ids REQ-005 adds are listed as pending). Sources unchanged. e2e: summary and group headings. axe spec: zero serious or critical violations on every step including the helper state, both projects. Lighthouse 12.8 accessibility 100 on `/start/business` mobile and desktop and `/start` mobile (`product/evidence/req-013/lighthouse-summary.json`). Screenshot `6-result-summary-and-groups-*`.

**Local outputs:** `npm run check` clean (28 files, 266 tests); `npm run build` ok; Playwright CI mode: questionnaire 26, axe 2, accessibility tree 2, screenshots 2 passed on both projects. Not merged; the PO reviews the UI. CI link: the PO verifies on GitHub (Dev cannot read Actions).


## PO review
(PO fills in.)

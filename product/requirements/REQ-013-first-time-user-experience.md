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
- FR-11 Supports step groups collapsed by default on phones with the count and a one-line description visible, the two most common groups ("Personal care at home", "Help around the house and getting out") open; a search or the hint expands the groups that contain matches; ticked classes stay visible when a group is collapsed.
- FR-12 Result page: fold the "Your audit" explanation into the summary block and drop the repeated heading.

## Acceptance criteria
- AC-1 Submitting each step empty shows only plain-English messages; a unit test proves every schema error maps to a message.
- AC-2 Accessibility-tree test: every radio and checkbox in the questionnaire has its human label as its accessible name and belongs to a fieldset with a legend; manual screen-reader pass recorded in evidence.
- AC-3 Supports step shows the everyday groupings; searching "support worker", "cleaning" and "SIL" each return the expected classes; the hint selects 0107 and 0120.
- AC-4 "Not sure" on restrictive practices opens the helper and resolves to yes or no; the result page shows the assumption only when the resolution is yes.
- AC-5 Result page shows the summary and grouped documents; Lighthouse accessibility stays 100 and axe stays clean on both projects.

## Evidence required on delivery
Screenshots at 360x740 of every changed step; the accessibility-tree test output; a one-paragraph screen-reader walkthrough note.

## Dev response
(Dev fills in.)

## Delivery evidence
(Dev fills in.)

## PO review
**12 Oct 2026, P1 review (branch `req-013-first-time-ux` at 62dec64): ACCEPTED CONDITIONALLY.** Screenshots at 360x740 reviewed for every changed step; the five P1 items are built as specified and the accessibility-tree evidence is what AC-2 asked for. The approach decisions D-1301 to D-1305 are accepted. Merge after the four fixes below land on the branch and CI is green; none needs a new session.

Fixes (P1, must land before merge):
- R-1 **Within-group order ignores the data.** `group-categories.json` lists 0107 before 0104 under "Personal care at home", but the rendered step shows 0104 High Intensity first. The UI sorts by code. Render in the order the data gives (the PO orders each group by how common the class is for small providers), and add a test that the first rendered row of "Personal care at home" is 0107.
- R-2 **Code still leads the row.** "0104 High Intensity Daily Personal Activities" is still read left to right as code first, which is what FR-3 set out to stop. Put the class name first and the code after it in the same muted small text, or on its own line under the name, on both viewports.
- R-3 **Audit tag wraps.** At 360 px "desk audit" breaks into "desk" and "audit" on two lines on long names (0108, 0114). Give the tag `white-space: nowrap` and let it drop to its own line under the name when the name is long, rather than splitting the tag.
- R-4 **Seclusion is missing from the helper.** The Commission's five regulated practices are seclusion, chemical, mechanical, physical and environmental. Helper question 1 covers environmental, question 2 mechanical and physical, question 3 chemical; nothing asks about seclusion. Extend question 1 to "Do you ever lock a cupboard, fridge, door or gate so a person cannot get to something or somewhere, or keep a person alone in a room they cannot leave?" and the example to include "shutting someone in their room until they calm down". Update the unit test and the screenshot.

Noted, not blocking (becomes P2 FR-11 and FR-12 below):
- The supports step is about 8,000 CSS pixels tall on a phone with every group expanded; a first-time user who only does personal care scrolls past 30 classes they will never tick.
- The result page's second "Your audit: certification" heading now repeats the summary block's first sentence.

Owed by Haider: the manual NVDA pass (definition of done item 7); recorded here when done, not blocking the merge.

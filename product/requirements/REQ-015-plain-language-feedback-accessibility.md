# REQ-015: Plain language, feedback on every action, and an accessibility pass
Status: ready (written 13 Oct 2026)   Phase: 6 (before the first trial provider)   Priority: must   Owner: Dev
Depends on: REQ-013 (first-time UX), REQ-014 (identity), REQ-006 (checklist)

## Why
Haider walked the live site on his phone on 13 Oct 2026 as the customer would. Three things stood out: the result page is still a wall after the questionnaire; paragraphs everywhere are long and written for someone who already knows the rules; and tapping a control (a checklist status, a link) gives no sign that anything happened. The PO reproduced all three on a 375-px viewport and found two defects on the way (an internal file path shown to the customer; a status tap that did not register). Our customer is a support worker with a phone, not a compliance officer with a laptop. Every page must pass the "tired person on a bus" test: the answer first, one next step, nothing to decode.

## Standards we hold to (the research behind the rules)
- **WCAG 2.2 AA**, including the 2.2 additions: focus not obscured (2.4.11), target size minimum 24 px (2.5.8), dragging alternatives (2.5.7), consistent help (3.2.6), redundant entry (3.3.7), accessible authentication (3.3.8; magic link already satisfies it).
- **Australian Government Style Manual** (stylemanual.gov.au) for plain language: lead with the point, one idea per sentence, average under 20 words, everyday words, no code before its name, numbers as numerals, active voice.
- **GOV.UK Design System** patterns: one thing per page, error summary at the top linking to each field, a single primary action per screen, status tags with text not colour alone, "task list" pattern for the checklist.
- **Nielsen Norman** feedback heuristic: every action gets a visible response within 100 ms (pressed state), a system status within 1 s (saving, saved, failed), and an undo where the action is reversible.

## Functional requirements

### A. Plain-language rules, enforced by a test
- FR-1 **Copy rules** in `product/domain/house-style.md` (PO maintains): sentences under 20 words on average and never over 30; a paragraph is at most 3 lines on a 375-px screen (about 45 words); the first sentence of any page or card is the answer or the action, not the background; a code (0107, 2.4.11) is always after its plain name and in secondary text; no words from the list: "leverage", "utilise", "in order to", "pursuant", "N/A"; "you" and "your", never "the provider" when talking to the customer.
- FR-2 **Copy lint test** (`tests/copy-lint.test.ts`, in `npm test`): walks every string in the copy modules and the content JSON that reaches the UI and fails on a paragraph over 60 words, a sentence over 35 words, any of the banned words, and any internal path or file name (`src/`, `data/`, `.json`, `.ts`, `.md`) in customer-facing text. The checklist's "Source: Readyline document set mapping (data/readyline-content/document-sets.json)" is the defect that motivates the last rule; the source line becomes "Every registered provider needs this" with no path.
- FR-3 **Rewrite pass** over: home (already shortened in batch 26), `/start` intro and each step's intro, result page, checklist, pricing, documents, account, sign-in, the four legal pages' intros (not the legal body). The PO reviews the before and after as a two-column table in the Delivery evidence; Dev does the first draft from FR-1.

### B. Result page: answer first, everything else folded
- FR-4 The first screen on a phone is one card: "Your audit: certification" as the heading; one sentence of what that means in practice ("An auditor visits you, talks to your workers and some participants, and reads your documents."); the counts line; the progress line; **one** primary button "Open your checklist" and one text link "See the price". Nothing else above the fold. The duplicate "In practice" / "A full audit" paragraphs become one.
- FR-5 Below the card, three closed disclosures with counts in the summary: "Why this result (3 reasons, with sources)", "Documents you will need (24)", "Registers to keep (5)". Documents stay grouped under the four headings, each group a nested disclosure closed by default, with the group's "to prepare / you have / not sure" counts in its summary. The "You said" labels become small tags with an icon, not a second line.
- FR-6 "Back to: Business, Supports, …" becomes one link "Change my answers" (the per-step links move into the disclosure "Change a step"). "Groups in scope" renders as two chips under the heading. The questions-by-email paragraph becomes one line with the address as a link. "Clear the draft on this device" asks for confirmation.
- FR-7 Disclosure state is remembered per device so returning to the result page keeps what the person opened.

### C. Checklist: a task list, not 40 forms
- FR-8 Top of page: the counts line and a "Next three things to do" block, chosen as the first three items with status Need in audit order. One tap on an item in that block scrolls to it and opens its group.
- FR-9 Each item is one row: name, status tag (Need / In progress / Adopted, with icon and text), the "Drafted" badge when a document exists, and a chevron. Tapping the row opens it: the one-line why, the status control, "Add a note" (the textarea hidden until tapped), and a link to the drafted document when there is one. Groups collapsed by default except the first with an open item.
- FR-10 The status control is a segmented control with a visible selected state within 100 ms (optimistic), then "Saved" with a tick beside it for 2 seconds and in an `aria-live="polite"` region; on failure the control reverts and shows "Not saved, try again" with a retry. The three options never wrap on a 375-px screen (shorter labels: "Need", "Doing", "Done", with "Done" explained once at the top as "reviewed and adopted"; the stored value stays `have`/`adopted`, only the label changes).
- FR-11 The participant-data warning appears once at the top, not under every note field; the note field carries it as placeholder text only.
- FR-12 Changing a status that affects the ready count updates the count line immediately and announces it.

### D. Feedback on every action, site-wide
- FR-13 Pressed and focus states: every button, link and control has a visible `:active` state (background shift, not only opacity) and a 2-px focus ring that is never hidden by a sticky element; the ring is the ochre token on light and dark.
- FR-14 Navigation feedback: a 2-px progress line across the top of the page during route changes (Next.js `loading.tsx` plus a top-bar component), and the tapped link stays in its pressed state until the new page paints; no page may look idle for more than 300 ms after a tap.
- FR-15 Form feedback: the submit button shows a spinner and "Saving…" and is disabled while pending; success shows the next step or an inline "Saved"; failure shows an error summary at the top with a link to each field and moves focus to it (GOV.UK pattern). Destructive actions (clear draft, delete account, sign out everywhere) confirm first; reversible ones (status change) offer undo for 5 seconds.
- FR-16a **No sideways movement.** Haider saw pages slide sideways on his phone (content wider than the screen, so the page pans horizontally). That is a defect on any page. Find the element that is wider than the viewport (likely candidates: the sample document's tables on the home page, the "Back to" step row and the nav badge on the result page, the three status pills on the checklist, long unbroken strings such as email addresses and URLs) and fix it at the source (tables scroll inside their own container with a visible edge, pills wrap or shrink, long strings get `overflow-wrap: anywhere`); do not hide it with `overflow-x: hidden` on the body. Add an e2e assertion on every page at 360 and 375 px: `document.documentElement.scrollWidth <= window.innerWidth`.
- FR-16 Touch targets at least 44 × 44 px on phones; the nav never wraps at 375 px (the "In development" badge is already removed in production by batch 26; in previews it moves under the logo).

### E. Accessibility pass (manual, with evidence)
- FR-17 Dev runs and records: keyboard-only walk of the whole purchase path; 200 % zoom at 1280 px without horizontal scroll; `prefers-reduced-motion` honoured on every animation; colour never the only signal (status tags, drafted badge, result line); heading order on every page (one `h1`); page titles unique and descriptive; `autocomplete` attributes on business name, email, postcode, state; skip link present and visible on focus.
- FR-18 Screen-reader pass by the PO (NVDA on Windows) and by Haider (VoiceOver on iPhone) over sign-in, questionnaire, result, checklist, documents: each page's reading order makes sense, each control announces its label and state, each status change is announced. Findings go into the REQ's PO review.
- FR-19 axe and Lighthouse accessibility stay at zero violations / 100 on every page; the copy-lint and target-size checks join the e2e specs.

## Security and privacy requirements
- SR-1 No new third-party scripts or origins (CSP unchanged); progress and disclosure state are stored in `localStorage` only with non-personal keys.
- SR-2 Undo and optimistic updates never send a second write with the same idempotency key; the server remains the source of truth and the UI re-reads after a failure.

## Acceptance criteria
- AC-1 Phone walk by the PO: from the result page, the audit type, what happens, the counts and the one next button are visible without scrolling at 375 × 812; every paragraph on the walked pages is 3 lines or fewer; no internal path or file name anywhere.
- AC-2 Checklist: tapping a status shows the selection at once and "Saved" within 1 s on the hosted site over 3G throttling; the count line updates; a forced failure reverts and shows the retry.
- AC-3 Copy-lint test is in `npm test` and fails on a seeded banned word, a 70-word paragraph and a `data/` path.
- AC-4 Keyboard and zoom checks in FR-17 recorded with screenshots under `product/evidence/req-015/`; axe clean and Lighthouse 100 on home, start, result, checklist, pricing, documents, account.
- AC-5 The two screen-reader passes done and their findings closed or scheduled.

## Ideas parked for later (not in this REQ)
Email me my result (needs D-013), a one-page printable result, a "what changed since last time" line when answers change, a guided tour on first checklist visit, a plain-language glossary page linked from every code, an optional phone call-back request, Urdu/Arabic/Vietnamese/Chinese versions of the questionnaire intro and the result card (the four largest language groups among small NDIS providers in Sydney and Melbourne; worth testing with the trial providers before building).

## Dev response
(Dev fills in.)

## Delivery evidence
(Dev fills in: before/after copy table, screenshots, test names.)

## PO review
(PO fills in.)

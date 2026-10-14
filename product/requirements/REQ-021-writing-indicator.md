# REQ-021 The writing indicator: what the provider sees while their pack is being written

Status: approved by PO, 14 Oct 2026. Origin: Haider's request after watching the counter during generation ("is it still going?"). Extends REQ-017 step 3 ("While we draft") and REQ-014 (visual identity). One component, `WritingIndicator`, used on the While-we-draft screen and, later, for a single-section re-generate (backlog 8).

## Principle

The indicator shows what the server is actually doing, in the provider's words, and never pretends. Every label maps to a real job state; the animation moves only while progress is arriving; the end screen hands the provider to the next step of the guided path. No countdown, no percentage that cannot be trusted, no "good luck" promise about the audit.

## The states and their words (product and UX)

The pack job already has states (REQ-005, D-057). Map them to five phases the provider sees, with one short line each:

1. Preparing (job created, context pack being built from the answers; usually under 20 seconds): "Getting your answers ready." Icon: page outline, pen still.
2. Writing (model calls for the current document): "Writing document 7 of 16: Complaints management policy, section 3 of 6." Icon: lines appear on the page one by one, the pen nib moves along the current line. The document name is the canonical name from the naming table.
3. Checking (lints, reading level, claims, contact details, record names on the finished document): "Checking it against our rules." Icon: a small tick appears on the page, pen lifts.
4. Assembling (docx render, numbering, document control table): "Putting your files together." Icon: pages stack.
5. Ready (set ready): "Your 16 documents are ready." Below it, the next step from the guided path as the primary button: "Finish your pack (3 blanks to fill)" or, when there are none, "Read and adopt your documents". Download is the secondary action. Warm line, no outcome promise: "Take your time with the next step; nothing is lost if you close this page."

Each document moves through 2, 3 and 4 in turn; the counter counts a document as written only after 4. The phase line changes at most once a second; the document name changes when the job reports the next document.

## Every scenario (dev, QA, UX, UI)

S1 Happy path, desktop and phone. The five phases in order; the counter never goes backwards; the numbered list of documents below shows written (tick), current (pen), waiting (grey), in the set order. On a 360 px phone the list is one column and the indicator sits above the fold with the counter; no sideways scroll.

S2 Phone locked or tab in the background. Progress is read from the server (the existing job status endpoint), never from a client timer, so on return the page shows the true count ("While you were away we wrote 5 more; 12 of 16 done") and the kicker (D-057, D-059) kept the job moving. Visibility change triggers one immediate refresh.

S3 Quiet feed. If no progress event arrives for 90 seconds the animation pauses, the pen lifts, and the line reads "Still working on Complaints management policy; this one is taking longer." At 5 minutes: "Taking longer than usual. You can close this page; we keep going and the documents page will show the result." The animation never runs while the feed is quiet.

S4 One document fails (model error, lint failure after the retry budget, render error). The counter splits: "13 written, 1 needs another go, 2 waiting"; the failed document shows a plain line and a "Try again" button for that document only; the rest continue. The pack is not "ready" until every document is written or the provider chooses to continue without the failed one (the documents page then shows it as missing with the same button).

S5 Fallback sections (D-542 blanks) are not failures; the document counts as written and the blanks appear in Finish your pack. The indicator never mentions the model, fallbacks or lints by name.

S6 Page opened after the set is already ready: no animation at all; the Ready state renders at once.

S7 Offline or failed status request: last known state stays on screen with a small "Reconnecting" dot and no movement; three failures in a row show "We cannot reach the server right now; your pack keeps being written." and retry with back-off.

S8 Two tabs or two devices: both read the same server state; nothing is stored only in the browser.

S9 Reduced motion: the pen and line animation is replaced by a static page icon with a soft opacity pulse on phase change; nothing moves otherwise. High contrast and dark mode use the identity tokens; the icon is a currentColor stroke.

S10 Screen reader: the icon is decorative (aria-hidden); the counter and phase line are one aria-live polite region updated when a document completes or the phase changes, never per section; the Ready state moves focus to the heading.

S11 Re-run of a single section (backlog 8): the same component in single mode with the counter hidden and the document name fixed.

S12 Time expectation: no ETA. One line under the counter on first render: "Usually about N minutes for N documents" where N comes from the measured median of the last 50 completed packs (rounded up to the nearest 5), stored server-side; absent until there are 20 packs.

## Dev notes

The job status endpoint already returns per-document state for the nudge; add the current section index and the `last_progress_at` timestamp. The component is a pure function of `{phase, done, total, currentDoc, currentSection, sectionCount, lastProgressAt, failed[]}`; no setTimeout-driven phases. CSS transforms and opacity only; one SVG, under 2 kB, brand colours from the identity tokens; no new dependency. Pause detection is `now - lastProgressAt > 90s` evaluated on each poll.

## Tests (QA)

Unit: the state mapping (job state to phase and copy) for every state including failed and partial. Component: every phase and S4, S6, S9 and S10 rendered and snapshotted; the live region updates once per document, not per section. Playwright (desktop, android-small, iphone): S1 end to end with the fixtures; S3 by freezing the feed (pause and pen lift asserted); S2 by backgrounding the tab (document.hidden) and asserting the refreshed count; S4 with a forced lint failure; reduced motion via emulateMedia; no sideways scroll at 360 px; Lighthouse CPU idle while animating under 5 percent on the mobile profile.

## Acceptance

AC-1 A provider who locks their phone and returns sees the true count and a sentence saying what happened meanwhile. AC-2 With the feed frozen, the animation stops within 90 seconds and the copy says so. AC-3 Ready state leads with the next guided-path step, with Download secondary. AC-4 Passes axe and the keyboard walk on all three projects; reduced motion shows no movement.

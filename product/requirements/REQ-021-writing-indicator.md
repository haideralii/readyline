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

## Dev response (Dev, 14 Oct 2026, standing backlog 10; branch `req-021-writing-indicator`, D-2101)

Built as one component on the job row, with the scenarios that need a controlled feed driven from a fake-mode test page rather than from a real job.

- **Where the truth comes from.** `generation_jobs` gains `phase`, `document_total`, `current_document_type_id`, `current_section_index`, `section_count`, `last_progress_at` and `failed_documents`, and the status `attention`; the loop writes the phase and the time with every progress update. `GET /api/generation/status` (owner's session) returns the pure `WritingStatus`; the component polls it every 5 seconds while the page is visible and at once when the page comes back, so two tabs or two devices read the same state (S8) and nothing is stored only in the browser (S2).
- **S4, honestly.** A model error does not throw inside the loop: every section falls back, the document is redrafted once (REQ-016) and, if still over the generic-section cap, is stored and listed as "degraded" with "Try again" or "Keep it as it is". A thrown error (render, a write) is retried once at the tick level with backoff, then listed as "error" with nothing stored and "Try again" or "Continue without it". The pack is not ready while anything is listed.
- **S5.** Fallback sections are not failures: a document under the cap counts as written and its blanks appear in Finish your pack. No word in the indicator names the model, fallbacks or lints (unit test).
- **S12.** The usual time is the median of the last 50 ready jobs' durations, rounded up to 5 minutes, absent under 20 packs; read with the service key, no account data in the answer.
- **Not in this batch.** The Lighthouse "CPU idle under 5 percent while animating" figure: the budget runner takes the fixed page list and signs in for `/documents`; the dev page is not in it. The animation is transforms and opacity on one SVG with four line nodes and a nib, paused when the feed is quiet; the number is owed when the runner takes the page or the PO wants a one-off run.

## Delivery evidence (Dev, 14 Oct 2026; branch `req-021-writing-indicator`, D-2101)

- **Unit.** `src/lib/generation/writing-state.test.ts` (21): every job state to a phase including failed, attention and an unknown phase; the words per phase and quiet state; the live text without a section number; the split counter; the document list; the quiet rule at 90 seconds and 5 minutes; the away sentence; the usual-time rule. `src/server/generation/job.test.ts` (+3): every phase written with `last_progress_at`, the 1-based section index within the count, the set size; the degraded path to `attention` and the owner's retry that regenerates one document as version 2 and finishes the set; the thrown-error path to `attention` with nothing stored and "continue without" finishing the set with the rest.
- **Component and scenarios (Playwright, desktop Chromium, small Android, iPhone WebKit).** `e2e/writing-indicator.spec.ts` on the fake-mode test page: S1 the five phases in order with the counter never going backwards and the list in set order; S6 and AC-3 the Ready state at once with no movement, the next step first and Download second, focus on the heading (S10); S3 the quiet feed pauses the icon and names the document, the long one says the page can be closed (AC-2); S2 the hidden page refreshes on return and says what happened (AC-1); S4 the split counter and Try again for that document only; S7 the reconnecting dot then the offline line; S9 reduced motion shows no movement; axe and the 360 px width check on the preparing, ready and attention screens (AC-4). Results: 21 passed across the three projects (7 each); the iPhone run with one worker, because WebKit's renderer crashed once on a screenshot while three projects ran in parallel, and S2 needed the component to be live before the page is hidden (the indicator now marks itself hydrated). The guided-path spec asserts the indicator on the real job's wait step (CI's Supabase job).
- **Screenshots** of the five phases on the iPhone project under `product/evidence/req-021/` (`phase-1-preparing` to `phase-5-ready`, plus `quiet` and `attention`).
- **Needs the PO.** The migration applies through `migrate.yml` on merge (the hosted project is behind the branches, as before); the Lighthouse CPU figure (above).

# REQ-026: The "Start here" sheet: what to do with your documents, as a list

Status: ready (PO, 15 Oct 2026; Haider: "after docs are generated, also generate one file that gives the user steps to do, where to fill, which to review, as a list, so they know what to do with the docs"; the independent `req-review` of 15 Oct 2026 is in `product/qa/req-reviews/2026-10-15-req-025-026.md` and the PO's decisions on its 16 findings are applied to this text; one session; FR-6 waits for REQ-025 Session C)
Phase: 6 Priority: must Owner: Dev

## Why

- A customer downloads 15 to 24 Word files and a zip. Nothing tells them which to open first, what to type where, what to read, and when it counts as done.
- The product already knows every answer to that: the blanks per document ("[name]", "[date]", "[phone or email]": a bracketed fact of at most four words inside a complete sentence, REQ-016 S-8, D-541), which sections were drafted from the answers (review these), which are fixed text (read once), which are generic text to make yours, the adoption order (`set-order.ts`), and the adopt step (REQ-018).
- The guided path shows this on screen, one document at a time. The sheet is the same facts as one printable list that sits in the zip and on the set's page.

## Decisions

- D-2220 The sheet is generated from facts, never from the model: blanks, section kinds, titles and order come from the pack's own data; no prompt, no recording, no cost per pack.
- D-2221 One idea per line, numbered, plain words (REQ-025 D-2219 applies); no paragraph longer than two lines (REQ-025's D-2218 says three lines for pages and two for this sheet).

## Functional requirements

- FR-1 Every pack gains `00-start-here.docx` (first in the zip; first on the set's page `/documents/[setId]`) and the same content as a page, `/documents/[setId]/start-here`, printable. The sheet is not a document type: it is not adopted, not in the document control register (REQ-018 FR-13), and not counted in "Documents: N".
- FR-2 The sheet's sections, in order:
  1. "Your pack in one minute": the audit type (plain meaning), the number of documents and registers, the three things that make a document count (filled in, read, adopted), about how long each document takes (a fixed estimate per document type, PO text), and "if a blank does not apply to you, write 'not applicable' and why; do not delete the line", one line each.
  2. "Do these first": the first documents in the pack's own order (`set-order.ts`, the order the set page and the adopt groups already use), numbered, with why in six words or fewer; this section names no documents of its own.
  3. "For each document", one numbered block per document, in that same order:
     - "Open": the file name.
     - "Fill in": every blank the Finish form asks for in that file (`formBlanks`), one line each, as the section number, its heading and the blank's words ("Section 2, Scope: [name]"; REQ-016's vocabulary, never "[Provider to complete: ...]", which the generator lint forbids).
     - "Fill in Word": the blanks the app never sees (the signature and date lines, the register row templates), one line each in the same form, with a printed box and the words "fill this in Word".
     - "Review": the sections drafted from your answers, by number and title, one line each ("Section 5: How we put this into practice").
     - "Make it yours": the sections that fell back to generic text, by number and title, with README's words ("Generic text: add your details; make it yours").
     - "Read once": "Sections 3, 8, 9, 10, 11 are fixed text every provider gets."
     - "Adopt": "Sign and date the document control table, then mark it adopted on your documents page."
  4. "Registers": one line per register: what it is for and where it is (your pack's template, or the app if subscribed).
  5. "When you are done": the three next steps (the checklist, the audit-day page, "Check my systems"), one line each with the link.
- FR-3 Counts on the sheet: "You have N things to fill in across M documents" at the top, and per document "K to fill in, J to review"; N, M and K count the Finish-form blanks (`formBlanks`), the same set the Finish page counts, so the two numbers never differ on the same screen.
- FR-4 The on-screen version marks each "Fill in" line done when its blank no longer appears in the finished document (REQ-018 Finish), which applies to Finish-form blanks only; "Fill in Word" lines carry the printed box on screen too and never tick; each document is marked done when adopted; the printed version has a box per line.
- FR-5 The sheet regenerates whenever the pack does; the Word file's footer carries the pack's generation date and the readiness summary's version, no ids.
- FR-6 The sample on `/sample` (REQ-025 FR-12) shows its own Start here sheet, so a buyer sees it before paying; this item waits for REQ-025 Session C and is not built in this session.
- FR-7 `README.txt`'s "How to use them" paragraph points at the sheet; the readiness summary PDF keeps its blanks list.

## Security and privacy

- SR-1 The sheet carries the business name, document titles, section headings and the blanks' words only; never a participant, never a worker name; after Finish, filled values are never echoed, only which lines are done.
- SR-2 Served under the same account check as the documents; the download is the existing route with a new file name.

## Acceptance criteria

- AC-1 Given a finished sole-trader pack from the recorded fixtures, when the zip is built, then `00-start-here.docx` is first, lists every document in `set-order.ts`'s order, and its "Fill in" lines equal the set of Finish-form blanks in the files (a test counts both the same way).
- AC-2 Given the fixture document named in the Dev response (at least three form-key blanks), when two are filled through Finish, then `/documents/[setId]/start-here` shows one open "Fill in" line for it and the count updates.
- AC-3 Given the sample, when `/sample` renders, then its Start here sheet is shown under the document (after REQ-025 Session C).
- AC-4 Given the sheet built from the fixture pack, when the builder's unit test runs over its output, then every line is at most 20 words and every glossary term present has its meaning (REQ-025 AC-8's rules, checked here over generated text, which the copy lint does not walk).

## Tests and evidence

- Unit: the sheet builder over the fixture pack (order, blanks, counts, the N = 0 case, the 20-word and glossary checks over the output); the docx render through the existing skeleton path.
- E2E (desktop and android): AC-2 through the guided path; the download route serves the file.
- Evidence: the sheet from the fixture pack committed under `product/evidence/req-026/`; screenshots at 360 px and desktop.

## Questions for Dev

1. Are the markers and section kinds available as data after generation (the Finish form reads them), or only inside the docx? Prefer the data path.
2. Does the docx skeleton path (D-504) render a numbered-list document without a new template?
3. Estimate.

## Dev response

Written 15 Oct 2026 (Dev), answers only; no session started: the independent review comes first (D-2215).

1. **Markers and section kinds as data.** Yes, the data path exists and is the one the app already uses. Every stored document version carries its model (`document_versions.model`, jsonb): sections with `number`, `heading`, `mode` (`fixed` or `tailored`) and `status`, and their blocks. The blanks are found in that model by `collectBlanks(model)` in `src/lib/generator/blanks.ts`, which the Finish form, `openBlanks` and the readiness summary already read; the adoption order is `auditOrder` in `src/lib/generator/set-order.ts`; adoption state is `listAdoptedTypeIds`. So the sheet builder reads the set's models and nothing from the docx files, and FR-4's "done when the blank no longer appears" is a comparison of two models' blanks, which is what Finish already does.
2. **The docx path.** `renderDocx` renders a `DocumentModel` whose blocks are paragraph, bullets, steps (a numbered list), table and callout, so the sheet is a synthetic model (one section per heading in FR-2, the per-document blocks as `steps` lists, the counts as paragraphs) rendered through the existing path with no new template; the printed box per line is a "☐ " prefix on each step, no new block type. One change outside the builder: the zip assembly in `src/server/generation/run.ts` and `rerender.ts` adds the sheet first (fflate keeps insertion order); the file is `00-start-here.docx` (the download route's file-name pattern allows letters, digits, dots and dashes, not a space) and the title inside says "Start here".
3. **Estimate.** One session of 5 to 6 hours: the builder with its tests over the fixture pack (order, blanks, counts, N = 0), the docx through the model, `/documents/[setId]/start-here` with the live done state from the Finish comparison and adoption, the zip order and the file name, the footer with the generation date and the summary version, the 20-word and glossary checks over the sheet's lines in the builder's test, the e2e on desktop and Android through the guided path. FR-6 (the sheet on `/sample`) waits for REQ-025 Session C.
4. **The fixture document for AC-2 (review finding 27).** `privacy-and-information-management-policy`: in every reference case its skeleton alone carries three Finish-form blanks, "[other tool]", "[allowed use]" and "[limits]" (counted on 15 Oct 2026 over the three reference cases with `collectBlanks` and `formBlanks`; the recorded tailored sections can only add to it). No other document type carries more than one on its skeleton.

## Review

Done 15 Oct 2026: `product/qa/req-reviews/2026-10-15-req-025-026.md` (independent reviewer; the PO's decision on each of findings 25 to 40 is at its top). Applied to this text by Dev on 15 Oct 2026 as one docs-only commit for the PO to check.

## Delivery evidence

**Delivered (Dev, 15 Oct 2026)** on `req-026-start-here` dfec69d (cut from `next` with `req-025-session-a` merged in for the glossary; PR to `next` after Session A's; body: `product/evidence/req-026/pr-body.md`).

- AC mapping: AC-1 → `src/lib/generator/start-here.test.ts` (every document in `set-order.ts`'s order, numbered; the "Fill in" lines equal `formBlanks` over the shipped version, counted the same way; the privacy policy's three; the signature and account-fact blanks in neither bucket; the content file) and `src/server/generation/job.test.ts` (`00-start-here.docx` first in the zip, the README line); AC-2 → the unit test (two of the privacy policy's three blanks filled through `applyFacts` leave one open line and the counts move; a finished pack reads all done) and `e2e/signed-in/guided-path.spec.ts` on desktop and Android (the sheet before Finish with open lines and the privacy policy's three, after Finish with every line done, after adopt with every Adopt line done, the Word download); AC-3 → waits for REQ-025 Session C (decision 34); AC-4 → the unit test over every line of every reference case (20 words, claim-free, lint-clean, every glossary term's meaning present).
- `npm run check`: green (122 files, 876 tests, 6 skipped); 5 new unit tests.
- Local gate: the public `documents`, `home` and `not-found` specs on desktop 5 passed (the new route redirects signed out like the rest of `/documents`); the signed-in e2e runs in the PR's Supabase job.
- Evidence: `product/evidence/req-026/00-start-here.docx` and `start-here-sole-trader.txt` (the sole-trader reference case's sheet), committed.
- Accessibility: the page is headings and lists with a visible box or tick and a screen-reader "Done:" / "To do:" prefix on every line; the guided-path e2e runs the width check and the keyboard pass on it.
- UNVERIFIED or deferred: FR-6 (REQ-025 Session C); "Check my systems" in section 5 until REQ-020 Session C; the minutes and reasons are a Dev draft (status draft) for the PO's words (D-2234).

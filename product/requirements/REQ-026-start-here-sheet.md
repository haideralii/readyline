# REQ-026: The "Start here" sheet: what to do with your documents, as a list

Status: ready (PO, 15 Oct 2026; Haider: "after docs are generated, also generate one file that gives the user steps to do, where to fill, which to review, as a list, so they know what to do with the docs"; independent req-review before Session A, D-2215)
Phase: 6 Priority: must Owner: Dev

## Why

- A customer downloads 15 to 24 Word files and a zip. Nothing tells them which to open first, what to type where, what to read, and when it counts as done.
- The product already knows every answer to that: the "[Provider to complete: ...]" markers per document, which sections were drafted from the answers (review these), which are fixed text (read once), the adoption order (governance first), and the adopt step (REQ-018).
- The guided path shows this on screen, one document at a time. The sheet is the same facts as one printable list that sits in the zip and on `/documents`.

## Decisions

- D-2220 The sheet is generated from facts, never from the model: markers, section kinds, titles and order come from the pack's own data; no prompt, no recording, no cost per pack.
- D-2221 One idea per line, numbered, plain words (REQ-025 D-2219 applies); no paragraph longer than two lines.

## Functional requirements

- FR-1 Every pack gains `00 Start here.docx` (first in the zip, first on `/documents`) and the same content as a page, `/documents/start-here`, printable.
- FR-2 The sheet's sections, in order:
  1. "Your pack in one minute": the audit type (plain meaning), the number of documents and registers, the three things that make a document count (filled in, read, adopted), one line each.
  2. "Do these first": the documents to adopt before the others (governance, privacy, incident, complaints), numbered, with why in six words or fewer.
  3. "For each document", one numbered block per document, in adoption order:
     - "Open": the file name.
     - "Fill in": every "[Provider to complete: ...]" marker in that file, one line each, with the section number ("Section 2: the name of the person responsible for complaints").
     - "Review": the sections drafted from your answers, by number and title, one line each ("Section 5: How we put this into practice").
     - "Read once": "Sections 3, 8, 9, 10, 11 are fixed text every provider gets."
     - "Adopt": "Sign and date the document control table, then mark it adopted on your documents page."
  4. "Registers": one line per register: what it is for and where it is (your pack's template, or the app if subscribed).
  5. "When you are done": the three next steps (the checklist, the audit-day page, "Check my systems"), one line each with the link.
- FR-3 Counts on the sheet: "You have N things to fill in across M documents" at the top, and per document "K to fill in, J to review".
- FR-4 The on-screen version marks each "Fill in" line done when the marker no longer appears in the finished document (REQ-018 Finish), and each document done when adopted; the printed version has a box per line.
- FR-5 The sheet regenerates whenever the pack does; the Word file carries the pack's generation date and set id in its footer.
- FR-6 The sample on `/sample` (REQ-025 FR-12) shows its own Start here sheet, so a buyer sees it before paying.

## Security and privacy

- SR-1 The sheet carries the business name and document titles only; never a participant, never a worker name; marker text is the template's, not anything the provider typed.
- SR-2 Served under the same account check as the documents; the download is the existing route with a new file name.

## Acceptance criteria

- AC-1 Given a finished sole-trader pack from the recorded fixtures, when the zip is built, then `00 Start here.docx` is first, lists every document in adoption order, and its "Fill in" lines equal the set of markers in the files (a test counts both).
- AC-2 Given a document with three markers, when two are filled through Finish, then `/documents/start-here` shows one open "Fill in" line for it and the count updates.
- AC-3 Given the sample, when `/sample` renders, then its Start here sheet is shown under the document.
- AC-4 Given the sheet, when the copy lint runs, then every line is at most 20 words and every glossary term has its meaning (REQ-025 AC-8).

## Tests and evidence

- Unit: the sheet builder over the fixture pack (order, markers, counts, the N = 0 case); the docx render through the existing skeleton path.
- E2E (desktop and android): AC-2 through the guided path; the download route serves the file.
- Evidence: the sheet from the fixture pack committed under `product/evidence/req-026/`; screenshots at 360 px and desktop.

## Questions for Dev

1. Are the markers and section kinds available as data after generation (the Finish form reads them), or only inside the docx? Prefer the data path.
2. Does the docx skeleton path (D-504) render a numbered-list document without a new template?
3. Estimate.

## Dev response

Written 15 Oct 2026 (Dev), answers only; no session started: the independent review comes first (D-2215).

1. **Markers and section kinds as data.** Yes, the data path exists and is the one the app already uses. Every stored document version carries its model (`document_versions.model`, jsonb): sections with `number`, `heading`, `mode` (`fixed` or `tailored`) and `status`, and their blocks. The "[Provider to complete: ...]" markers are found in that model by `collectBlanks(model)` in `src/lib/generator/blanks.ts`, which the Finish form, `openBlanks` and the readiness summary already read; the adoption order is `auditOrder` in `src/lib/generator/set-order.ts`; adoption state is `listAdoptedTypeIds`. So the sheet builder reads the set's models and nothing from the docx files, and FR-4's "done when the marker no longer appears" is a comparison of two models' blanks, which is what Finish already does.
2. **The docx path.** `renderDocx` renders a `DocumentModel` whose blocks are paragraph, bullets, steps (a numbered list), table and callout, so the sheet is a synthetic model (one section per heading in FR-2, the per-document blocks as `steps` lists, the counts as paragraphs) rendered through the existing path with no new template; the printed box per line is a "☐ " prefix on each step, no new block type. One change outside the builder: the zip assembly in `src/server/generation/run.ts` and `rerender.ts` adds the sheet first (fflate keeps insertion order), and the download route's file-name pattern needs to accept `00 Start here.docx` (it allows letters, digits, dots and dashes today, not a space), or the file is named `00-start-here.docx` and the title inside says "Start here".
3. **Estimate.** One session of 5 to 6 hours: the builder with its tests over the fixture pack (order, markers, counts, N = 0), the docx through the model, `/documents/start-here` with the live done state from the Finish comparison and adoption, the zip order and the file name, the footer with the generation date and set id, the copy lint over the sheet's lines, the e2e on desktop and Android through the guided path. FR-6 (the sheet on `/sample`) depends on REQ-025 FR-12's `/sample` page; until that exists the sample sheet can sit under the sample on the home page, or wait for REQ-025 Session C, your call.

## Review

Awaiting the independent review (D-2215).

## Delivery evidence

Not started.
